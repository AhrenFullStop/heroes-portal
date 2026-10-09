import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { hashPassword, verifyPassword, requireAuth } from '../auth';

export const authRouter = Router();

function setSessionCookieCompat(req: Request): void {
  // Behind RunOS TLS proxy, cookie.secure 'auto' + trust proxy handles it; nothing extra needed.
  void req;
}

authRouter.post('/login', async (req: Request, res: Response) => {
  const username = (req.body?.username ?? '').toString().trim().toLowerCase();
  const password = (req.body?.password ?? '').toString();
  if (!username || !password) {
    res.status(400).json({ error: 'Username and password required' });
    return;
  }
  try {
    const r = await pool.query(
      'SELECT id, username, password_hash, display_name, role FROM users WHERE lower(username) = $1',
      [username]
    );
    if (r.rows.length === 0) {
      res.status(401).json({ error: 'Wrong username or password' });
      return;
    }
    const user = r.rows[0];
    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      res.status(401).json({ error: 'Wrong username or password' });
      return;
    }
    req.session.userId = user.id;
    setSessionCookieCompat(req);
    res.json({ user: { id: user.id, username: user.username, display_name: user.display_name, role: user.role } });
  } catch (err) {
    console.error('[auth/login]', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.post('/logout', (req: Request, res: Response) => {
  req.session.destroy(() => {
    res.json({ ok: true });
  });
});

authRouter.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({ user: req.user });
});

// Admin: user management
import { requireAdmin } from '../auth';

authRouter.get('/admin/users', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const rows = await pool.query(
    'SELECT id, username, display_name, role, created_at::text FROM users ORDER BY created_at DESC'
  );
  res.json({ users: rows.rows });
});

authRouter.post('/admin/users', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const username = (req.body?.username ?? '').toString().trim().toLowerCase();
  const password = (req.body?.password ?? '').toString();
  const displayName = (req.body?.display_name ?? '').toString().trim() || username;
  if (!username || !password) {
    res.status(400).json({ error: 'username and password required' });
    return;
  }
  if (password.length < 4) {
    res.status(400).json({ error: 'password too short (min 4)' });
    return;
  }
  try {
    const hash = await hashPassword(password);
    const r = await pool.query(
      `INSERT INTO users (username, password_hash, display_name, role) VALUES ($1, $2, $3, 'alumnus')
       RETURNING id, username, display_name, role, created_at::text`,
      [username, hash, displayName]
    );
    res.status(201).json({ user: r.rows[0] });
  } catch (err: any) {
    if (err?.code === '23505' || (err?.message ?? '').includes('duplicate key')) {
      res.status(409).json({ error: 'That username is taken' });
      return;
    }
    console.error('[admin/users]', err);
    res.status(500).json({ error: 'Create user failed' });
  }
});

authRouter.post('/admin/users/:id/reset-password', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const id = Number(req.params.id);
  const password = (req.body?.password ?? '').toString();
  if (!password || password.length < 4) {
    res.status(400).json({ error: 'password too short (min 4)' });
    return;
  }
  const hash = await hashPassword(password);
  const r = await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2 RETURNING id', [hash, id]);
  if (r.rows.length === 0) {
    res.status(404).json({ error: 'User not found' });
    return;
  }
  res.json({ ok: true });
});
