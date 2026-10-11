import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import express from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import type { CirclePost, CircleComment } from '../../../shared/types';

export const circleRouter = Router();

circleRouter.use(requireAuth);

// ---- image uploads (5MB, jpeg/png/webp/gif) -> Postgres bytea (container FS is ephemeral) ----
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.mimetype);
    if (!ok) { cb(new Error('Only jpeg/png/webp/gif images are allowed')); return; }
    cb(null, true);
  },
});

// media serving: image bytes live in Postgres
circleRouter.get('/media/:postId', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await pool.query<{ image_data: Buffer; image_mime: string }>(
      'SELECT image_data, image_mime FROM circle_posts WHERE id = $1 AND deleted_at IS NULL AND image_data IS NOT NULL',
      [Number(req.params.postId)]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Not found' }); return; }
    const buf = r.rows[0].image_data;
    res.setHeader('Content-Type', r.rows[0].image_mime || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=604800, immutable');
    res.send(buf);
  } catch (err) { next(err); }
});

circleRouter.get('/posts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const me = req.user!.id;
    const filter = (req.query.filter ?? 'recent').toString(); // recent | popular | mine
    const order =
      filter === 'popular'
        ? 'votes DESC, p.created_at DESC'
        : 'p.created_at DESC';
    const mineWhere = filter === 'mine' ? 'AND p.user_id = $2' : '';
    const params = filter === 'mine' ? [me, me] : [me];
    const posts = await q<any>(
      `SELECT p.id, p.user_id, u.display_name AS author_name, p.content, p.created_at::text,
              p.image_url, p.edited_at::text,
              COALESCE(v.votes, 0)::int AS votes,
              EXISTS(SELECT 1 FROM circle_votes cv WHERE cv.post_id = p.id AND cv.user_id = $1) AS voted_by_me
       FROM circle_posts p
       JOIN users u ON u.id = p.user_id
       LEFT JOIN (SELECT post_id, COUNT(*) AS votes FROM circle_votes GROUP BY post_id) v ON v.post_id = p.id
       WHERE p.deleted_at IS NULL ${mineWhere}
       ORDER BY ${order} LIMIT 50`,
      params
    );
    const ids = posts.map((p) => p.id);
    const comments = ids.length
      ? await q<CircleComment>(
          `SELECT c.id, c.post_id, c.user_id, u.display_name AS author_name, c.content, c.created_at::text
           FROM circle_comments c JOIN users u ON u.id = c.user_id
           WHERE c.post_id = ANY($1) ORDER BY c.created_at ASC`,
          [ids]
        )
      : [];
    for (const p of posts) {
      p.comments = comments.filter((c: any) => c.post_id === p.id);
      p.deleted = false;
    }
    res.json({ posts });
  } catch (err) { next(err); }
});

circleRouter.post('/posts', upload.single('image'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim().slice(0, 1000);
    const hasImage = !!req.file;
    if (!content && !hasImage) { res.status(400).json({ error: 'Write something or attach a photo' }); return; }
    const image_url = hasImage ? `/api/circle/media/POST_ID` : null; // fixed below after insert
    const r = await pool.query(
      `INSERT INTO circle_posts (user_id, content, image_data, image_mime)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, content, created_at::text`,
      [req.user!.id, content, hasImage ? req.file!.buffer : null, hasImage ? req.file!.mimetype : null]
    );
    const row = r.rows[0];
    if (hasImage) {
      await pool.query('UPDATE circle_posts SET image_url = $1 WHERE id = $2', [`/api/circle/media/${row.id}`, row.id]);
      row.image_url = `/api/circle/media/${row.id}`;
    }
    res.status(201).json({
      post: { ...r.rows[0], author_name: req.user!.display_name, comments: [], votes: 0, voted_by_me: false, edited_at: null, deleted: false },
    });
  } catch (err) { next(err); }
});

circleRouter.patch('/posts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim().slice(0, 1000);
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const r = await pool.query(
      `UPDATE circle_posts SET content = $1, edited_at = now()
       WHERE id = $2 AND user_id = $3 AND deleted_at IS NULL RETURNING id, content, edited_at::text`,
      [content, Number(req.params.id), req.user!.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Post not found (or not yours)' }); return; }
    res.json({ post: r.rows[0] });
  } catch (err) { next(err); }
});

