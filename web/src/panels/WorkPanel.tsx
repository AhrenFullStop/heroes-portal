import { useEffect, useState } from 'react';
import { Briefcase, ExternalLink, MapPin } from 'lucide-react';
import { api } from '../api';
import type { Opportunity } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';

const KIND_STYLES: Record<Opportunity['kind'], string> = {
  job: 'bg-emerald-100 text-emerald-700',
  learnership: 'bg-sky-100 text-sky-700',
  bursary: 'bg-violet-100 text-violet-700',
  training: 'bg-amber-100 text-amber-700',
};

function closesLabel(closesOn: string | null): string {
  if (!closesOn) return 'Open';
  const t = new Date(`${closesOn}T00:00:00`);
  if (Number.isNaN(t.getTime())) return 'Open';
  return `Closes ${t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long' })}`;
}

export default function WorkPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ opportunities: Opportunity[] }>('/work/opportunities')
      .then((r) => {
        if (!alive) return;
        // soonest closing first; open-ended last
        const sorted = [...r.opportunities].sort((a, b) => {
          if (!a.closes_on) return 1;
          if (!b.closes_on) return -1;
          return a.closes_on.localeCompare(b.closes_on);
        });
        setOpportunities(sorted);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Briefcase} label="Work" onDismiss={onDismiss} />

      <MicroLabel>Open opportunities</MicroLabel>

      {!loaded ? (
        <PanelState busy>Loading opportunities…</PanelState>
      ) : error ? (
        <PanelState>Could not load opportunities. Try again.</PanelState>
      ) : opportunities.length === 0 ? (
        <PanelState>No open opportunities right now. Check back soon.</PanelState>
      ) : (
        <div className="space-y-3">
          {opportunities.map((o) => (
            <div
              key={o.id}
              className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <span
                    className={`inline-block text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${KIND_STYLES[o.kind]}`}
                  >
                    {o.kind}
                  </span>
                  <h3 className="font-bold text-sm mt-1.5 leading-snug">{o.title}</h3>
                  <div className="text-xs text-slate-500 mt-0.5">
                    {o.org}
                    {o.location && (
                      <span className="inline-flex items-center gap-1 ml-2">
                        <MapPin size={11} />
                        {o.location}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 shrink-0 mt-0.5">
                  {closesLabel(o.closes_on)}
                </span>
              </div>

              {o.description && (
                <p className="text-xs text-slate-600 leading-relaxed mt-2">{o.description}</p>
              )}

              {o.apply_url && (
                <a
                  href={o.apply_url}
                  onClick={() => buzz(10)}
                  className="mt-3 inline-flex items-center justify-center gap-1.5 min-h-11 px-4 rounded-xl bg-amber-500 text-slate-950 text-sm font-black hover:bg-amber-400 transition-colors"
                >
                  Apply
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelMount>
  );
}
