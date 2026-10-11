import bcrypt from 'bcryptjs';
import { Request, Response, NextFunction } from 'express';
import { pool } from './db';
import type { User } from '../../shared/types';

declare module 'express-session' {
  interface SessionData {
    userId?: number;
    viewAsId?: number;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: User;
      realUser?: User;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (!req.session.userId) {
    res.status(401).json({ error: 'Not logged in' });
    return;
  }
  try {
    const r = await pool.query(
      'SELECT id, username, display_name, role FROM users WHERE id = $1',
      [req.session.userId]
    );
    if (r.rows.length === 0) {
      req.session.destroy(() => {});
      res.status(401).json({ error: 'Not logged in' });
      return;
    }
    req.realUser = r.rows[0] as User;
    // View-as: effective user is the impersonated member; real admin identity kept in realUser.
    const viewAsId = req.session.viewAsId;
    if (viewAsId && req.realUser.role === 'admin' && viewAsId !== req.session.userId) {
      const v = await pool.query(
        "SELECT id, username, display_name, role FROM users WHERE id = $1 AND role = 'alumnus'",
        [viewAsId]
      );
      if (v.rows.length > 0) {
        req.user = { ...v.rows[0], impersonating: true } as User;
        next();
        return;
      }
      // target vanished: drop the stale view-as
      delete req.session.viewAsId;
    }
    req.user = req.realUser;
    next();
  } catch (err) {
    next(err);
  }
}

// Admin gate resolves against the REAL identity, so an impersonating admin keeps
// access to admin endpoints (including the view-as exit).
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = req.realUser?.role ?? req.user?.role;
  if (role !== 'admin') {
    res.status(403).json({ error: 'Admin only' });
    return;
  }
  next();
}

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