circleRouter.delete('/posts/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const isAdmin = req.user!.role === 'admin';
    const r = await pool.query(
      `UPDATE circle_posts SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND ($2 = true OR user_id = $3) RETURNING id`,
      [Number(req.params.id), isAdmin, req.user!.id]
    );
    if (r.rows.length === 0) { res.status(404).json({ error: 'Post not found (or not yours)' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});

circleRouter.post('/posts/:id/vote', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const postId = Number(req.params.id);
    const me = req.user!.id;
    const own = await pool.query('SELECT 1 FROM circle_posts WHERE id = $1 AND deleted_at IS NULL', [postId]);
    if (own.rows.length === 0) { res.status(404).json({ error: 'Post not found' }); return; }
    const existing = await pool.query('SELECT 1 FROM circle_votes WHERE post_id = $1 AND user_id = $2', [postId, me]);
    let voted: boolean;
    if (existing.rows.length > 0) {
      await pool.query('DELETE FROM circle_votes WHERE post_id = $1 AND user_id = $2', [postId, me]);
      voted = false;
    } else {
      await pool.query('INSERT INTO circle_votes (post_id, user_id, value) VALUES ($1, $2, 1) ON CONFLICT DO NOTHING', [postId, me]);
      voted = true;
    }
    const c = await pool.query('SELECT COUNT(*)::int AS n FROM circle_votes WHERE post_id = $1', [postId]);
    res.json({ voted, votes: c.rows[0].n });
  } catch (err) { next(err); }
});

circleRouter.post('/posts/:id/comments', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim().slice(0, 500);
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const r = await pool.query(
      `INSERT INTO circle_comments (post_id, user_id, content) VALUES ($1, $2, $3)
       RETURNING id, post_id, user_id, content, created_at::text`,
      [Number(req.params.id), req.user!.id, content]
    );
    res.status(201).json({ comment: { ...r.rows[0], author_name: req.user!.display_name } });
  } catch (err) { next(err); }
});

// ---- Direct messages ----
circleRouter.get('/dm/conversations', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const me = req.user!.id;
    const rows = await q(
      `SELECT u.id AS user_id, u.display_name, u.username,
              (SELECT content FROM direct_messages m
               WHERE (m.from_user = u.id AND m.to_user = $1) OR (m.from_user = $1 AND m.to_user = u.id)
               ORDER BY m.created_at DESC LIMIT 1) AS last_message,
              (SELECT MAX(m.created_at)::text FROM direct_messages m
               WHERE (m.from_user = u.id AND m.to_user = $1) OR (m.from_user = $1 AND m.to_user = u.id)) AS last_at,
              (SELECT COUNT(*)::int FROM direct_messages m
               WHERE m.from_user = u.id AND m.to_user = $1 AND m.read_at IS NULL) AS unread
       FROM users u WHERE u.id <> $1 ORDER BY last_at DESC NULLS LAST`,
      [me]
    );
    res.json({ conversations: rows });
  } catch (err) { next(err); }
});

circleRouter.get('/dm/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const me = req.user!.id;
    const other = Number(req.params.userId);
    const rows = await q(
      `SELECT id, from_user, to_user, content, read_at::text, created_at::text
       FROM direct_messages
       WHERE (from_user = $1 AND to_user = $2) OR (from_user = $2 AND to_user = $1)
       ORDER BY created_at ASC LIMIT 200`,
      [me, other]
    );
    await pool.query(
      'UPDATE direct_messages SET read_at = now() WHERE from_user = $1 AND to_user = $2 AND read_at IS NULL',
      [other, me]
    );
    res.json({ messages: rows });
  } catch (err) { next(err); }
});

circleRouter.post('/dm/:userId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const content = (req.body?.content ?? '').toString().trim().slice(0, 1000);
    if (!content) { res.status(400).json({ error: 'content required' }); return; }
    const other = Number(req.params.userId);
    const own = await pool.query('SELECT 1 FROM users WHERE id = $1', [other]);
    if (own.rows.length === 0) { res.status(404).json({ error: 'Member not found' }); return; }
    const r = await pool.query(
      `INSERT INTO direct_messages (from_user, to_user, content) VALUES ($1, $2, $3)
       RETURNING id, from_user, to_user, content, created_at::text`,
      [req.user!.id, other, content]
    );
    res.status(201).json({ message: r.rows[0] });
  } catch (err) { next(err); }
});
