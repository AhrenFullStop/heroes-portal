import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Briefcase, GraduationCap, BookOpen, Wrench, MapPin, CalendarDays, ExternalLink } from 'lucide-react';
import { api } from '../api';
import type { Opportunity } from '../../../shared/types';

const KIND_META: Record<string, { icon: typeof Briefcase; label: string; cls: string }> = {
  job: { icon: Briefcase, label: 'Job', cls: 'text-emerald-400 bg-emerald-950/40 border-emerald-900/50' },
  learnership: { icon: GraduationCap, label: 'Learnership', cls: 'text-sky-400 bg-sky-950/40 border-sky-900/50' },
  bursary: { icon: BookOpen, label: 'Bursary', cls: 'text-amber-400 bg-amber-950/40 border-amber-900/50' },
  training: { icon: Wrench, label: 'Training', cls: 'text-violet-400 bg-violet-950/40 border-violet-900/50' },
};

export default function Work() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);

  useEffect(() => {
    api.get<{ opportunities: Opportunity[] }>('/work/opportunities').then((r) => setOpportunities(r.opportunities)).catch(() => {});
  }, []);

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <div>
        <h1 className="font-black text-xl">Work</h1>
        <p className="text-slate-400 text-sm mt-0.5">Openings your HEROES team found for you. Move on them.</p>
      </div>

      {opportunities.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">Nothing listed right now. Check back soon.</p>
      )}

      {opportunities.map((o) => {
        const meta = KIND_META[o.kind] ?? KIND_META.job;
        const Icon = meta.icon;
        return (
          <motion.div key={o.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Icon size={15} className="text-amber-500" />
                  <h3 className="font-bold text-sm">{o.title}</h3>
                  <span className={`text-[10px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${meta.cls}`}>
                    {meta.label}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1">{o.org}</p>
              </div>
            </div>
            {o.description && <p className="text-sm text-slate-300 mt-2.5 leading-relaxed">{o.description}</p>}
            <div className="mt-3 flex items-center gap-4 text-xs text-slate-500">
              {o.location && (
                <span className="flex items-center gap-1">
                  <MapPin size={12} /> {o.location}
                </span>
              )}
              {o.closes_on && (
                <span className="flex items-center gap-1">
                  <CalendarDays size={12} /> Closes {o.closes_on}
                </span>
              )}
            </div>
            {o.apply_url && (
              <a
                href={o.apply_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs rounded-xl px-4 py-2 transition-colors"
              >
                Apply <ExternalLink size={13} />
              </a>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
