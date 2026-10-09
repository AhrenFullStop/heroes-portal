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
