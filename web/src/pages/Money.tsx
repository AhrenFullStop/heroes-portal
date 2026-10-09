import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react';
import { api } from '../api';
import type { MoneySnapshot } from '../../../shared/types';

const EXPENSE_FIELDS = ['Rent', 'Food', 'Transport', 'Data', 'Family', 'Other'];

export default function Money() {
  const [snapshots, setSnapshots] = useState<MoneySnapshot[]>([]);
  const [income, setIncome] = useState('');
  const [expenses, setExpenses] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  async function load() {
    const res = await api.get<{ snapshots: MoneySnapshot[] }>('/money');
    setSnapshots(res.snapshots);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setFlash(null);
    try {
      const parsed: Record<string, number> = {};
      for (const [k, v] of Object.entries(expenses)) {
        const n = parseFloat(v);
        if (v.trim() && isFinite(n)) parsed[k] = n;
      }
      await api.post('/money', { income: parseFloat(income) || 0, expenses: parsed });
      setIncome('');
      setExpenses({});
      await load();
      setFlash('Check-in saved. See the feedback below.');
    } catch (err: any) {
      setFlash(err?.message || 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  const totalExpenses = Object.entries(expenses)
    .map(([, v]) => parseFloat(v) || 0)
    .reduce((s, n) => s + n, 0);
  const projected = (parseFloat(income) || 0) - totalExpenses;

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-black text-xl">Money</h1>
        <p className="text-slate-400 text-sm mt-0.5">Real numbers, real plan. Every month.</p>
      </div>

      <form onSubmit={submit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">
            Income this month (R)
          </label>
          <input
            type="number"
            inputMode="decimal"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="e.g. 4500"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
          />
        </div>
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-1.5">
            Expenses (R)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {EXPENSE_FIELDS.map((f) => (
              <div key={f} className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs">{f}</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={expenses[f] ?? ''}
                  onChange={(e) => setExpenses((x) => ({ ...x, [f]: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-16 pr-3 py-2.5 text-sm focus:outline-none focus:border-amber-500"
                />
              </div>
            ))}
          </div>
        </div>
        {parseFloat(income) > 0 && (
          <div className={`flex items-center gap-2 text-sm font-semibold ${projected < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
            {projected < 0 ? <TrendingDown size={16} /> : <TrendingUp size={16} />}
            Left after expenses: R{projected.toFixed(0)}
          </div>
        )}
        <button
          type="submit"
          disabled={busy}
          className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl px-4 py-3 text-sm"
        >
          {busy ? 'Saving…' : 'Save check-in'}
        </button>
        {flash && <p className="text-xs text-slate-400">{flash}</p>}
      </form>

      {snapshots.map((s) => {
        const expTotal = Object.values(s.expenses ?? {}).reduce((sum, n) => sum + Number(n), 0);
        const inc = Number(s.income);
        const left = inc - expTotal;
        return (
          <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Wallet size={16} className="text-amber-500" />
                {s.month_year}
              </div>
              <span className={`text-xs font-bold ${left < 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                {left < 0 ? '-' : '+'}R{Math.abs(left).toFixed(0)}
              </span>
            </div>
            <div className="mt-2 flex gap-4 text-xs text-slate-400">
              <span>In <b className="text-slate-200">R{inc.toFixed(0)}</b></span>
              <span>Out <b className="text-slate-200">R{expTotal.toFixed(0)}</b></span>
            </div>
            {s.ai_summary && (
              <div className="mt-3 bg-slate-800/60 border border-slate-700/40 rounded-xl px-3 py-2.5 text-sm text-slate-300 leading-relaxed">
                {s.ai_summary}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}
