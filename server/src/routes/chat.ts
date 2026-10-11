import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import { callMentorModel, parseMentorTurn, MentorContext } from '../ai';
import type { ChatAction, Goal, Checkin, Commitment, MoneySnapshot } from '../../../shared/types';

export const chatRouter = Router();

function todayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function monthStr(): string {
  return new Date().toISOString().slice(0, 7);
}

async function buildContext(userId: number, displayName: string): Promise<MentorContext> {
  const today = todayStr();
  const month = monthStr();

  const checkinRes = await pool.query(
    'SELECT checkin_date::text, mood, note, source FROM checkins WHERE user_id = $1 AND checkin_date = $2',
    [userId, today]
  );
  const todayCheckin = checkinRes.rows[0] ?? null;

  const streakRes = await pool.query<{ streak: number }>(
    `WITH days AS (
       SELECT checkin_date, checkin_date - (ROW_NUMBER() OVER (ORDER BY checkin_date))::int AS grp
       FROM checkins WHERE user_id = $1
     )
     SELECT MAX(cnt)::int AS streak FROM (
       SELECT grp, COUNT(*) AS cnt FROM days GROUP BY grp
     ) s`,
    [userId]
  );
  const streak = streakRes.rows[0]?.streak ?? 0;

  const goalsRes = await pool.query(
    `SELECT id, title, status, created_at::text, done_at::text FROM goals
     WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 8`,
    [userId]
  );
  const goals: Goal[] = [];
  for (const g of goalsRes.rows) {
    const stepsRes = await pool.query(
      'SELECT id, goal_id, label, done, position FROM goal_steps WHERE goal_id = $1 ORDER BY position, id',
      [g.id]
    );
    goals.push({ ...g, steps: stepsRes.rows });
  }

  const commRes = await pool.query(
    `SELECT id, text, due_date::text, status, created_at::text FROM commitments
     WHERE user_id = $1 AND status = 'open' ORDER BY created_at DESC LIMIT 8`,
    [userId]
  );

  const moneyRes = await pool.query(
    `SELECT id, month_year, income::text, expenses, ai_summary, created_at::text
     FROM money_snapshots WHERE user_id = $1 AND month_year = $2`,
    [userId, month]
  );

  const wkRes = await pool.query<{ n: number }>(
    `SELECT COUNT(*)::int AS n FROM workout_logs
     WHERE user_id = $1 AND done_on >= (CURRENT_DATE - INTERVAL '6 days')`,
    [userId]
  );

  return {
    user_name: displayName,
    today,
    today_checkin: todayCheckin as Checkin | null,
    streak,
    goals,
    open_commitments: commRes.rows as Commitment[],
    money_month: (moneyRes.rows[0] as MoneySnapshot) ?? null,
    workouts_this_week: wkRes.rows[0]?.n ?? 0,
  };
}

interface ActionOutcome {
  label: string;
}

