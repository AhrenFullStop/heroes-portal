import { Router, Request, Response } from 'express';
import { pool } from '../db';
import { hashPassword, verifyPassword, requireAuth } from '../auth';
import type { MemberOverview, AdminOverviewResponse } from '../../../shared/types';

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

// Admin: member overview (engagement + risk flags)

const MOOD_SCORE: Record<string, number> = {
  good: 4,
  motivated: 4,
  okay: 3,
  tired: 2,
  struggling: 1,
};

function moodDecline(trend: { mood: string | null }[]): boolean {
  const scores = trend
    .map((t) => (t.mood ? MOOD_SCORE[t.mood] : undefined))
    .filter((s): s is number => typeof s === 'number');
  if (scores.length < 3) return false;
  const recent = scores.slice(-3);
  const nonIncreasing = recent[0] >= recent[1] && recent[1] >= recent[2];
  return nonIncreasing && recent[2] <= 2;
}


// ---- Bra Hero persona (admin-editable) ----
const PERSONA_MAX = 4000;

authRouter.get('/admin/persona', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    const { getPersona, DEFAULT_PERSONA } = await import('../ai');
    const r = await pool.query<{ value: string; updated_at: string }>("SELECT value, updated_at::text FROM app_settings WHERE key = 'persona'");
    res.json({
      persona: r.rows[0]?.value ?? DEFAULT_PERSONA,
      is_custom: r.rows[0] != null,
      updated_at: r.rows[0]?.updated_at ?? null,
      default: DEFAULT_PERSONA,
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load persona' });
  }
});

authRouter.put('/admin/persona', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const persona = (req.body?.persona ?? '').toString().trim();
    if (!persona) { res.status(400).json({ error: 'persona required (empty resets to default - use DELETE)' }); return; }
    if (persona.length > PERSONA_MAX) { res.status(400).json({ error: `persona too long (max ${PERSONA_MAX} chars)` }); return; }
    // Guardrail: an admin prompt that forbids the JSON harness would break every action.
    const forbidden = /never use (json|actions)|ignore (all )?(previous|above) instructions|output plain text only/i;
    if (forbidden.test(persona)) {
      res.status(400).json({ error: 'This directive conflicts with the action harness. Bra Hero must always reply with the JSON shape - phrase personality changes without overriding the output format.' });
      return;
    }
    await pool.query(
      "INSERT INTO app_settings (key, value) VALUES ('persona', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
      [persona]
    );
    res.json({ ok: true, persona });
  } catch (err) {
    res.status(500).json({ error: 'Failed to save persona' });
  }
});

authRouter.delete('/admin/persona', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  try {
    await pool.query("DELETE FROM app_settings WHERE key = 'persona'");
    res.json({ ok: true, persona: (await import('../ai')).DEFAULT_PERSONA });
  } catch (err) {
    res.status(500).json({ error: 'Failed to reset persona' });
  }
});

authRouter.get('/admin/overview', requireAuth, requireAdmin, async (_req: Request, res: Response) => {
  const users = await pool.query<{ id: number; username: string; display_name: string }>(
    "SELECT id, username, display_name FROM users WHERE role = 'alumnus' ORDER BY display_name"
  );

  const members: MemberOverview[] = [];
  for (const u of users.rows) {
    const streakRes = await pool.query<{ streak: number }>(
      `WITH days AS (
         SELECT checkin_date, checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date))::int AS grp
         FROM checkins WHERE user_id = $1
       )
       SELECT MAX(cnt)::int AS streak FROM (SELECT grp, COUNT(*) AS cnt FROM days GROUP BY grp) s`,
      [u.id]
    );

    const lastCheckinRes = await pool.query<{ d: string | null }>(
      'SELECT MAX(checkin_date)::text AS d FROM checkins WHERE user_id = $1',
      [u.id]
    );

    const trendRes = await pool.query<{ date: string; mood: string | null }>(
      `SELECT checkin_date::text AS date, mood FROM checkins
       WHERE user_id = $1 ORDER BY checkin_date DESC LIMIT 7`,
      [u.id]
    );
    const mood_trend = trendRes.rows.reverse();

    const goalsRes = await pool.query<{ n: number }>(
      "SELECT COUNT(*)::int AS n FROM goals WHERE user_id = $1 AND status = 'active'",
      [u.id]
    );

    // goal_steps has no timestamp column; count all done steps for this user's goals.
    const stepsRes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM goal_steps gs
       JOIN goals g ON g.id = gs.goal_id
       WHERE g.user_id = $1 AND gs.done = true`,
      [u.id]
    );

    const coachRes = await pool.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM coach_messages
       WHERE user_id = $1 AND direction = 'to_coach' AND resolved = false`,
      [u.id]
    );

    const lastActiveRes = await pool.query<{ d: string | null }>(
      'SELECT MAX(created_at)::text AS d FROM chat_messages WHERE user_id = $1',
      [u.id]
    );

    const open_coach_messages = coachRes.rows[0]?.n ?? 0;
    const last_checkin = lastCheckinRes.rows[0]?.d ?? null;
    const last_active = lastActiveRes.rows[0]?.d ?? null;

    let risk_flag: MemberOverview['risk_flag'] = 'none';
    if (open_coach_messages > 0) {
      risk_flag = 'coach_open';
    } else if (moodDecline(mood_trend)) {
      risk_flag = 'mood_decline';
    } else {
      const staleCutoff = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
      const checkinStale = !last_checkin || new Date(last_checkin) < staleCutoff;
      const chatStale = !last_active || new Date(last_active) < staleCutoff;
      if (checkinStale && chatStale) risk_flag = 'low_engagement';
    }

    members.push({
      user_id: u.id,
      username: u.username,
      display_name: u.display_name,
      streak: streakRes.rows[0]?.streak ?? 0,
      last_checkin_date: last_checkin,
      mood_trend,
      risk_flag,
      active_goals: goalsRes.rows[0]?.n ?? 0,
      steps_done_7d: stepsRes.rows[0]?.n ?? 0,
      open_coach_messages,
      last_active_date: last_active,
    });
  }

  const payload: AdminOverviewResponse = { members, generated_at: new Date().toISOString() };
  res.json(payload);
});
