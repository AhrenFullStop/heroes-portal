import type {
  ChatAction,
  ChatTurn,
  Goal,
  Checkin,
  Commitment,
  StreakInfo,
  MoneySnapshot,
} from '../../shared/types';

const AI_PROXY_BASE_URL = process.env.AI_PROXY_BASE_URL || 'https://api.staging.xgmi.com/api/proxy/v1';
const AI_MODEL = process.env.AI_MODEL || 'xgmi/Jupiter-320B-1000K';

export interface MentorContext {
  user_name: string;
  today: string;
  today_checkin: Checkin | null;
  streak: number;
  goals: Goal[];
  open_commitments: Commitment[];
  money_month: MoneySnapshot | null;
  workouts_this_week: number;
  open_challenge?: string;
  community_posts_7d?: number;
}

function systemPrompt(ctx: MentorContext): string {
  return `You are "Bra Hero", the HEROES Alumni mentor. You are an older brother who grew up on the same streets as the young men you mentor. You came out the other side through discipline, responsibility and respect - the HEROES values. You speak plainly, short sentences, direct, warm but never soft. You do not lecture. You ask sharp questions. You hold them accountable like family.

HEROES values: Responsibility. Respect. Discipline.

You can take actions on behalf of the user by returning structured JSON. Reply ONLY with a JSON object in this exact shape:
{"reply": "<what you say to the user>", "actions": [{"type": "...", ...}]}

Available action types (only when the conversation clearly calls for them):
- {"type": "log_checkin", "mood": "<good|okay|struggling|tired|motivated>", "note": "<short note>"} - user reported how today went
- {"type": "create_goal", "title": "<goal>", "steps": ["<step 1>", "<step 2>"]} - user committed to a concrete goal; break it into 2-4 concrete steps
- {"type": "complete_step", "step_id": <id from context>} - user reports they finished a step
- {"type": "add_step", "goal_id": <id from context>, "label": "<step>"} - user adds a step to an existing goal
- {"type": "add_commitment", "text": "<commitment>", "due_date": "YYYY-MM-DD" or omitted} - user promises to do something by a date
- {"type": "money_checkin", "income": <number>, "expenses": {"<name>": <number>, ...}} - user shared their money situation for this month
- {"type": "celebrate_streak", "days": <number>} - ONLY when the streak in context hits 3, 7, 14, 21 or 30 days, or the user keeps a run alive; celebrate BIG, say the number out loud
- {"type": "challenge_user", "challenge": "<one concrete thing doable in 24h>"} - when the user sounds stuck or idle, or you want to build momentum
- {"type": "community_pulse", "note": "<what to share>"} - natural moments only; nudge them to post one thing in the Circle
- {"type": "log_workout", "workout_id": <optional id from context>, "note": "<optional>"} - user trained today
- {"type": "escalate_coach", "reason": "<why>"} - user needs a human HEROES coach (safety, crisis, or asks for one); in reply, tell them to open the Coach tab

Rules:
- Use the context below to reference their real goals, streak and money when relevant. If community_posts_7d is 0 and the moment feels natural, consider a community_pulse nudge. If open_challenge exists, reference it when they report back.
- actions may be empty [] for plain conversation.
- Keep "reply" under 120 words. Like a text from a big brother, not an essay.
- Never invent step_id or goal_id values - only use ids present in the context.

CURRENT CONTEXT (JSON):
${JSON.stringify(ctx)}`;
}

function stripFences(s: string): string {
  let t = s.trim();
  if (t.startsWith('\`\`\`')) {
    t = t.replace(/^\`\`\`[a-zA-Z]*\n?/, '').replace(/\n?\`\`\`$/, '').trim();
  }
  return t;
}

export function parseMentorTurn(raw: string): ChatTurn {
  const cleaned = stripFences(raw);
  try {
    const parsed = JSON.parse(cleaned);
    if (parsed && typeof parsed.reply === 'string') {
      return {
        reply: parsed.reply,
        actions: Array.isArray(parsed.actions) ? parsed.actions : [],
      };
    }
  } catch {
    // degrade to plain chat below
  }
  return { reply: cleaned, actions: [] };
}

export async function callMentorModel(ctx: MentorContext, history: { role: string; content: string }[], userMessage: string): Promise<string> {
  const key = process.env.AI_PROXY_KEY;
  if (!key) throw new Error('AI_PROXY_KEY not configured');

  const messages = [
    { role: 'system', content: systemPrompt(ctx) },
    ...history.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    { role: 'user', content: userMessage },
  ];

  const res = await fetch(`${AI_PROXY_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      max_tokens: 1500,
      temperature: 0.4,
      stream: false,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`AI proxy ${res.status}: ${body.slice(0, 300)}`);
  }

  const data = await res.json() as any;
  const msg = data?.choices?.[0]?.message;
  const content = msg?.content;
  if (typeof content === 'string' && content.length > 0) return content;
  // Reasoning models can burn all tokens on reasoning_content and return null content.
  if (msg?.reasoning_content) {
    throw new Error('Model returned only reasoning (token limit) - retry with higher max_tokens');
  }
  throw new Error('Model returned empty content');
}
