import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import type { CirclePost, CircleComment } from '../../../shared/types';

export const circleRouter = Router();

circleRouter.use(requireAuth);

circleRouter.get('/posts', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const posts = await q<CirclePost & { user_id: number }>(
      `SELECT p.id, p.user_id, u.display_name AS author_name, p.content, p.created_at::text
       FROM circle_posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 50`
    );
    const comments = await q<CircleComment>(
      `SELECT c.id, c.post_id, c.user_id, u.display_name AS author_name, c.content, c.created_at::text
       FROM circle_comments c JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ANY($1) ORDER BY c.created_at ASC`,
      [posts.map((p) => p.id)]
    );
    for (const p of posts) {
      p.comments = comments.filter((c) => c.post_id === p.id);
    }
    res.json({ posts });
  } catch (err) { next(err); }
});

circleRouter.post('/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim();
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const r = await pool.query(
      `INSERT INTO circle_posts (user_id, content) VALUES ($1, $2)
       RETURNING id, user_id, content, created_at::text`,
      [req.user!.id, content]
    );
    res.status(201).json({
      post: { ...r.rows[0], author_name: req.user!.display_name, comments: [] },
    });
  } catch (err) { next(err); }
});

circleRouter.post('/posts/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = Number(req.params.id);
    const content = (req.body?.content ?? '').toString().trim();
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const exists = await pool.query('SELECT id FROM circle_posts WHERE id = $1', [postId]);
    if (exists.rows.length === 0) { res.status(404).json({ error: 'Post not found' }); return; }
    const r = await pool.query(
      `INSERT INTO circle_comments (post_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, content, created_at::text`,
      [postId, req.user!.id, content]
    );
    res.status(201).json({ comment: { ...r.rows[0], author_name: req.user!.display_name } });
  } catch (err) { next(err); }
});
