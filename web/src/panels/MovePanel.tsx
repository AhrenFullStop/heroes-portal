import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { CheckCircle2, Clock, Dumbbell, Flame } from 'lucide-react';
import { api } from '../api';
import type { Workout, WorkoutLog } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';

function inLast7d(dateStr: string): boolean {
  const t = new Date(`${dateStr}T00:00:00`).getTime();
  if (Number.isNaN(t)) return false;
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setHours(0, 0, 0, 0);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  return t >= sevenDaysAgo.getTime();
}

export default function MovePanel({ onDismiss }: { onDismiss?: () => void }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [logs, setLogs] = useState<WorkoutLog[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [loggedIds, setLoggedIds] = useState<Set<number>>(new Set());

  useEffect(() => {
    let alive = true;
    Promise.all([
      api.get<{ workouts: Workout[] }>('/move/workouts'),
      api.get<{ logs: WorkoutLog[] }>('/move/logs?limit=30'),
    ])
      .then(([w, l]) => {
        if (!alive) return;
        setWorkouts(w.workouts);
        setLogs(l.logs);
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

  // Weekly count, computed client-side from the last 7 days of logs.
  const weekCount = logs.filter((l) => inLast7d(l.done_on)).length;

  async function logWorkout(w: Workout) {
    if (loggedIds.has(w.id)) return;
    buzz(10);
    setLoggedIds((s) => new Set(s).add(w.id));
    try {
      const r = await api.post<{ log: WorkoutLog }>('/move/logs', { workout_id: w.id });
      setLogs((ls) => [r.log, ...ls]);
    } catch {
      setLoggedIds((s) => {
        const next = new Set(s);
        next.delete(w.id);
        return next;
      });
    }
  }

  return (
    <PanelMount className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <PanelHeader icon={Dumbbell} label="Move" onDismiss={onDismiss} />

      {/* This-week banner */}
      <div className="bg-white rounded-2xl px-4 py-4 text-slate-950 shadow-lg shadow-black/20 flex items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-amber-500 flex items-center justify-center shrink-0">
          <Flame size={22} className="text-slate-950" />
        </div>
        <div>
          <div className="text-2xl font-black leading-none">
            {weekCount}
            <span className="text-sm font-bold text-slate-400 ml-1">this week</span>
          </div>
          <MicroLabel>{weekCount === 1 ? 'session logged' : 'sessions logged'}</MicroLabel>
        </div>
      </div>

      {!loaded ? (
        <PanelState busy>Loading workouts…</PanelState>
      ) : error ? (
        <PanelState>Could not load workouts. Try again.</PanelState>
      ) : workouts.length === 0 ? (
        <PanelState>No workouts listed yet.</PanelState>
      ) : (
        <div className="space-y-3">
          {workouts.map((w) => {
            const logged = loggedIds.has(w.id);
            return (
              <motion.div
                layout
                key={w.id}
                className={`bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20 ${
                  logged ? 'ring-2 ring-amber-500' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm">{w.title}</span>
                      <span
                        className={`text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full ${
                          w.level === 'gym' ? 'bg-sky-100 text-sky-700' : 'bg-slate-200 text-slate-600'
                        }`}
                      >
                        {w.level}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[11px] text-slate-500 mt-0.5">
                      <Clock size={11} />
                      {w.duration_min} min
                    </div>
                    {w.description && (
                      <p className="text-xs text-slate-600 leading-relaxed mt-1.5">{w.description}</p>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => logWorkout(w)}
                    disabled={logged}
                    className={`min-h-11 min-w-11 px-3 rounded-xl text-sm font-black shrink-0 transition-colors flex items-center gap-1.5 ${
                      logged
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-500 text-slate-950 hover:bg-amber-400'
                    }`}
                  >
                    {logged ? (
                      <>
                        <CheckCircle2 size={16} />
                        Logged
                      </>
                    ) : (
                      'Log it'
                    )}
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </PanelMount>
  );
}