async function applyActions(userId: number, actions: ChatAction[]): Promise<ActionOutcome[]> {
  const outcomes: ActionOutcome[] = [];
  for (const a of actions) {
    try {
      switch (a.type) {
        case 'log_checkin': {
          await pool.query(
            `INSERT INTO checkins (user_id, checkin_date, mood, note, source)
             VALUES ($1, $2, $3, $4, 'chat')
             ON CONFLICT (user_id, checkin_date) DO UPDATE SET mood = EXCLUDED.mood, note = COALESCE(EXCLUDED.note, checkins.note)`,
            [userId, todayStr(), a.mood ?? null, a.note ?? null]
          );
          outcomes.push({ label: 'Logged your check-in for today' });
          break;
        }
        case 'create_goal': {
          if (!a.title) break;
          const g = await pool.query(
            `INSERT INTO goals (user_id, title) VALUES ($1, $2) RETURNING id`,
            [userId, a.title]
          );
          const goalId = g.rows[0].id;
          const steps = Array.isArray(a.steps) ? a.steps.filter((s) => typeof s === 'string' && s.trim()) : [];
          let pos = 0;
          for (const label of steps) {
            await pool.query('INSERT INTO goal_steps (goal_id, label, position) VALUES ($1, $2, $3)', [goalId, label.trim(), pos++]);
          }
          outcomes.push({ label: `New goal: ${a.title}${steps.length ? ` (${steps.length} steps)` : ''}` });
          break;
        }
        case 'complete_step': {
          if (typeof a.step_id !== 'number') break;
          const r = await pool.query(
            `UPDATE goal_steps SET done = true WHERE id = $1 AND goal_id IN (SELECT id FROM goals WHERE user_id = $2) RETURNING goal_id`,
            [a.step_id, userId]
          );
          if (r.rows.length > 0) {
            const goalId = r.rows[0].goal_id;
            const remaining = await pool.query(
              'SELECT COUNT(*)::int AS n FROM goal_steps WHERE goal_id = $1 AND done = false',
              [goalId]
            );
            if (remaining.rows[0].n === 0) {
              await pool.query(`UPDATE goals SET status = 'done', done_at = now() WHERE id = $1`, [goalId]);
              outcomes.push({ label: 'Step done - and that goal is complete!' });
            } else {
              outcomes.push({ label: 'Step marked done' });
            }
          }
          break;
        }
        case 'add_step': {
          if (typeof a.goal_id !== 'number' || !a.label) break;
          const own = await pool.query('SELECT id FROM goals WHERE id = $1 AND user_id = $2', [a.goal_id, userId]);
          if (own.rows.length === 0) break;
          const posRes = await pool.query<{ n: number }>(
            'SELECT COALESCE(MAX(position), -1) + 1 AS n FROM goal_steps WHERE goal_id = $1',
            [a.goal_id]
          );
          await pool.query('INSERT INTO goal_steps (goal_id, label, position) VALUES ($1, $2, $3)', [a.goal_id, a.label, posRes.rows[0].n]);
          outcomes.push({ label: `Step added: ${a.label}` });
          break;
        }
        case 'add_commitment': {
          if (!a.text) break;
          await pool.query('INSERT INTO commitments (user_id, text, due_date) VALUES ($1, $2, $3)', [userId, a.text, a.due_date ?? null]);
          outcomes.push({ label: `Commitment logged: ${a.text}` });
          break;
        }
        case 'money_checkin': {
          const income = typeof a.income === 'number' && isFinite(a.income) ? a.income : 0;
          const expenses: Record<string, number> = {};
          if (a.expenses && typeof a.expenses === 'object') {
            for (const [k, v] of Object.entries(a.expenses)) {
              const n = typeof v === 'number' && isFinite(v) ? v : 0;
              expenses[k] = n;
            }
          }
          const totalExpenses = Object.values(expenses).reduce((s, n) => s + n, 0);
          const summary = `Income R${income}, expenses R${totalExpenses}, left R${income - totalExpenses}.`;
          await pool.query(
            `INSERT INTO money_snapshots (user_id, month_year, income, expenses, ai_summary)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id, month_year) DO UPDATE SET income = EXCLUDED.income, expenses = EXCLUDED.expenses, ai_summary = EXCLUDED.ai_summary`,
            [userId, monthStr(), income, JSON.stringify(expenses), summary]
          );
          outcomes.push({ label: 'Money check-in saved for this month' });
          break;
        }
        case 'log_workout': {
          let workoutId: number | null = null;
          if (typeof a.workout_id === 'number') {
            const w = await pool.query('SELECT id FROM workouts WHERE id = $1', [a.workout_id]);
            workoutId = w.rows.length > 0 ? (w.rows[0].id as number) : null;
          }
          await pool.query('INSERT INTO workout_logs (user_id, workout_id, note) VALUES ($1, $2, $3)', [userId, workoutId, a.note ?? null]);
          outcomes.push({ label: 'Workout logged' });
          break;
        }
        case 'escalate_coach': {
          await pool.query(
            `INSERT INTO coach_messages (user_id, direction, content) VALUES ($1, 'to_coach', $2)`,
            [userId, `Escalated from chat: ${a.reason ?? 'requested a coach'}`]
          );
          outcomes.push({ label: 'Coach notified - open the Coach tab' });
          break;
        }
        case 'celebrate_streak': {
          outcomes.push({ label: 'Streak celebration' });
          break;
        }
        case 'challenge_user': {
          outcomes.push({ label: 'New challenge set' });
          break;
        }
        case 'community_pulse': {
          outcomes.push({ label: 'Circle nudge' });
          break;
        }
      }
    } catch (err) {
      console.error(`[chat] action ${a.type} failed for user ${userId}:`, err);
    }
  }
  return outcomes;
}

