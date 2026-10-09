import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Circle, Plus, Target, CalendarCheck, Trash2 } from 'lucide-react';
import { api } from '../api';
import type { Goal, Commitment, StreakInfo } from '../../../shared/types';

function StreakRing({ streak, doneToday }: { streak: number; doneToday: boolean }) {
  const pct = Math.min(streak / 30, 1);
  const circumference = 2 * Math.PI * 34;
  return (
    <div className="relative w-24 h-24">
      <svg viewBox="0 0 80 80" className="w-24 h-24 -rotate-90">
        <circle cx="40" cy="40" r="34" fill="none" stroke="#1e293b" strokeWidth="7" />
        <motion.circle
          cx="40" cy="40" r="34" fill="none"
          stroke="#f59e0b" strokeWidth="7" strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference * (1 - pct) }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-black text-amber-500">{streak}</span>
        <span className="text-[9px] uppercase tracking-widest text-slate-400">day streak</span>
      </div>
      {doneToday && (
        <div className="absolute -top-1 -right-1 text-emerald-400">
          <CheckCircle2 size={18} />
        </div>
      )}
    </div>
  );
}

export default function Path() {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [commitments, setCommitments] = useState<Commitment[]>([]);
  const [streakInfo, setStreakInfo] = useState<StreakInfo | null>(null);
  const [newGoal, setNewGoal] = useState('');
  const [newCommitment, setNewCommitment] = useState('');
  const [tab, setTab] = useState<'goals' | 'commitments'>('goals');

  async function load() {
    const [g, c, s] = await Promise.all([
      api.get<{ goals: Goal[] }>('/path/goals'),
      api.get<{ commitments: Commitment[] }>('/path/commitments'),
      api.get<StreakInfo>('/path/streak'),
    ]);
    setGoals(g.goals);
    setCommitments(c.commitments);
    setStreakInfo(s);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function addGoal(e: React.FormEvent) {
    e.preventDefault();
    if (!newGoal.trim()) return;
    await api.post('/path/goals', { title: newGoal.trim() });
    setNewGoal('');
    load();
  }

  async function toggleStep(stepId: number, done: boolean) {
    await api.put(`/path/steps/${stepId}`, { done });
    load();
  }

  async function archiveGoal(id: number) {
    await api.del(`/path/goals/${id}`);
    load();
  }

  async function addCommitment(e: React.FormEvent) {
    e.preventDefault();
    if (!newCommitment.trim()) return;
    await api.post('/path/commitments', { text: newCommitment.trim() });
    setNewCommitment('');
    load();
  }

  async function markCommitment(id: number, status: 'kept' | 'missed') {
    await api.put(`/path/commitments/${id}`, { status });
    load();
  }

  const activeGoals = goals.filter((g) => g.status === 'active');
  const doneGoals = goals.filter((g) => g.status === 'done');

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <StreakRing streak={streakInfo?.streak ?? 0} doneToday={streakInfo?.today_done ?? false} />
        <div>
          <h1 className="font-black text-xl">My Path</h1>
          <p className="text-slate-400 text-sm mt-1">
            {streakInfo?.today_done
              ? 'Checked in today. Keep the chain alive.'
              : 'No check-in yet today. Tell Bra Hero how today went.'}
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setTab('goals')}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${tab === 'goals' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
        >
          Goals
        </button>
        <button
          onClick={() => setTab('commitments')}
          className={`flex-1 rounded-xl px-3 py-2 text-sm font-bold transition-colors ${tab === 'commitments' ? 'bg-amber-500 text-slate-950' : 'bg-slate-900 text-slate-400 border border-slate-800'}`}
        >
          Commitments
        </button>
      </div>

      {tab === 'goals' ? (
        <>
          <form onSubmit={addGoal} className="flex gap-2">
            <input
              value={newGoal}
              onChange={(e) => setNewGoal(e.target.value)}
              placeholder="New goal…"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
            <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl px-3" aria-label="Add goal">
              <Plus size={18} />
            </button>
          </form>

          {activeGoals.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">
              No active goals. Tell Bra Hero what you're chasing and he'll break it into steps.
            </p>
          )}

          {activeGoals.map((goal) => (
            <motion.div key={goal.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2 font-bold text-sm">
                  <Target size={16} className="text-amber-500 shrink-0" />
                  {goal.title}
                </div>
                <button onClick={() => archiveGoal(goal.id)} className="text-slate-600 hover:text-red-400" aria-label="Archive goal">
                  <Trash2 size={15} />
                </button>
              </div>
              <div className="mt-3 space-y-2">
                {goal.steps.map((step) => (
                  <button
                    key={step.id}
                    onClick={() => toggleStep(step.id, !step.done)}
                    className="flex items-center gap-2.5 w-full text-left text-sm"
                  >
                    {step.done ? (
                      <CheckCircle2 size={17} className="text-emerald-400 shrink-0" />
                    ) : (
                      <Circle size={17} className="text-slate-600 shrink-0" />
                    )}
                    <span className={step.done ? 'text-slate-500 line-through' : 'text-slate-200'}>{step.label}</span>
                  </button>
                ))}
                {goal.steps.length === 0 && <p className="text-slate-500 text-xs">No steps yet - ask Bra Hero for a plan.</p>}
              </div>
            </motion.div>
          ))}

          {doneGoals.length > 0 && (
            <div>
              <h3 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-2">Completed</h3>
              <div className="space-y-2">
                {doneGoals.map((g) => (
                  <div key={g.id} className="flex items-center gap-2 text-sm text-slate-500 bg-slate-900/50 border border-slate-800/50 rounded-xl px-4 py-2.5">
                    <CheckCircle2 size={15} className="text-emerald-500" />
                    <span className="line-through">{g.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <form onSubmit={addCommitment} className="flex gap-2">
            <input
              value={newCommitment}
              onChange={(e) => setNewCommitment(e.target.value)}
              placeholder="I will…"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
            <button type="submit" className="bg-amber-500 hover:bg-amber-400 text-slate-950 rounded-xl px-3" aria-label="Add commitment">
              <Plus size={18} />
            </button>
          </form>

          {commitments.length === 0 && (
            <p className="text-slate-500 text-sm text-center py-6">
              No commitments yet. Promise something to your future self.
            </p>
          )}

          {commitments.map((c) => (
            <div key={c.id} className={`bg-slate-900 border rounded-2xl p-4 ${c.status === 'open' ? 'border-slate-800' : 'border-slate-800/50'}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2 text-sm">
                  <CalendarCheck size={16} className={c.status === 'kept' ? 'text-emerald-400' : c.status === 'missed' ? 'text-red-400' : 'text-amber-500'} />
                  <span className={c.status === 'kept' ? 'text-slate-500 line-through' : ''}>{c.text}</span>
                </div>
                {c.status === 'open' && (
                  <div className="flex gap-1.5 shrink-0">
                    <button onClick={() => markCommitment(c.id, 'kept')} className="text-[10px] font-bold uppercase bg-emerald-900/40 text-emerald-400 border border-emerald-900/50 rounded-lg px-2 py-1">
                      Kept
                    </button>
                    <button onClick={() => markCommitment(c.id, 'missed')} className="text-[10px] font-bold uppercase bg-red-950/40 text-red-400 border border-red-900/50 rounded-lg px-2 py-1">
                      Missed
                    </button>
                  </div>
                )}
              </div>
              {c.due_date && <p className="text-xs text-slate-500 mt-2 ml-6">Due {c.due_date}</p>}
            </div>
          ))}
        </>
      )}
    </div>
  );
}
