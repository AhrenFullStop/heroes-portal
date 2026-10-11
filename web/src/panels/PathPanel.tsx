import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Check,
  CheckCircle2,
  ChevronDown,
  Flame,
  MoreVertical,
  Pencil,
  Plus,
  Target,
  Trash2,
  X,
} from 'lucide-react';
import { api } from '../api';
import type { Goal, GoalStep, StreakInfo } from '../../../shared/types';
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

const RING_RADIUS = 34;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

function StreakHero({ streak, todayDone }: { streak: number; todayDone: boolean }) {
  const pct = Math.min(streak / 30, 1);
  const dash = RING_CIRCUMFERENCE * pct;
  return (
    <div className="flex items-center gap-4 bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20">
      <div className="relative w-24 h-24 shrink-0">
        <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
          <circle cx="40" cy="40" r={RING_RADIUS} fill="none" stroke="#e2e8f0" strokeWidth="7" />
          <motion.circle
            cx="40"
            cy="40"
            r={RING_RADIUS}
            fill="none"
            stroke="#f59e0b"
            strokeWidth="7"
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            initial={{ strokeDashoffset: RING_CIRCUMFERENCE }}
            animate={{ strokeDashoffset: RING_CIRCUMFERENCE - dash }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="flex items-center gap-1 text-2xl font-black leading-none">
            {streak}
            <Flame size={14} className="text-amber-500" />
          </div>
          <span className="text-[8px] uppercase tracking-widest text-slate-500 mt-0.5">day streak</span>
        </div>
      </div>
      <div className="min-w-0">
        <MicroLabel>Check-in streak</MicroLabel>
        <div className="flex items-center gap-1.5 mt-1 font-black text-lg leading-tight">
          {todayDone ? (
            <>
              <CheckCircle2 size={18} className="text-emerald-500 shrink-0" />
              Today is done
            </>
          ) : (
            'Not checked in yet'
          )}
        </div>
        <p className="text-xs text-slate-500 mt-1 leading-snug">
          {todayDone
            ? 'Keep the chain alive tomorrow.'
            : 'Ask Bra Hero how today went to keep your streak.'}
        </p>
      </div>
    </div>
  );
}

const field =
  'w-full min-h-11 bg-slate-100 rounded-xl px-3 py-2.5 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400';

interface GoalCardProps {
  goal: Goal;
  /** Optimistically flip a step inside the panel's goals state. */
  onToggleStep: (goalId: number, stepId: number, next: boolean) => void;
  /** Move a goal between active and done when the server flips its status. */
  onGoalStatus: (goalId: number, status: 'active' | 'done') => void;
  onRenamed: (goalId: number, title: string) => void;
  onStepAdded: (goalId: number, step: GoalStep) => void;
  onDeleted: (goalId: number) => void;
  onError: (message: string) => void;
}

function GoalCard({
  goal,
  onToggleStep,
  onGoalStatus,
  onRenamed,
  onStepAdded,
  onDeleted,
  onError,
}: GoalCardProps) {
  const steps = goal.steps;
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const [burst, setBurst] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [addingStep, setAddingStep] = useState(false);
  const [stepValue, setStepValue] = useState('');
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);

  function toggleStep(stepId: number, next: boolean) {
    buzz();
    onToggleStep(goal.id, stepId, next);
    api
      .put<{ step: GoalStep; goal_completed: boolean }>(`/path/steps/${stepId}`, { done: next })
      .then((r) => {
        // Server flips goal status when the last step lands — celebrate first, then move it.
        if (r.goal_completed || (next && doneCount + 1 === total)) {
          buzz([20, 30, 20]);
          setBurst(true);
        }
        if (r.goal_completed) {
          window.setTimeout(() => onGoalStatus(goal.id, 'done'), 950);
        } else if (!next && goal.status === 'done') {
          onGoalStatus(goal.id, 'active');
        }
      })
      .catch(() => onToggleStep(goal.id, stepId, !next)); // roll back
  }

  function startRename() {
    setMenuOpen(false);
    setRenameValue(goal.title);
    setRenaming(true);
  }

  async function submitRename(e: React.FormEvent) {
    e.preventDefault();
    const title = renameValue.trim();
    if (busy || !title || title === goal.title) {
      setRenaming(false);
      return;
    }
    setBusy(true);
    try {
      const r = await patch<{ goal: { id: number; title: string } }>(`/path/goals/${goal.id}`, {
        title,
      });
      buzz(10);
      onRenamed(goal.id, r.goal.title);
      setRenaming(false);
    } catch {
      onError('Could not rename the goal. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function submitStep(e: React.FormEvent) {
    e.preventDefault();
    const label = stepValue.trim();
    if (busy || !label) return;
    setBusy(true);
    try {
      const r = await api.post<{ step: GoalStep }>(`/path/goals/${goal.id}/steps`, { label });
      buzz(10);
      onStepAdded(goal.id, r.step);
      setStepValue('');
    } catch {
      onError('Could not add the step. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function deleteGoal() {
    if (busy) return;
    setBusy(true);
    api
      .del<{ ok: boolean }>(`/path/goals/${goal.id}`)
      .then(() => {
        buzz(10);
        onDeleted(goal.id);
      })
      .catch(() => {
        setBusy(false);
        setArmed(false);
        onError('Could not delete the goal. Try again.');
      });
  }

  const isTemp = goal.id < 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: -8 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className="relative bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 overflow-hidden"
    >
      {/* amber dot burst when every step is done */}
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

      <div className="flex items-start justify-between gap-2">
        <div className="flex items-start gap-2 min-w-0 flex-1">
          <Target size={16} className="text-amber-500 shrink-0 mt-0.5" />
          {renaming ? (
            <form onSubmit={submitRename} className="flex flex-1 min-w-0 items-center gap-1.5">
              <input
                autoFocus
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                maxLength={120}
                aria-label="Goal title"
                className={field}
              />
              <button
                type="submit"
                disabled={busy || !renameValue.trim()}
                aria-label="Save title"
                className="w-11 h-11 shrink-0 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 transition-colors disabled:opacity-40"
              >
                <Check size={16} />
              </button>
              <button
                type="button"
                onClick={() => setRenaming(false)}
                aria-label="Cancel rename"
                className="w-11 h-11 shrink-0 rounded-xl text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </form>
          ) : (
            <h3 className="font-bold text-sm leading-snug break-words">{goal.title}</h3>
          )}
        </div>
        {!renaming && (
          <div className="flex items-center gap-1 shrink-0">
            <MicroLabel>
              {doneCount}/{total} done
            </MicroLabel>
            {!isTemp && (
              <button
                type="button"
                onClick={() => {
                  buzz();
                  setArmed(false);
                  setMenuOpen((v) => !v);
                }}
                aria-label="Goal actions"
                aria-expanded={menuOpen}
                className="w-11 h-11 -mr-2 -mt-1 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
              >
                <MoreVertical size={16} />
              </button>
            )}
          </div>
        )}
      </div>

      {total > 0 && (
        <div className="mt-3 h-1.5 rounded-full bg-slate-200 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-amber-500"
            initial={false}
            animate={{ width: `${(doneCount / total) * 100}%` }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
          />
        </div>
      )}

      <div className="mt-2 space-y-0.5">
        {steps.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => toggleStep(s.id, !s.done)}
            className="w-full min-h-11 flex items-center gap-3 px-2 py-1.5 rounded-xl text-left hover:bg-slate-50 active:bg-amber-50 transition-colors"
          >
            <motion.span
              initial={false}
              animate={s.done ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ duration: 0.25 }}
              className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                s.done ? 'bg-amber-500 border-amber-500' : 'border-slate-300'
              }`}
            >
              <AnimatePresence>
                {s.done && (
                  <motion.span
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex"
                  >
                    <CheckCircle2 size={13} className="text-slate-950" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.span>
            <span
              className={`text-sm transition-colors ${
                s.done ? 'line-through text-slate-400' : 'text-slate-800'
              }`}
            >
              {s.label}
            </span>
          </button>
        ))}
      </div>

      {/* Add-step inline input */}
      <AnimatePresence initial={false}>
        {addingStep && !renaming && (
          <motion.form
            onSubmit={submitStep}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="flex items-center gap-1.5 mt-2">
              <input
                autoFocus
                value={stepValue}
                onChange={(e) => setStepValue(e.target.value)}
                placeholder="Next step…"
                maxLength={120}
                aria-label="New step"
                className="min-h-11 flex-1 min-w-0 bg-slate-100 rounded-xl px-3 text-sm text-slate-950 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
              />
              <button
                type="submit"
                disabled={busy || !stepValue.trim()}
                aria-label="Add step"
                className="w-11 h-11 shrink-0 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center hover:bg-amber-400 transition-colors disabled:opacity-40"
              >
                <Plus size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  setAddingStep(false);
                  setStepValue('');
                }}
                aria-label="Close step input"
                className="w-11 h-11 shrink-0 rounded-xl text-slate-400 flex items-center justify-center hover:bg-slate-100 transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Overflow menu / delete confirm */}
      <AnimatePresence initial={false}>
        {(menuOpen || armed) && !renaming && !addingStep && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            {armed ? (
              <div className="mt-3 flex items-center gap-2 rounded-xl bg-red-50 px-3 py-2">
                <span className="text-xs font-bold text-red-600 flex-1">Delete this goal?</span>
                <button
                  type="button"
                  onClick={deleteGoal}
                  disabled={busy}
                  className="min-h-9 px-3 rounded-lg bg-red-600 text-white text-xs font-black hover:bg-red-500 transition-colors disabled:opacity-40"
                >
                  Delete
                </button>
                <button
                  type="button"
                  onClick={() => setArmed(false)}
                  className="min-h-9 px-3 rounded-lg bg-white text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-colors"
                >
                  Keep
                </button>
              </div>
            ) : (
              <div className="mt-3 flex items-center gap-2">
                {goal.status === 'active' && (
                  <>
                    <button
                      type="button"
                      onClick={startRename}
                      className="min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black hover:bg-slate-200 transition-colors"
                    >
                      <Pencil size={13} />
                      Rename
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        setAddingStep(true);
                      }}
                      className="min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-black hover:bg-slate-200 transition-colors"
                    >
                      <Plus size={13} />
                      Add step
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setArmed(true)}
                  className="min-h-11 flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-red-50 text-red-600 text-xs font-black hover:bg-red-100 transition-colors"
                >
                  <Trash2 size={13} />
                  Delete
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function PathPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);
  const errTimer = useRef<number | null>(null);

  // New-goal form
  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [stepsText, setStepsText] = useState('');
  const [creating, setCreating] = useState(false);

  // Completed section
  const [showCompleted, setShowCompleted] = useState(false);

  useEffect(() => {
    let alive = true;
    Promise.all([api.get<{ goals: Goal[] }>('/path/goals'), api.get<StreakInfo>('/path/streak')])
      .then(([g, s]) => {
        if (!alive) return;
        setGoals(g.goals);
        setStreak(s);
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

  function flashError(message: string) {
    setFlash(message);
    if (errTimer.current) window.clearTimeout(errTimer.current);
    errTimer.current = window.setTimeout(() => setFlash(null), 4000);
  }

  /** Optimistic step flip with rollback handled by GoalCard re-calling with `next` flipped. */
  function toggleStep(goalId: number, stepId: number, next: boolean) {
    setGoals((gs) =>
      gs.map((g) =>
        g.id === goalId
          ? { ...g, steps: g.steps.map((s) => (s.id === stepId ? { ...s, done: next } : s)) }
          : g
      )
    );
  }

  /** Keep the completed section in sync with server-driven goal status flips. */
  function applyGoalStatus(goalId: number, status: 'active' | 'done') {
    setGoals((gs) =>
      gs.map((g) =>
        g.id === goalId
          ? { ...g, status, done_at: status === 'done' ? new Date().toISOString() : null }
          : g
      )
    );
  }

  async function createGoal(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = title.trim();
    if (creating || !cleanTitle) return;
    const labels = stepsText
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 20);

    buzz();
    setCreating(true);

    // Optimistic insert with temp ids until the server responds.
    const tempId = -Date.now();
    const tempGoal: Goal = {
      id: tempId,
      title: cleanTitle,
      status: 'active',
      created_at: new Date().toISOString(),
      done_at: null,
      steps: labels.map((label, i) => ({
        id: tempId - i - 1,
        goal_id: tempId,
        label,
        done: false,
        position: i,
      })),
    };
    setGoals((gs) => [tempGoal, ...gs]);
    setTitle('');
    setStepsText('');

    try {
      const r = await api.post<{ goal: Goal }>('/path/goals', { title: cleanTitle });
      const real = r.goal;
      setGoals((gs) => gs.map((g) => (g.id === tempId ? { ...real, steps: g.steps } : g)));

      for (let i = 0; i < labels.length; i++) {
        try {
          const sr = await api.post<{ step: GoalStep }>(`/path/goals/${real.id}/steps`, {
            label: labels[i],
          });
          const tempStepId = tempId - i - 1;
          setGoals((gs) =>
            gs.map((g) =>
              g.id === real.id
                ? { ...g, steps: g.steps.map((s) => (s.id === tempStepId ? sr.step : s)) }
                : g
            )
          );
        } catch {
          // Drop the optimistic step that failed to persist.
          const tempStepId = tempId - i - 1;
          setGoals((gs) =>
            gs.map((g) =>
              g.id === real.id ? { ...g, steps: g.steps.filter((s) => s.id !== tempStepId) } : g
            )
          );
        }
      }
      setFormOpen(false);
    } catch {
      setGoals((gs) => gs.filter((g) => g.id !== tempId));
      flashError('Could not create the goal. Try again.');
    } finally {
      setCreating(false);
    }
  }

  const active = goals.filter((g) => g.status === 'active');
  const completed = goals.filter((g) => g.status === 'done');

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Target} label="My Path" onDismiss={onDismiss} />

      <StreakHero streak={streak?.streak ?? 0} todayDone={streak?.today_done ?? false} />

      {/* New goal */}
      {!formOpen ? (
        <button
          type="button"
          onClick={() => {
            buzz();
            setFormOpen(true);
          }}
          className="w-full min-h-12 rounded-2xl border-2 border-dashed border-slate-700 text-slate-300 font-bold text-sm flex items-center justify-center gap-2 hover:border-amber-500/60 hover:text-amber-400 transition-colors"
        >
          <Plus size={16} />
          New goal
        </button>
      ) : (
        <form
          onSubmit={createGoal}
          className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 space-y-2"
        >
          <MicroLabel>New goal</MicroLabel>
          <input
            autoFocus
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you want to achieve?"
            maxLength={120}
            aria-label="Goal title"
            className={field}
          />
          <input
            value={stepsText}
            onChange={(e) => setStepsText(e.target.value)}
            placeholder="Steps, comma-separated (optional)"
            maxLength={200}
            aria-label="Steps, comma-separated"
            className={field}
          />
          <div className="flex gap-2 pt-1">
            <button
              type="submit"
              disabled={creating || !title.trim()}
              className="flex-1 min-h-11 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
            >
              {creating ? 'Adding…' : 'Add goal'}
            </button>
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setTitle('');
                setStepsText('');
              }}
              disabled={creating}
              className="min-h-11 px-4 rounded-xl bg-slate-100 text-slate-600 font-bold text-sm hover:bg-slate-200 transition-colors disabled:opacity-40"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <MicroLabel>Your goals</MicroLabel>

      {!loaded ? (
        <PanelState busy>Loading your path…</PanelState>
      ) : error ? (
        <PanelState>Could not load your goals. Pull down to try again.</PanelState>
      ) : active.length === 0 ? (
        <div className="bg-white rounded-2xl p-6 text-slate-950 text-center shadow-lg shadow-black/20">
          <Flame size={24} className="text-amber-500 mx-auto mb-2" />
          <p className="text-sm text-slate-600 leading-relaxed">
            No goals yet. Ask Bra Hero in the chat — say{' '}
            <span className="font-bold text-slate-900">“I want to get my driver licence”</span>,
            or add one above.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {active.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                onToggleStep={toggleStep}
                onGoalStatus={applyGoalStatus}
                onRenamed={(id, newTitle) =>
                  setGoals((gs) => gs.map((x) => (x.id === id ? { ...x, title: newTitle } : x)))
                }
                onStepAdded={(id, step) =>
                  setGoals((gs) =>
                    gs.map((x) => (x.id === id ? { ...x, steps: [...x.steps, step] } : x))
                  )
                }
                onDeleted={(id) => setGoals((gs) => gs.filter((x) => x.id !== id))}
                onError={flashError}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Completed goals — collapsed by default */}
      {completed.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => {
              buzz();
              setShowCompleted((v) => !v);
            }}
            aria-expanded={showCompleted}
            className="w-full min-h-12 px-4 rounded-2xl bg-slate-900/60 border border-slate-800 flex items-center justify-between text-slate-300 hover:border-slate-700 transition-colors"
          >
            <span className="flex items-center gap-2 text-sm font-bold">
              <CheckCircle2 size={16} className="text-emerald-500" />
              Completed goals ({completed.length})
            </span>
            <motion.span
              animate={{ rotate: showCompleted ? 180 : 0 }}
              transition={{ duration: 0.2 }}
            >
              <ChevronDown size={16} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {showCompleted && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="overflow-hidden"
              >
                <div className="mt-3 space-y-3">
                  <AnimatePresence initial={false}>
                    {completed.map((g) => (
                      <GoalCard
                        key={g.id}
                        goal={g}
                        onToggleStep={toggleStep}
                        onGoalStatus={applyGoalStatus}
                        onRenamed={(id, newTitle) =>
                          setGoals((gs) =>
                            gs.map((x) => (x.id === id ? { ...x, title: newTitle } : x))
                          )
                        }
                        onStepAdded={(id, step) =>
                          setGoals((gs) =>
                            gs.map((x) => (x.id === id ? { ...x, steps: [...x.steps, step] } : x))
                          )
                        }
                        onDeleted={(id) => setGoals((gs) => gs.filter((x) => x.id !== id))}
                        onError={flashError}
                      />
                    ))}
                  </AnimatePresence>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {flash && (
          <motion.p
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-xs font-bold text-red-400 text-center"
          >
            {flash}
          </motion.p>
        )}
      </AnimatePresence>
    </PanelMount>
  );
}
