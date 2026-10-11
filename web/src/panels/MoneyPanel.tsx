import { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Sparkles, Wallet } from 'lucide-react';
import { api } from '../api';
import type { MoneySnapshot } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';

function money(n: number): string {
  return `R${Math.round(n).toLocaleString('en-ZA')}`;
}

function spentOf(s: MoneySnapshot): number {
  return Object.values(s.expenses ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
}

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(monthYear: string): string {
  const [y, m] = monthYear.split('-').map(Number);
  if (!y || !m) return monthYear;
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

export default function MoneyPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [snapshots, setSnapshots] = useState<MoneySnapshot[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [income, setIncome] = useState('');
  const [rent, setRent] = useState('');
  const [food, setFood] = useState('');
  const [transport, setTransport] = useState('');
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ snapshots: MoneySnapshot[] }>('/money')
      .then((r) => {
        if (!alive) return;
        setSnapshots(r.snapshots);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) setLoaded(true);
      });
    return () => {
      alive = false;
    };
  }, []);

  const latest = snapshots[0] ?? null;

  const totals = useMemo(() => {
    const exp =
      (Number(rent) || 0) + (Number(food) || 0) + (Number(transport) || 0) + (Number(other) || 0);
    return { exp, left: (Number(income) || 0) - exp };
  }, [income, rent, food, transport, other]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    buzz();
    setSaving(true);
    try {
      const r = await api.post<{ snapshot: MoneySnapshot }>('/money', {
        income: Number(income) || 0,
        expenses: {
          Rent: Number(rent) || 0,
          Food: Number(food) || 0,
          Transport: Number(transport) || 0,
          Other: Number(other) || 0,
        },
      });
      setSnapshots((ss) => [r.snapshot, ...ss.filter((s) => s.month_year !== r.snapshot.month_year)]);
      setJustLogged(r.snapshot.month_year);
      setIncome('');
      setRent('');
      setFood('');
      setTransport('');
      setOther('');
      setTimeout(() => setJustLogged(null), 4000);
    } finally {
      setSaving(false);
    }
  }

  const field =
    'w-full min-h-11 bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400';

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Wallet} label="Money" onDismiss={onDismiss} />

      {/* Month check-in form */}
      <form onSubmit={submit} className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 space-y-3">
        <div>
          <MicroLabel>{monthLabel(currentMonth())} check-in</MicroLabel>
          <h3 className="font-black text-base mt-0.5">What came in, what went out?</h3>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
            Income (R)
          </label>
          <input
            inputMode="numeric"
            value={income}
            onChange={(e) => setIncome(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder="0"
            className={field}
          />
        </div>

        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ['Rent', rent, setRent],
              ['Food', food, setFood],
              ['Transport', transport, setTransport],
              ['Other', other, setOther],
            ] as const
          ).map(([label, value, setter]) => (
            <div key={label}>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1">
                {label} (R)
              </label>
              <input
                inputMode="decimal"
                value={value}
                onChange={(e) => setter(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="0"
                className={field}
              />
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs font-bold">
          <span className="text-slate-500">LEFT OVER</span>
          <span className={totals.left >= 0 ? 'text-emerald-600' : 'text-red-600'}>
            {money(totals.left)}
          </span>
        </div>

        <button
          type="submit"
          disabled={saving || !income}
          className="w-full min-h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
        >
          {saving ? 'Talking to Bra Hero…' : 'Save my month'}
        </button>

        {justLogged && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-xs font-bold text-emerald-600 text-center"
          >
            Check-in saved for {monthLabel(justLogged)}.
          </motion.p>
        )}
      </form>

      {/* AI summary of the newest snapshot */}
      {latest?.ai_summary && (
        <div className="rounded-2xl bg-amber-500/10 border border-amber-500/40 p-4">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={15} className="text-amber-500" />
            <MicroLabel>Bra Hero on your money</MicroLabel>
          </div>
          <p className="text-sm text-amber-100 leading-relaxed whitespace-pre-wrap">
            {latest.ai_summary}
          </p>
        </div>
      )}

      {/* History */}
      <div>
        <MicroLabel>History</MicroLabel>
        {!loaded ? (
          <PanelState busy>Loading your months…</PanelState>
        ) : snapshots.length === 0 ? (
          <PanelState>No money check-ins yet. Log your first month above.</PanelState>
        ) : (
          <div className="mt-2 space-y-2">
            {snapshots.map((s) => {
              const spent = spentOf(s);
              const thisLeft = Number(s.income) - spent;
              return (
                <div
                  key={s.id}
                  className="bg-white rounded-2xl px-4 py-3 text-slate-950 shadow-lg shadow-black/20 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="font-bold text-sm">{monthLabel(s.month_year)}</div>
                    <div className="text-xs text-slate-500">
                      In {money(Number(s.income))} · Spent {money(spent)}
                    </div>
                  </div>
                  <div
                    className={`text-sm font-black shrink-0 ${
                      thisLeft > 0 ? 'text-emerald-600' : thisLeft < 0 ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    {thisLeft >= 0 ? `+${money(thisLeft)}` : money(thisLeft)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </PanelMount>
  );
}
