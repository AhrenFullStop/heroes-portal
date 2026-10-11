import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import type { Goal, GoalStep, Commitment, StreakInfo, Checkin } from '../../../shared/types';

export const pathRouter = Router();

pathRouter.use(requireAuth);

// Goals with steps
pathRouter.get('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalsRes = await pool.query(
      `SELECT id, title, status, created_at::text, done_at::text FROM goals
       WHERE user_id = $1 ORDER BY (status = 'active') DESC, created_at DESC`,
      [req.user!.id]
    );
    const goals: Goal[] = [];
    for (const g of goalsRes.rows) {
      const steps = await q<GoalStep>(
        'SELECT id, goal_id, label, done, position FROM goal_steps WHERE goal_id = $1 ORDER BY position, id',
        [g.id]
      );
      goals.push({ ...g, steps });
    }
    res.json({ goals });
  } catch (err) { next(err); }
});

pathRouter.post('/goals', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const title = (req.body?.title ?? '').toString().trim();
    if (!title) { res.status(400).json({ error: 'title required' }); return; }
    const r = await pool.query(
      'INSERT INTO goals (user_id, title) VALUES ($1, $2) RETURNING id, title, status, created_at::text, done_at::text',
      [req.user!.id, title]
    );
    res.status(201).json({ goal: { ...r.rows[0], steps: [] } });
  } catch (err) { next(err); }
});

pathRouter.post('/goals/:id/steps', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const goalId = Number(req.params.id);
    const label = (req.body?.label ?? '').toString().trim();
    if (!label) { res.status(400).json({ error: 'label required' }); return; }
    const own = await pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [goalId, req.user!.id]);
    if (own.rows.length === 0) { res.status(404).json({ error: 'Goal not found' }); return; }
    const posRes = await pool.query('SELECT COALESCE(MAX(position), -1) + 1 AS n FROM goal_steps WHERE goal_id = $1', [goalId]);
    const r = await pool.query(
      'INSERT INTO goal_steps (goal_id, label, position) VALUES ($1, $2, $3) RETURNING id, goal_id, label, done, position',
      [goalId, label, posRes.rows[0].n]
    );
    res.status(201).json({ step: r.rows[0] });
  } catch (err) { next(err); }
});

pathRouter.put('/steps/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stepId = Number(req.params.id);
    const done = Boolean(req.body?.done);
    const r = await pool.query(
      `UPDATE goal_steps SET done = $1
       WHERE id = $2 AND goal_id IN (SELECT id FROM goals WHERE user_id = $3)
       RETURNING id, goal_id, label, done, position`,
      [done, stepId, req.user!.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Step not found' }); return; }
    const goalId = r.rows[0].goal_id;
    const remaining = await pool.query('SELECT COUNT(*)::int AS n FROM goal_steps WHERE goal_id = $1 AND done = false', [goalId]);
    let goalCompleted = false;
    if (done && remaining.rows[0].n === 0) {
      await pool.query(`UPDATE goals SET status = 'done', done_at = now() WHERE id = $1 AND status = 'active'`, [goalId]);
      goalCompleted = true;
    } else if (!done) {
      await pool.query(`UPDATE goals SET status = 'active', done_at = NULL WHERE id = $1 AND status = 'done'`, [goalId]);
    }
    res.json({ step: r.rows[0], goal_completed: goalCompleted });
  } catch (err) { next(err); }
});

pathRouter.patch('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const title = (req.body?.title ?? '').toString().trim();
    if (!title) { res.status(400).json({ error: 'title required' }); return; }
    const r = await pool.query(
      "UPDATE goals SET title = $1 WHERE id = $2 AND user_id = $3 AND status = 'active' RETURNING id, title",
      [title, Number(req.params.id), req.user!.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Goal not found' }); return; }
    res.json({ goal: r.rows[0] });
  } catch (err) { next(err); }
});

pathRouter.delete('/goals/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await pool.query('UPDATE goals SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id', ['archived', Number(req.params.id), req.user!.id]);
    if (r.rows.length === 0) { res.status(404).json({ error: 'Goal not found' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

// Commitments
pathRouter.get('/commitments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q<Commitment>(
      `SELECT id, text, due_date::text, status, created_at::text FROM commitments
       WHERE user_id = $1 ORDER BY (status = 'open') DESC, created_at DESC LIMIT 30`,
      [req.user!.id]
    );
    res.json({ commitments: rows });
  } catch (err) { next(err); }
});

pathRouter.post('/commitments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const text = (req.body?.text ?? '').toString().trim();
    const dueDate = (req.body?.due_date ?? null) as string | null;
    if (!text) { res.status(400).json({ error: 'text required' }); return; }
    const r = await pool.query(
      'INSERT INTO commitments (user_id, text, due_date) VALUES ($1, $2, $3) RETURNING id, text, due_date::text, status, created_at::text',
      [req.user!.id, text, dueDate]
    );
    res.status(201).json({ commitment: r.rows[0] });
  } catch (err) { next(err); }
});

pathRouter.put('/commitments/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const status = (req.body?.status ?? '').toString();
    if (!['open', 'kept', 'missed'].includes(status)) { res.status(400).json({ error: 'invalid status' }); return; }
    const r = await pool.query(
      'UPDATE commitments SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING id, text, due_date::text, status, created_at::text',
      [status, Number(req.params.id), req.user!.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Commitment not found' }); return; }
    res.json({ commitment: r.rows[0] });
  } catch (err) { next(err); }
});

// Check-ins + streak
pathRouter.get('/streak', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await q<Checkin>(
      `SELECT checkin_date::text, mood, note, source FROM checkins
       WHERE user_id = $1 ORDER BY checkin_date DESC LIMIT 30`,
      [req.user!.id]
    );
    const streakRes = await pool.query<{ streak: number }>(
      `WITH days AS (
         SELECT checkin_date, checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date))::int AS grp
         FROM checkins WHERE user_id = $1
       )
       SELECT MAX(cnt)::int AS streak FROM (SELECT grp, COUNT(*) AS cnt FROM days GROUP BY grp) s`,
      [req.user!.id]
    );
    const today = new Date().toISOString().slice(0, 10);
    res.json({
      streak: streakRes.rows[0]?.streak ?? 0,
      today_done: history.some((h) => h.checkin_date === today),
      history,
    } satisfies StreakInfo);
  } catch (err) { next(err); }
});

pathRouter.post('/checkin', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const mood = (req.body?.mood ?? '').toString() || null;
    const note = (req.body?.note ?? '').toString() || null;
    const today = new Date().toISOString().slice(0, 10);
    const r = await pool.query(
      `INSERT INTO checkins (user_id, checkin_date, mood, note, source)
       VALUES ($1, $2, $3, $4, 'manual')
       ON CONFLICT (user_id, checkin_date) DO UPDATE SET mood = EXCLUDED.mood, note = EXCLUDED.note
       RETURNING checkin_date::text, mood, note, source`,
      [req.user!.id, today, mood, note]
    );
    res.json({ checkin: r.rows[0] });
  } catch (err) { next(err); }
});
