import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { CheckCircle2, Flame, Target } from 'lucide-react';
import { api } from '../api';
import type { Goal, StreakInfo } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';

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

interface GoalCardProps {
  goal: Goal;
  /** Optimistically flip a step inside the panel's goals state. */
  onToggleStep: (goalId: number, stepId: number, next: boolean) => void;
}

function GoalCard({ goal, onToggleStep }: GoalCardProps) {
  const steps = goal.steps;
  const total = steps.length;
  const doneCount = steps.filter((s) => s.done).length;
  const [burst, setBurst] = useState(false);

  function toggleStep(stepId: number, next: boolean) {
    buzz();
    onToggleStep(goal.id, stepId, next);
    api
      .put<{ goal_completed: boolean }>(`/path/steps/${stepId}`, { done: next })
      .then((r) => {
        // Server flips goal status when the last step lands — celebrate once.
        if (r.goal_completed || (next && doneCount + 1 === total)) {
          buzz([20, 30, 20]);
          setBurst(true);
        }
      })
      .catch(() => onToggleStep(goal.id, stepId, !next)); // roll back
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
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
        <div className="flex items-start gap-2 min-w-0">
          <Target size={16} className="text-amber-500 shrink-0 mt-0.5" />
          <h3 className="font-bold text-sm leading-snug break-words">{goal.title}</h3>
        </div>
        <MicroLabel>
          {doneCount}/{total} done
        </MicroLabel>
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
    </motion.div>
  );
}

export default function PathPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

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

  const active = goals.filter((g) => g.status === 'active');

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Target} label="My Path" onDismiss={onDismiss} />

      <StreakHero streak={streak?.streak ?? 0} todayDone={streak?.today_done ?? false} />

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
            <span className="font-bold text-slate-900">“I want to get my driver licence”</span>.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {active.map((g) => (
            <GoalCard key={g.id} goal={g} onToggleStep={toggleStep} />
          ))}
        </div>
      )}
    </PanelMount>
  );
}
