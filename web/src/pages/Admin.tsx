import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, Flame, KeyRound, LifeBuoy, RefreshCw, Send, UserPlus, Users } from 'lucide-react';
import { api } from '../api';
import { CoachInbox } from './CoachInbox';
import type { AdminOverviewResponse, AdminUser, MemberOverview } from '../../../shared/types';

const MOOD_EMOJI: Record<string, string> = {
  good: '😄',
  motivated: '🔥',
  okay: '🙂',
  tired: '😪',
  struggling: '😔',
};

// Higher score renders higher on the sparkline (smaller y).
const MOOD_SCORE: Record<string, number> = {
  good: 4,
  motivated: 4,
  okay: 3,
  tired: 2,
  struggling: 1,
};

const RISK_BADGES: Record<MemberOverview['risk_flag'], { label: string; cls: string; icon?: typeof Flame }> = {
  none: { label: 'OK', cls: 'bg-slate-800 text-slate-400 border-slate-700' },
  low_engagement: { label: 'Low engagement', cls: 'bg-amber-500/15 text-amber-500 border-amber-500/40' },
  mood_decline: { label: 'Mood decline', cls: 'bg-red-500/15 text-red-400 border-red-500/40' },
  coach_open: { label: 'Coach open', cls: 'bg-violet-500/15 text-violet-400 border-violet-500/40', icon: LifeBuoy },
};
function relativeDays(date: string | null | undefined): string {
  if (!date) return 'No activity';
  const t = new Date(`${date}T00:00:00`).getTime();
  if (Number.isNaN(t)) return 'No activity';
  const days = Math.floor((Date.now() - t) / 86_400_000);
  if (days <= 0) return 'Today';
  return days === 1 ? '1d ago' : `${days}d ago`;
}

