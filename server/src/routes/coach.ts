import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth, requireAdmin } from '../auth';
import type { CoachMessage, CoachThread } from '../../../shared/types';

export const coachRouter = Router();

coachRouter.use(requireAuth);

// User's own thread
coachRouter.get('/thread', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q<CoachMessage>(
      `SELECT id, direction, content, created_at::text, resolved FROM coach_messages
       WHERE user_id = $1 ORDER BY created_at ASC, id ASC`,
      [req.user!.id]
    );
    res.json({ messages: rows });
  } catch (err) { next(err); }
});

coachRouter.post('/messages', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim();
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const r = await pool.query(
      `INSERT INTO coach_messages (user_id, direction, content) VALUES ($1, 'to_coach', $2)
       RETURNING id, direction, content, created_at::text, resolved`,
      [req.user!.id, content]
    );
    res.status(201).json({ message: r.rows[0] });
  } catch (err) { next(err); }
});

// Admin: coach inbox
coachRouter.get('/inbox', requireAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await q<{ id: number; username: string; display_name: string }>(
      `SELECT DISTINCT u.id, u.username, u.display_name
       FROM users u JOIN coach_messages cm ON cm.user_id = u.id
       ORDER BY u.id`
    );
    const threads: CoachThread[] = [];
    for (const u of users) {
      const msgs = await q<CoachMessage>(
        `SELECT id, direction, content, created_at::text, resolved FROM coach_messages
         WHERE user_id = $1 ORDER BY created_at ASC, id ASC`,
        [u.id]
      );
      if (msgs.length === 0) continue;
      threads.push({
        user_id: u.id,
        username: u.username,
        display_name: u.display_name,
        unresolved: msgs.filter((m) => m.direction === 'to_coach' && !m.resolved).length,
        messages: msgs,
      });
    }
    threads.sort((a, b) => b.unresolved - a.unresolved || a.user_id - b.user_id);
    res.json({ threads });
  } catch (err) { next(err); }
});

coachRouter.post('/reply', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = Number(req.body?.user_id);
    const content = (req.body?.content ?? '').toString().trim();
    if (!userId || !content) { res.status(400).json({ error: 'user_id and content required' }); return; }
    const exists = await pool.query('SELECT id FROM users WHERE id = $1', [userId]);
    if (exists.rows.length === 0) { res.status(404).json({ error: 'User not found' }); return; }
    const r = await pool.query(
      `INSERT INTO coach_messages (user_id, direction, content) VALUES ($1, 'from_coach', $2)
       RETURNING id, direction, content, created_at::text, resolved`,
      [userId, content]
    );
    await pool.query(
      `UPDATE coach_messages SET resolved = true WHERE user_id = $1 AND direction = 'to_coach' AND resolved = false`,
      [userId]
    );
    res.status(201).json({ message: r.rows[0] });
  } catch (err) { next(err); }
});
