import { Router, Request, Response, NextFunction } from 'express';
import { pool, q } from '../db';
import { requireAuth } from '../auth';
import type { MoneySnapshot } from '../../../shared/types';

export const moneyRouter = Router();

moneyRouter.use(requireAuth);

moneyRouter.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q<MoneySnapshot>(
      `SELECT id, month_year, income::text, expenses, ai_summary, created_at::text
       FROM money_snapshots WHERE user_id = $1 ORDER BY month_year DESC LIMIT 12`,
      [req.user!.id]
    );
    res.json({ snapshots: rows });
  } catch (err) { next(err); }
});

moneyRouter.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user!.id;
    const month = (req.body?.month_year ?? new Date().toISOString().slice(0, 7)).toString().slice(0, 7);
    const income = Number(req.body?.income ?? 0) || 0;
    const rawExpenses = req.body?.expenses ?? {};
    const expenses: Record<string, number> = {};
    if (rawExpenses && typeof rawExpenses === 'object') {
      for (const [k, v] of Object.entries(rawExpenses)) {
        const n = Number(v);
        if (k.trim() && isFinite(n) && n !== 0) expenses[k.trim().slice(0, 40)] = n;
      }
    }
    const total = Object.values(expenses).reduce((s, n) => s + n, 0);
    const left = income - total;

    let aiSummary: string;
    const key = process.env.AI_PROXY_KEY;
    if (key) {
      try {
        aiSummary = await moneyFeedback(key, income, expenses, left);
      } catch (err) {
        console.error('[money] AI feedback failed:', err);
        aiSummary = defaultSummary(income, total, left);
      }
    } else {
      aiSummary = defaultSummary(income, total, left);
    }

    const r = await pool.query(
      `INSERT INTO money_snapshots (user_id, month_year, income, expenses, ai_summary)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (user_id, month_year) DO UPDATE
         SET income = EXCLUDED.income, expenses = EXCLUDED.expenses, ai_summary = EXCLUDED.ai_summary
       RETURNING id, month_year, income::text, expenses, ai_summary, created_at::text`,
      [userId, month, income, JSON.stringify(expenses), aiSummary]
    );
    res.json({ snapshot: r.rows[0] });
  } catch (err) { next(err); }
});

function defaultSummary(income: number, totalExpenses: number, left: number): string {
  if (left < 0) return `You are R${Math.abs(left).toFixed(0)} short this month. That gap is where plans break. Let's look at what can move.`;
  if (left === 0) return `Every rand is spoken for. Tight, but if you planned it, that's discipline.`;
  return `You have R${left.toFixed(0)} left after expenses. Even a small slice of that saved beats nothing.`;
}

async function moneyFeedback(key: string, income: number, expenses: Record<string, number>, left: number): Promise<string> {
  const base = process.env.AI_PROXY_BASE_URL || 'https://api.staging.xgmi.com/api/proxy/v1';
  const model = process.env.AI_MODEL || 'xgmi/Jupiter-320B-1000K';
  const prompt = `You are Bra Hero, a money mentor for young HEROES alumni in South Africa. Amounts are in Rand.
The user logged a money check-in:
Income: R${income}
Expenses: ${JSON.stringify(expenses)}
Left over: R${left}

Reply with 2-4 short sentences of direct, practical feedback. Reference the actual numbers. If they have money left, suggest a realistic amount to save. If they are short, name the biggest expense and ask one sharp question. No greetings, no markdown, plain text only.`;

  const res = await fetch(`${base}/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 1500,
      temperature: 0.4,
      stream: false,
    }),
  });
  if (!res.ok) throw new Error(`AI proxy ${res.status}`);
  const data = await res.json() as any;
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== 'string' || !content.trim()) throw new Error('empty AI content');
  return content.trim().replace(/^```[a-z]*\n?|```$/g, '').slice(0, 600);
}

// ---- Savings goals ----
moneyRouter.get('/savings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const rows = await q(
      `SELECT id, name, target_amount::text, saved_amount::text, done, created_at::text
       FROM savings_goals WHERE user_id = $1 ORDER BY done ASC, created_at DESC`,
      [req.user!.id]
    );
    res.json({ goals: rows });
  } catch (err) { next(err); }
});

moneyRouter.post('/savings', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const name = (req.body?.name ?? '').toString().trim().slice(0, 80);
    const target = Number(req.body?.target_amount);
    if (!name || !isFinite(target) || target <= 0) { res.status(400).json({ error: 'name and positive target_amount required' }); return; }
    const saved = Number(req.body?.saved_amount ?? 0);
    const r = await pool.query(
      `INSERT INTO savings_goals (user_id, name, target_amount, saved_amount)
       VALUES ($1, $2, $3, $4) RETURNING id, name, target_amount::text, saved_amount::text, done, created_at::text`,
      [req.user!.id, name, target, isFinite(saved) && saved >= 0 ? saved : 0]
    );
    res.status(201).json({ goal: r.rows[0] });
  } catch (err) { next(err); }
});

moneyRouter.patch('/savings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const id = Number(req.params.id);
    const add = Number(req.body?.add_amount ?? 0);
    const name = req.body?.name != null ? (req.body.name).toString().trim().slice(0, 80) : null;
    const own = await pool.query('SELECT id, saved_amount, target_amount FROM savings_goals WHERE id = $1 AND user_id = $2', [id, req.user!.id]);
    if (own.rows.length === 0) { res.status(404).json({ error: 'Savings goal not found' }); return; }
    const cur = Number(own.rows[0].saved_amount);
    const target = Number(own.rows[0].target_amount);
    const nextSaved = isFinite(add) && add !== 0 ? Math.max(0, cur + add) : cur;
    const done = nextSaved >= target;
    const r = await pool.query(
      `UPDATE savings_goals SET
         saved_amount = $1,
         name = COALESCE($2, name),
         done = $3
       WHERE id = $4 AND user_id = $5
       RETURNING id, name, target_amount::text, saved_amount::text, done, created_at::text`,
      [nextSaved, name, done, id, req.user!.id]
    );
    res.json({ goal: r.rows[0], just_completed: done && cur < target });
  } catch (err) { next(err); }
});

moneyRouter.delete('/savings/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const r = await pool.query('DELETE FROM savings_goals WHERE id = $1 AND user_id = $2 RETURNING id', [Number(req.params.id), req.user!.id]);
    if (r.rows.length === 0) { res.status(404).json({ error: 'Savings goal not found' }); return; }
    res.json({ ok: true });
  } catch (err) { next(err); }
});