chatRouter.post('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const message = (req.body?.message ?? '').toString().trim();
    if (!message) {
      res.status(400).json({ error: 'message required' });
      return;
    }

    // History FIRST, before any insert, so the new message is never in its own context.
    const priorRows = await q<{ id: number; role: string; content: string; created_at: string }>(
      `SELECT id, role, content, created_at::text FROM chat_messages
       WHERE user_id = $1 AND archived = false ORDER BY created_at DESC, id DESC LIMIT 20`,
      [userId]
    );
    priorRows.reverse();

    // Idempotency guard: a double-POST within 5s replays the original assistant reply.
    const last = priorRows[priorRows.length - 1];
    if (last && last.role === 'user' && last.content === message) {
      const ageMs = Date.now() - new Date(last.created_at).getTime();
      if (ageMs >= 0 && ageMs < 5000) {
        const nextRow = await q<{ role: string; content: string }>(
          `SELECT role, content FROM chat_messages
           WHERE user_id = $1 AND (created_at > $2 OR (created_at = $2 AND id > $3))
           ORDER BY created_at ASC, id ASC LIMIT 1`,
          [userId, last.created_at, last.id]
        );
        const assistantRow = nextRow.find((r) => r.role === 'assistant');
        if (assistantRow) {
          res.json({ reply: assistantRow.content, actions: [], message_id: last.id });
          return;
        }
      }
    }

    const saved = await pool.query(
      'INSERT INTO chat_messages (user_id, role, content) VALUES ($1, $2, $3) RETURNING id',
      [userId, 'user', message]
    );

    const ctx = await buildContext(userId, req.user!.display_name);

    let turn;
    try {
      const raw = await callMentorModel(ctx, priorRows, message);
      turn = parseMentorTurn(raw);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[chat] model call failed:', msg);
      turn = { reply: 'Ai, the line to my brain dropped for a second. Try me again now.', actions: [] };
    }

    const outcomes = await applyActions(userId, turn.actions);

    const savedAssistant = await pool.query(
      `INSERT INTO chat_messages (user_id, role, content) VALUES ($1, 'assistant', $2) RETURNING id`,
      [userId, turn.reply]
    );

    res.json({
      reply: turn.reply,
      actions: outcomes.map((o) => o.label),
      message_id: savedAssistant.rows[0].id,
    });
  } catch (err) {
    next(err);
  }
});

chatRouter.get('/', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q(
      `SELECT id, role, content, created_at::text FROM chat_messages
       WHERE user_id = $1 AND archived = false ORDER BY created_at ASC, id ASC LIMIT 100`,
      [req.user!.id]
    );
    res.json({ messages: rows });
  } catch (err) {
    next(err);
  }
});

// Start a fresh conversation: archives history (keeps it for admin/audit),
// next GET / returns an empty thread with a new Bra Hero greeting.
chatRouter.post('/reset', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    await pool.query(
      'UPDATE chat_messages SET archived = true WHERE user_id = $1 AND archived = false',
      [userId]
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});
