import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth, requireAdmin } from '../auth';
import type { Opportunity } from '../../../shared/types';

export const workRouter = Router();

workRouter.use(requireAuth);

workRouter.get('/opportunities', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q<Opportunity>(
      `SELECT id, title, org, kind, location, apply_url, description, closes_on::text, active
       FROM opportunities WHERE active = true ORDER BY id DESC LIMIT 50`
    );
    res.json({ opportunities: rows });
  } catch (err) { next(err); }
});

// Admin: manage opportunities
workRouter.post('/opportunities', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const title = (req.body?.title ?? '').toString().trim();
    const kind = (req.body?.kind ?? '').toString();
    if (!title || !['job', 'learnership', 'bursary', 'training'].includes(kind)) {
      res.status(400).json({ error: 'title and valid kind required' });
      return;
    }
    const r = await pool.query(
      `INSERT INTO opportunities (title, org, kind, location, apply_url, description, closes_on, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, title, org, kind, location, apply_url, description, closes_on::text, active`,
      [
        title,
        (req.body?.org ?? '').toString(),
        kind,
        (req.body?.location ?? '').toString() || null,
        (req.body?.apply_url ?? '').toString() || null,
        (req.body?.description ?? '').toString() || null,
        (req.body?.closes_on ?? '').toString() || null,
        req.user!.id,
      ]
    );
    res.status(201).json({ opportunity: r.rows[0] });
  } catch (err) { next(err); }
});

workRouter.delete('/opportunities/:id', requireAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await pool.query('UPDATE opportunities SET active = false WHERE id = $1 RETURNING id', [Number(req.params.id)]);
    if (r.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});
