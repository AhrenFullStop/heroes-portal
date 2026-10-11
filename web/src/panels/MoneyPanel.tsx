import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  Pencil,
  PiggyBank,
  Plus,
  Sparkles,
  Trash2,
  Wallet,
} from 'lucide-react';
import { api } from '../api';
import type { MoneySnapshot } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';

/** Local PATCH (api.ts has no patch verb and is shared — keep the same conventions). */
async function patch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data as T;
}

interface SavingsGoal {
  id: number;
  name: string;
  target_amount: string;
  saved_amount: string;
  done: boolean;
  created_at: string;
}

function money(n: number): string {
  return `R${Math.round(n).toLocaleString('en-ZA')}`;
}

function spentOf(s: MoneySnapshot): number {
  return Object.values(s.expenses ?? {}).reduce((sum, n) => sum + Number(n || 0), 0);
}

function monthLabel(monthYear: string): string {
  const [y, m] = monthYear.split('-').map(Number);
  if (!y || !m) return monthYear;
  return new Date(y, m - 1, 1).toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
}

const field =
  'w-full min-h-11 bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400';

// ---- Savings goal card ----

const RING_R = 26;
const RING_C = 2 * Math.PI * RING_R;

function SavingsRing({ pct }: { pct: number }) {
  const clamped = Math.min(Math.max(pct, 0), 1);
  const dash = RING_C * clamped;
  return (
    <div className="relative w-16 h-16 shrink-0">
      <svg viewBox="0 0 64 64" className="w-16 h-16 -rotate-90">
        <circle cx="32" cy="32" r={RING_R} fill="none" stroke="#e2e8f0" strokeWidth="6" />
        <motion.circle
          cx="32"
          cy="32"
          r={RING_R}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={RING_C}
          initial={{ strokeDashoffset: RING_C }}
          animate={{ strokeDashoffset: RING_C - dash }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center text-[13px] font-black text-slate-950">
        {Math.round(clamped * 100)}%
      </div>
    </div>
  );
}

interface SavingsGoalCardProps {
  goal: SavingsGoal;
  onPatched: (goal: SavingsGoal) => void;
  onDeleted: (id: number) => void;
  onError: (message: string) => void;
}

function SavingsGoalCard({ goal, onPatched, onDeleted, onError }: SavingsGoalCardProps) {
  const target = Number(goal.target_amount) || 0;
  const saved = Number(goal.saved_amount) || 0;
  const pct = target > 0 ? saved / target : 0;

  const [armed, setArmed] = useState(false);
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [custom, setCustom] = useState('');
  const armTimer = useRef<number | null>(null);

  function disarm() {
    if (armTimer.current) window.clearTimeout(armTimer.current);
    armTimer.current = null;
    setArmed(false);
  }

  function arm() {
    buzz();
    setArmed(true);
    if (armTimer.current) window.clearTimeout(armTimer.current);
    armTimer.current = window.setTimeout(() => setArmed(false), 4000);
  }

  async function add(amount: number, fromCustom = false) {
    if (busy || !(amount > 0)) return;
    setBusy(true);
    try {
      const r = await patch<{ goal: SavingsGoal; just_completed: boolean }>(
        `/money/savings/${goal.id}`,
        { add_amount: amount }
      );
      onPatched(r.goal);
      buzz(10);
      if (r.just_completed) {
        buzz([20, 30, 20]);
        setBurst(true);
      }
      if (fromCustom) setCustom('');
    } catch {
      onError('Could not add to your savings. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function confirmDelete() {
    disarm();
    api
      .del<{ ok: boolean }>(`/money/savings/${goal.id}`)
      .then(() => onDeleted(goal.id))
      .catch(() => onError('Could not delete the goal. Try again.'));
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -6 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 overflow-hidden"
    >
      {/* amber dot burst when the goal is reached */}
      <AnimatePresence>
        {burst && (
          <motion.div
            initial={{ opacity: 1 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.9 }}
            onAnimationComplete={() => setBurst(false)}
            className="absolute inset-0 pointer-events-none"
          >
            {[...Array(8)].map((_, i) => {
              const angle = (i / 8) * Math.PI * 2;
              return (
                <motion.span
                  key={i}
                  initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
                  animate={{
                    x: Math.cos(angle) * 70,
                    y: Math.sin(angle) * 70,
                    opacity: 0,
                    scale: 0.4,
                  }}
                  transition={{ duration: 0.7, ease: 'easeOut' }}
                  className="absolute left-1/2 top-1/2 -ml-1 -mt-1 w-2 h-2 rounded-full bg-amber-500"
                />
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex items-center gap-3">
        <SavingsRing pct={pct} />
        <div className="min-w-0 flex-1">
          <div className="font-bold text-sm leading-snug break-words pr-1">{goal.name}</div>
          <div className="text-xs text-slate-500 mt-0.5">
            {money(saved)} of {money(target)}
          </div>
          {goal.done ? (
            <div className="mt-1 inline-flex items-center gap-1 text-[11px] font-black text-amber-600">
              <Check size={12} />
              Goal reached!
            </div>
          ) : (
            <div className="mt-1 text-[11px] text-slate-400">
              {money(Math.max(target - saved, 0))} to go
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={armed ? confirmDelete : arm}
          aria-label={armed ? 'Tap again to delete this goal' : 'Delete this goal'}
          className={`w-11 h-11 -mr-2 -mt-1 shrink-0 flex items-center justify-center rounded-full transition-colors ${
            armed
              ? 'text-red-600 bg-red-50'
              : 'text-slate-300 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {armed ? (
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
          <span className="text-xs font-bold text-red-600 flex-1">Delete this goal?</span>
          <button
            type="button"
            onClick={confirmDelete}
            className="min-h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-black hover:bg-red-500 transition-colors"
          >
            Delete
          </button>
          <button
            type="button"
            onClick={disarm}
            className="min-h-9 px-3 rounded-lg bg-white text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            Keep
          </button>
        </div>
      ) : (
        !goal.done && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => add(100)}
              disabled={busy}
              className="min-h-11 px-3 rounded-xl bg-amber-500/15 text-amber-700 text-xs font-black hover:bg-amber-500/25 transition-colors disabled:opacity-40"
            >
              +R100
            </button>
            <button
              type="button"
              onClick={() => add(250)}
              disabled={busy}
              className="min-h-11 px-3 rounded-xl bg-amber-500/15 text-amber-700 text-xs font-black hover:bg-amber-500/25 transition-colors disabled:opacity-40"
            >
              +R250
            </button>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                add(Number(custom), true);
              }}
              className="flex flex-1 min-w-0 items-center gap-1.5"
            >
              <input
                inputMode="decimal"
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9.]/g, ''))}
                placeholder="Custom"
                aria-label="Custom amount to add"
                className="min-h-11 w-full min-w-0 bg-slate-100 rounded-xl px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={busy || !(Number(custom) > 0)}
                aria-label="Add custom amount"
                className="w-11 h-11 shrink-0 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 transition-colors disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
            </form>
          </div>
        )
      )}
    </motion.div>
  );
}

// ---- Panel ----

export default function MoneyPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [snapshots, setSnapshots] = useState<MoneySnapshot[]>([]);
  const [goals, setGoals] = useState<SavingsGoal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);
  const errTimer = useRef<number | null>(null);

  // Log-this-month form
  const [logOpen, setLogOpen] = useState(false);
  const [income, setIncome] = useState('');
  const [rent, setRent] = useState('');
  const [food, setFood] = useState('');
  const [transport, setTransport] = useState('');
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [justLogged, setJustLogged] = useState<string | null>(null);

  // New savings goal form
  const [newName, setNewName] = useState('');
  const [newTarget, setNewTarget] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<{ snapshots: MoneySnapshot[] }>('/money'),
      api.get<{ goals: SavingsGoal[] }>('/money/savings'),
    ])
      .then(([m, s]) => {
        if (!alive) return;
        setSnapshots(m.snapshots);
        setGoals(s.goals);
        setLoaded(true);
        if (m.snapshots.length === 0) setLogOpen(true);
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

  function flashGoalError(message: string) {
    setGoalError(message);
    if (errTimer.current) window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setGoalError(null), 4000);
  }

  const latest = snapshots[0] ?? null;
  const previous = snapshots[1] ?? null;

  const incomeNum = latest ? Number(latest.income) || 0 : 0;
  const spentNum = latest ? spentOf(latest) : 0;
  const leftNum = incomeNum - spentNum;

  const categories = useMemo(() => {
    if (!latest) return [];
    return Object.entries(latest.expenses ?? {})
      .map(([label, v]) => {
        const amount = Number(v) || 0;
        const prevAmount = previous ? Number(previous.expenses?.[label] ?? 0) : null;
        return { label, amount, delta: prevAmount == null ? null : amount - prevAmount };
      })
      .sort((a, b) => b.amount - a.amount);
  }, [latest, previous]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (saving) return;
    setFormError(null);
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
      setSnapshots((ss) => [
        r.snapshot,
        ...ss.filter((s) => s.month_year !== r.snapshot.month_year),
      ]);
      setJustLogged(r.snapshot.month_year);
      setIncome('');
      setRent('');
      setFood('');
      setTransport('');
      setOther('');
      setTimeout(() => setJustLogged(null), 4000);
    } catch {
      setFormError('Could not save your month. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    const target = Number(newTarget);
    if (creating || !name || !(target > 0)) return;
    buzz();
    setCreating(true);
    try {
      const r = await api.post<{ goal: SavingsGoal }>('/money/savings', {
        name,
        target_amount: target,
      });
      setGoals((gs) => [r.goal, ...gs]);
      setNewName('');
      setNewTarget('');
    } catch {
      flashGoalError('Could not create the goal. Try again.');
    } finally {
      setCreating(false);
    }
  }

  const spentPct = incomeNum > 0 ? Math.min(spentNum / incomeNum, 1) * 100 : 0;

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Wallet} label="Money" onDismiss={onDismiss} />

      {!loaded ? (
        <PanelState busy>Loading your money…</PanelState>
      ) : error ? (
        <PanelState>Could not load your money. Pull down to try again.</PanelState>
      ) : (
        <>
          {/* THIS MONTH hero */}
          {!latest ? (
            <div className="bg-white rounded-2xl p-6 text-slate-950 text-center shadow-lg shadow-black/20">
              <Wallet size={24} className="text-amber-500 mx-auto mb-2" />
              <p className="text-sm text-slate-600 leading-relaxed">
                No money check-ins yet. Log your first month at the bottom — know where every
                rand goes.
              </p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20">
              <MicroLabel>{monthLabel(latest.month_year)}</MicroLabel>
              <div className="mt-3 grid grid-cols-3 gap-2">
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    In
                  </div>
                  <div className="text-lg font-black mt-0.5">{money(incomeNum)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    Spent
                  </div>
                  <div className="text-lg font-black mt-0.5">{money(spentNum)}</div>
                </div>
                <div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500">
                    Left
                  </div>
                  <div
                    className={`text-xl font-black mt-0.5 ${
                      leftNum > 0
                        ? 'text-emerald-600'
                        : leftNum < 0
                          ? 'text-red-600'
                          : 'text-slate-500'
                    }`}
                  >
                    {money(leftNum)}
                  </div>
                </div>
              </div>
              <div className="mt-3">
                <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${leftNum >= 0 ? 'bg-amber-500' : 'bg-red-500'}`}
                    initial={false}
                    animate={{ width: `${spentPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-1.5">
                  <span>
                    {incomeNum > 0
                      ? `Spent ${Math.round((spentNum / incomeNum) * 100)}% of income`
                      : 'No income logged'}
                  </span>
                  <span>
                    {leftNum >= 0 ? `${money(leftNum)} left` : `${money(Math.abs(leftNum))} over`}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Category bars */}
          {latest && categories.length > 0 && (
            <div className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20">
              <MicroLabel>Where it went</MicroLabel>
              <div className="mt-3 space-y-3.5">
                {categories.map((c) => {
                  const pctOfIncome = incomeNum > 0 ? (c.amount / incomeNum) * 100 : 0;
                  return (
                    <div key={c.label}>
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="font-bold truncate">{c.label}</span>
                        <span className="flex items-center gap-1.5 shrink-0">
                          <span className="font-black">{money(c.amount)}</span>
                          {c.delta != null && c.delta !== 0 && (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[11px] font-black ${
                                c.delta > 0 ? 'text-red-600' : 'text-emerald-600'
                              }`}
                            >
                              {c.delta > 0 ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
                              {money(Math.abs(c.delta))}
                            </span>
                          )}
                        </span>
                      </div>
                      <div className="mt-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-gradient-to-r from-amber-600 to-amber-400"
                          initial={false}
                          animate={{ width: `${Math.min(pctOfIncome, 100)}%` }}
                          transition={{ duration: 0.6, ease: 'easeOut' }}
                        />
                      </div>
                      <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mt-0.5">
                        {incomeNum > 0
                          ? `${Math.round(pctOfIncome)}% of income`
                          : 'log income to see shares'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* SAVINGS GOALS centerpiece */}
          <div>
            <MicroLabel>Savings goals</MicroLabel>
            {goals.length === 0 ? (
              <div className="bg-white rounded-2xl p-6 text-slate-950 text-center shadow-lg shadow-black/20 mt-2">
                <PiggyBank size={24} className="text-amber-500 mx-auto mb-2" />
                <p className="text-sm text-slate-600 leading-relaxed">
                  No savings goal yet. Tell Bra Hero what you are saving for, or add one here.
                </p>
              </div>
            ) : (
              <div className="mt-2 space-y-3">
                <AnimatePresence initial={false}>
                  {goals.map((g) => (
                    <SavingsGoalCard
                      key={g.id}
                      goal={g}
                      onPatched={(patched) =>
                        setGoals((gs) => gs.map((x) => (x.id === patched.id ? patched : x)))
                      }
                      onDeleted={(id) => setGoals((gs) => gs.filter((x) => x.id !== id))}
                      onError={flashGoalError}
                    />
                  ))}
                </AnimatePresence>
              </div>
            )}

            <form
              onSubmit={createGoal}
              className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 mt-3"
            >
              <MicroLabel>New savings goal</MicroLabel>
              <div className="mt-2 space-y-2">
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="What are you saving for?"
                  maxLength={80}
                  className={field}
                />
                <div className="flex gap-2">
                  <input
                    inputMode="decimal"
                    value={newTarget}
                    onChange={(e) => setNewTarget(e.target.value.replace(/[^0-9.]/g, ''))}
                    placeholder="Target (R)"
                    aria-label="Target amount in rand"
                    className={`${field} flex-1 min-w-0`}
                  />
                  <button
                    type="submit"
                    disabled={creating || !newName.trim() || !(Number(newTarget) > 0)}
                    className="min-h-11 px-4 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
                  >
                    {creating ? '…' : 'Add'}
                  </button>
                </div>
              </div>
            </form>

            <AnimatePresence>
              {goalError && (
                <motion.p
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-xs font-bold text-red-400 text-center mt-2"
                >
                  {goalError}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* AI summary */}
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

          {/* Log this month — collapsed behind a toggle */}
          <div className="bg-white rounded-2xl text-slate-950 shadow-lg shadow-black/20 overflow-hidden">
            <button
              type="button"
              onClick={() => {
                buzz();
                setLogOpen((v) => !v);
              }}
              aria-expanded={logOpen}
              className="w-full min-h-12 px-4 py-3 flex items-center justify-between"
            >
              <span className="flex items-center gap-2 text-sm font-bold">
                <Pencil size={15} className="text-amber-500" />
                Log this month
              </span>
              <motion.span
                animate={{ rotate: logOpen ? 180 : 0 }}
                transition={{ duration: 0.2 }}
                className="text-slate-400"
              >
                <ChevronDown size={16} />
              </motion.span>
            </button>
            <AnimatePresence initial={false}>
              {logOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25, ease: 'easeOut' }}
                  className="overflow-hidden"
                >
                  <form onSubmit={submit} className="px-4 pb-4 space-y-3">
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
                      <span
                        className={
                          incomeNum - (Number(income) || 0) >= 0
                            ? 'text-emerald-600'
                            : 'text-red-600'
                        }
                      >
                        {money(
                          (Number(income) || 0) -
                            (Number(rent) || 0) -
                            (Number(food) || 0) -
                            (Number(transport) || 0) -
                            (Number(other) || 0)
                        )}
                      </span>
                    </div>

                    <button
                      type="submit"
                      disabled={saving || !income}
                      className="w-full min-h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
                    >
                      {saving ? 'Talking to Bra Hero…' : 'Save my month'}
                    </button>

                    {formError && (
                      <p className="text-xs font-bold text-red-600 text-center">{formError}</p>
                    )}

                    {justLogged && !formError && (
                      <motion.p
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="text-xs font-bold text-emerald-600 text-center"
                      >
                        Check-in saved for {monthLabel(justLogged)}.
                      </motion.p>
                    )}
                  </form>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </>
      )}
    </PanelMount>
  );
}
