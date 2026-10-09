import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import type { Workout, WorkoutLog } from '../../../shared/types';

export const moveRouter = Router();

moveRouter.use(requireAuth);

moveRouter.get('/workouts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q<Workout>(
      'SELECT id, title, description, level, duration_min FROM workouts ORDER BY level, sort, id'
    );
    res.json({ workouts: rows });
  } catch (err) { next(err); }
});

moveRouter.get('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await q<WorkoutLog>(
      `SELECT id, workout_id, note, done_on::text FROM workout_logs
       WHERE user_id = $1 AND done_on >= (CURRENT_DATE - INTERVAL '29 days')
       ORDER BY done_on DESC LIMIT 60`,
      [req.user!.id]
    );
    const weekRes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM workout_logs
       WHERE user_id = $1 AND done_on >= (CURRENT_DATE - INTERVAL '6 days')`,
      [req.user!.id]
    );
    res.json({ logs, this_week: weekRes.rows[0]?.n ?? 0 });
  } catch (err) { next(err); }
});

moveRouter.post('/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workoutId = req.body?.workout_id != null ? Number(req.body.workout_id) : null;
    const note = (req.body?.note ?? '').toString().trim() || null;
    if (workoutId != null) {
      const w = await pool.query('SELECT id FROM workouts WHERE id = $1', [workoutId]);
      if (w.rows.length === 0) { res.status(404).json({ error: 'Workout not found' }); return; }
    }
    if (workoutId == null && !note) { res.status(400).json({ error: 'workout_id or note required' }); return; }
    const r = await pool.query(
      'INSERT INTO workout_logs (user_id, workout_id, note) VALUES ($1, $2, $3) RETURNING id, workout_id, note, done_on::text',
      [req.user!.id, workoutId, note]
    );
    const weekRes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM workout_logs
       WHERE user_id = $1 AND done_on >= (CURRENT_DATE - INTERVAL '6 days')`,
      [req.user!.id]
    );
    res.status(201).json({ log: r.rows[0], this_week: weekRes.rows[0]?.n ?? 0 });
  } catch (err) { next(err); }
});
