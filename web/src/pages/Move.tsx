import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Dumbbell, Home, Building2, Check } from 'lucide-react';
import { api } from '../api';
import type { Workout, WorkoutLog } from '../../../shared/types';

export default function Move() {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [weekCount, setWeekCount] = useState(0);
  const [loggedToday, setLoggedToday] = useState<Set<number>>(new Set());
  const [busyId, setBusyId] = useState<number | null>(null);

  async function load() {
    const [w, l] = await Promise.all([
      api.get<{ workouts: Workout[] }>('/move/workouts'),
      api.get<{ logs: WorkoutLog[]; this_week: number }>('/move/logs'),
    ]);
    setWorkouts(w.workouts);
    setLogs(l.logs);
    setWeekCount(l.this_week);
    const today = new Date().toISOString().slice(0, 10);
    setLoggedToday(new Set(l.logs.filter((x) => x.done_on === today && x.workout_id != null).map((x) => x.workout_id!)));
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function log(workoutId: number) {
    setBusyId(workoutId);
    try {
      const res = await api.post<{ this_week: number }>('/move/logs', { workout_id: workoutId });
      setWeekCount(res.this_week);
      await load();
    } finally {
      setBusyId(null);
    }
  }

  const home = workouts.filter((w) => w.level === 'home');
  const gym = workouts.filter((w) => w.level === 'gym');
  const today = new Date().toISOString().slice(0, 10);
  const recent = logs.slice(0, 7);

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-black text-xl">Move</h1>
          <p className="text-slate-400 text-sm mt-0.5">Strong body, strong decisions.</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-center">
          <div className="text-2xl font-black text-amber-500">{weekCount}</div>
          <div className="text-[9px] uppercase tracking-widest text-slate-500">this week</div>
        </div>
      </div>

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
          <Home size={13} /> No equipment
        </h2>
        <div className="space-y-2.5">
          {home.map((w) => (
            <WorkoutCard key={w.id} workout={w} done={loggedToday.has(w.id)} busy={busyId === w.id} onLog={() => log(w.id)} today={today} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
          <Building2 size={13} /> Gym
        </h2>
        <div className="space-y-2.5">
          {gym.map((w) => (
            <WorkoutCard key={w.id} workout={w} done={loggedToday.has(w.id)} busy={busyId === w.id} onLog={() => log(w.id)} today={today} />
          ))}
        </div>
      </section>

      {recent.length > 0 && (
        <section>
          <h2 className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">Recent sessions</h2>
          <div className="space-y-1.5">
            {recent.map((l) => (
              <div key={l.id} className="flex items-center gap-2 text-xs text-slate-400 bg-slate-900/60 border border-slate-800/60 rounded-xl px-3 py-2">
                <Check size={13} className="text-emerald-500" />
                <span className="font-semibold text-slate-300">{l.done_on}</span>
                <span>{workouts.find((w) => w.id === l.workout_id)?.title ?? l.note ?? 'Session'}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function WorkoutCard({ workout, done, busy, onLog, today }: { workout: Workout; done: boolean; busy: boolean; onLog: () => void; today: string }) {
  return (
    <motion.div layout className={`bg-slate-900 border rounded-2xl p-4 ${done ? 'border-emerald-800/60' : 'border-slate-800'}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 font-bold text-sm">
            <Dumbbell size={15} className="text-amber-500" />
            {workout.title}
            <span className="text-[10px] text-slate-500 font-normal">{workout.duration_min} min</span>
          </div>
          <p className="text-xs text-slate-400 mt-1.5 leading-relaxed">{workout.description}</p>
        </div>
        <button
          onClick={onLog}
          disabled={busy || done}
          className={`shrink-0 text-[10px] font-bold uppercase tracking-wider rounded-xl px-3 py-2 transition-colors ${
            done
              ? 'bg-emerald-900/40 text-emerald-400 border border-emerald-900/50'
              : 'bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950'
          }`}
        >
          {done ? 'Logged today' : busy ? '…' : 'Log it'}
        </button>
      </div>
    </motion.div>
  );
}