function Sparkline({ trend }: { trend: MemberOverview['mood_trend'] }) {
  const scores = trend
    .map((p) => (p.mood != null ? MOOD_SCORE[p.mood] : undefined))
    .filter((s): s is number => s !== undefined);
  if (scores.length === 0) {
    return <span className="text-[10px] text-slate-600">No check-ins yet</span>;
  }
  const n = scores.length;
  const x = (i: number) => (n === 1 ? 40 : 2 + (i / (n - 1)) * 76);
  const y = (score: number) => 21 - (score - 1) * 6;
  const points = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ');
  return (
    <svg width="80" height="24" viewBox="0 0 80 24" className="shrink-0" aria-hidden="true">
      <polyline
        points={points}
        fill="none"
        stroke="#f59e0b"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MemberCard({ member }: { member: MemberOverview }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const risk = RISK_BADGES[member.risk_flag] ?? RISK_BADGES.none;

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || busy) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/coach/reply', { user_id: member.user_id, content });
      setDraft('');
      setSent(true);
      window.setTimeout(() => setSent(false), 3000);
    } catch (err: any) {
      setError(err?.message || 'Send failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <motion.div layout className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full text-left px-4 py-3.5 focus:outline-none focus-visible:ring-1 focus-visible:ring-amber-500"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{member.display_name}</div>
            <div className="text-xs text-slate-500">@{member.username}</div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="flex items-center gap-1 text-sm font-bold text-amber-500">
              <Flame size={14} />
              {member.streak}
            </span>
            <span className={`text-[9px] uppercase tracking-wider border rounded-full px-2 py-0.5 flex items-center gap-1 ${risk.cls}`}>
              {risk.icon && <risk.icon size={11} />}
              {risk.label}
            </span>
            <ChevronDown size={14} className={`text-slate-600 transition-transform ${open ? 'rotate-180' : ''}`} />
          </div>
        </div>
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <Sparkline trend={member.mood_trend} />
          <div className="flex items-center gap-2 min-w-0">
            {member.open_coach_messages > 0 && (
              <span className="flex items-center gap-1 shrink-0 text-[9px] uppercase tracking-wider bg-violet-500/15 text-violet-400 border border-violet-500/40 rounded-full px-2 py-0.5">
                <LifeBuoy size={11} />
                {member.open_coach_messages}
              </span>
            )}
            <span className="text-[11px] text-slate-400 truncate">
              {member.active_goals} goals · {member.steps_done_7d} steps this week
            </span>
          </div>
        </div>
        <div className="mt-1.5 text-[10px] text-slate-600">Active {relativeDays(member.last_active_date)}</div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-3 space-y-4 border-t border-slate-800/70">
              <div>
                <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500 mb-1.5">Mood trend</div>
                {member.mood_trend.length === 0 ? (
                  <span className="text-xs text-slate-600">No check-ins yet</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {member.mood_trend.map((p) => (
                      <span
                        key={p.date}
                        title={p.date}
                        className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-full px-2.5 py-1"
                      >
                        <span className="text-xs leading-none">{p.mood ? (MOOD_EMOJI[p.mood] ?? '•') : '–'}</span>
                        <span className="text-[10px] text-slate-500">{p.date.slice(5)}</span>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <form onSubmit={sendReply} className="space-y-2">
                <textarea
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    setSent(false);
                  }}
                  placeholder={`Message ${member.display_name} as their coach…`}
                  rows={2}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-violet-500 placeholder:text-slate-600 resize-none"
                />
                {error && <div className="text-xs text-red-400">{error}</div>}
                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="flex items-center gap-1.5 bg-violet-500 hover:bg-violet-400 disabled:opacity-40 text-white font-bold rounded-xl px-4 py-2.5 text-sm"
                  >
                    <Send size={13} />
                    {busy ? 'Sending…' : 'Send'}
                  </button>
                  {sent && <span className="text-xs font-bold text-emerald-400">Sent</span>}
                </div>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function StatusPanel() {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    setError(false);
    try {
      setOverview(await api.get<AdminOverviewResponse>('/auth/admin/overview'));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
  }, []);

  const members = overview?.members ?? [];
  const flagged = members.filter((m) => m.risk_flag !== 'none').length;
  const avgStreak =
    members.length === 0 ? 0 : Math.round(members.reduce((sum, m) => sum + m.streak, 0) / members.length);

  if (error) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
        <p className="text-sm text-slate-400">Couldn't load member status. Check the connection and try again.</p>
        <button
          type="button"
          onClick={load}
          className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl px-4 py-2.5 text-sm"
        >
          <RefreshCw size={14} /> Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Members</div>
          <div className="text-lg font-black mt-0.5">{members.length}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Flagged</div>
          <div className={`text-lg font-black mt-0.5 ${flagged > 0 ? 'text-amber-500' : ''}`}>{flagged}</div>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl px-3 py-3">
          <div className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-500">Avg streak</div>
          <div className="text-lg font-black mt-0.5 flex items-center gap-1">
            <Flame size={14} className="text-amber-500" />
            {avgStreak}
          </div>
        </div>
      </div>

      {overview && !Number.isNaN(new Date(overview.generated_at).getTime()) && (
        <div className="text-[10px] text-slate-600">
          Updated{' '}
          {new Date(overview.generated_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {members.map((m) => (
          <MemberCard key={m.user_id} member={m} />
        ))}
      </div>

      {!loading && members.length === 0 && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
          No members yet. Create accounts in the Accounts tab.
        </div>
      )}
    </div>
  );
}

function AccountsPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetFor, setResetFor] = useState<number | null>(null);
  const [resetPw, setResetPw] = useState('');

  async function load() {
    const res = await api.get<{ users: AdminUser[] }>('/auth/admin/users');
    setUsers(res.users);
  }
  useEffect(() => {
    load().catch(() => {});
  }, []);

  async function createUser(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      await api.post('/auth/admin/users', {
        username: username.trim(),
        password,
        display_name: displayName.trim() || username.trim(),
      });
      setMsg({ ok: true, text: `Account created for ${displayName.trim() || username.trim()}` });
      setUsername('');
      setDisplayName('');
      setPassword('');
      await load();
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Create failed' });
    } finally {
      setBusy(false);
    }
  }

  async function doReset(e: React.FormEvent) {
    e.preventDefault();
    if (resetFor == null || !resetPw) return;
    try {
      await api.post(`/auth/admin/users/${resetFor}/reset-password`, { password: resetPw });
      setMsg({ ok: true, text: 'Password reset' });
      setResetFor(null);
      setResetPw('');
    } catch (err: any) {
      setMsg({ ok: false, text: err?.message || 'Reset failed' });
    }
  }

  return (
    <div className="space-y-5">
      {msg && (
        <div
          className={`text-sm rounded-xl px-4 py-3 border ${msg.ok ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40' : 'text-red-400 bg-red-950/30 border-red-900/40'}`}
        >
          {msg.text}
        </div>
      )}

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
          <UserPlus size={13} /> Create alumni account
        </h2>
        <form onSubmit={createUser} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username (e.g. sipho)"
            autoCapitalize="none"
            required
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
          />
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Full name (e.g. Sipho Dlamini)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            required
            minLength={4}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
          />
          <button
            type="submit"
            disabled={busy}
            className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl px-4 py-2.5 text-sm"
          >
            {busy ? 'Creating…' : 'Create account'}
          </button>
        </form>
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
          <Users size={13} /> Accounts ({users.length})
        </h2>
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3"
            >
              <div>
                <div className="text-sm font-bold">
                  {u.display_name}
                  {u.role === 'admin' && (
                    <span className="ml-2 text-[9px] uppercase tracking-wider bg-amber-500/20 text-amber-500 border border-amber-500/40 rounded-full px-2 py-0.5">
                      Admin
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-500">@{u.username}</div>
              </div>
              {u.role !== 'admin' && (
                <button
                  onClick={() => {
                    setResetFor(resetFor === u.id ? null : u.id);
                    setResetPw('');
                  }}
                  className="text-slate-500 hover:text-amber-500 p-2"
                  aria-label="Reset password"
                >
                  <KeyRound size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
        {resetFor != null && (
          <form onSubmit={doReset} className="mt-2 flex gap-2">
            <input
              type="password"
              value={resetPw}
              onChange={(e) => setResetPw(e.target.value)}
              placeholder="New password"
              minLength={4}
              required
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
            />
            <button type="submit" className="bg-amber-500 text-slate-950 font-bold rounded-xl px-4 text-sm">
              Set
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
          Coach Inbox
        </h2>
        <CoachInbox />
      </section>
    </div>
  );
}


// ---- Bra Hero persona editor (admin) ----
interface PersonaState {
  persona: string;
  is_custom: boolean;
  updated_at: string | null;
  default: string;
}

function PersonaPanel() {
  const [state, setState] = useState<PersonaState | null>(null);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  async function load() {
    try {
      const res = await api.get<PersonaState>('/auth/admin/persona');
      setState(res);
      setDraft(res.persona);
      setDirty(false);
    } catch {
      setMsg({ kind: 'err', text: 'Could not load the persona.' });
    }
  }
  useEffect(() => { load(); }, []);

  async function save() {
    if (saving || !dirty) return;
    setSaving(true);
    setMsg(null);
    try {
      await api.put('/auth/admin/persona', { persona: draft });
      setMsg({ kind: 'ok', text: 'Saved. Bra Hero speaks with this voice from the next message.' });
      setDirty(false);
      try { navigator.vibrate?.(10); } catch { /* desktop */ }
      await load();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Save failed' });
    } finally {
      setSaving(false);
    }
  }

  async function resetDefault() {
    if (saving) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await api.del<{ persona: string }>('/auth/admin/persona');
      setDraft(res.persona);
      setDirty(false);
      setMsg({ kind: 'ok', text: 'Back to the default Bra Hero voice.' });
      await load();
    } catch (err: any) {
      setMsg({ kind: 'err', text: err?.message || 'Reset failed' });
    } finally {
      setSaving(false);
    }
  }

  if (!state) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-400">
        Loading persona...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
        <div className="flex items-center gap-2">
          <img src="/brand/bra-hero.png" alt="" className="h-9 w-9 rounded-full ring-2 ring-amber-500/40" />
          <div>
            <div className="text-sm font-black">Bra Hero's voice</div>
            <div className="text-[10px] uppercase tracking-widest text-slate-500">
              {state.is_custom ? `Custom - updated ${state.updated_at?.slice(0, 10)}` : 'Default voice'}
            </div>
          </div>
        </div>
        <p className="text-xs text-slate-400 leading-relaxed">
          Describe how Bra Hero should sound - his tone, his attitude, what he cares about. The app's machinery
          (goal logging, check-ins, money, coach escalation) keeps working no matter what you write here. Keep it
          under ~600 words. Do not try to change the reply format.
        </p>
      </div>

      <textarea
        value={draft}
        onChange={(e) => { setDraft(e.target.value); setDirty(true); }}
        rows={12}
        maxLength={4000}
        className="w-full rounded-2xl bg-slate-900 border border-slate-800 focus:border-amber-500/60 outline-none p-4 text-sm text-slate-100 leading-relaxed resize-y min-h-[220px]"
        placeholder={'You are "Bra Hero"... describe his voice, his values, how he talks to the young men.'}
      />

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={resetDefault}
          disabled={saving || !state.is_custom}
          className="text-xs font-bold uppercase tracking-wider text-slate-400 hover:text-red-400 disabled:opacity-40 min-h-[44px] px-3"
        >
          Reset to default
        </button>
        <div className="flex items-center gap-3">
          <span className="text-[10px] text-slate-500">{draft.length}/4000</span>
          <button
            type="button"
            onClick={save}
            disabled={saving || !dirty}
            className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-black rounded-xl px-5 min-h-[44px] text-sm"
          >
            {saving ? 'Saving...' : 'Save voice'}
          </button>
        </div>
      </div>

      {msg && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={`text-xs ${msg.kind === 'ok' ? 'text-emerald-400' : 'text-red-400'}`}
        >
          {msg.text}
        </motion.p>
      )}
    </div>
  );
}

type AdminTab = 'status' | 'accounts' | 'persona';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'persona', label: 'Bra Hero' },
];

export default function Admin() {
  const [tab, setTab] = useState<AdminTab>('status');

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-black text-xl">Admin</h1>
        <p className="text-slate-400 text-sm mt-0.5">Keep an eye on every member and manage their accounts.</p>
      </div>

      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`relative flex-1 min-h-[44px] rounded-xl px-3 py-2.5 text-sm font-bold ${tab === t.id ? 'text-slate-950' : 'text-slate-400'}`}
          >
            {tab === t.id && (
              <motion.span
                layoutId="admin-tab-pill"
                className="absolute inset-0 bg-amber-500 rounded-xl"
                transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
              />
            )}
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>

      {tab === 'status' && <StatusPanel />}
      {tab === 'accounts' && <AccountsPanel />}
      {tab === 'persona' && <PersonaPanel />}
    </div>
  );
}
