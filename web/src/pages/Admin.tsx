import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  Briefcase,
  ChevronDown,
  Eye,
  Flame,
  Image as ImageIcon,
  KeyRound,
  LifeBuoy,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { buzz } from '../panels/shared';
import { CoachInbox } from './CoachInbox';
import type {
  AdminOverviewResponse,
  AdminUser,
  MemberOverview,
  Opportunity,
  PersonaState,
} from '../../../shared/types';

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
          <img src="/brand/bra-hero-256.jpg" alt="" className="h-9 w-9 rounded-full ring-2 ring-amber-500/40" />
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

// ---- Opportunities management (admin) ----

const KIND_STYLES: Record<Opportunity['kind'], string> = {
  job: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/40',
  learnership: 'bg-sky-500/15 text-sky-400 border-sky-500/40',
  bursary: 'bg-violet-500/15 text-violet-400 border-violet-500/40',
  training: 'bg-amber-500/15 text-amber-500 border-amber-500/40',
};

const KINDS: Opportunity['kind'][] = ['job', 'learnership', 'bursary', 'training'];

/** Opportunity photo via the auth-cookie image endpoint. Hides itself on error. */
function OppImage({ oppId }: { oppId: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .getBlob(`/auth/opportunities/${oppId}/image`)
      .then((blob) => {
        if (alive) setUrl(URL.createObjectURL(blob));
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [oppId]);

  if (!url || failed) return null;
  return (
    <img
      src={url}
      alt=""
      className="w-16 h-16 rounded-xl object-cover shrink-0 bg-slate-800"
      onError={() => setFailed(true)}
    />
  );
}

interface OppFormState {
  title: string;
  org: string;
  kind: Opportunity['kind'];
  location: string;
  apply_url: string;
  description: string;
  closes_on: string;
}

const EMPTY_FORM: OppFormState = {
  title: '',
  org: '',
  kind: 'job',
  location: '',
  apply_url: '',
  description: '',
  closes_on: '',
};

const inputCls =
  'w-full min-h-[44px] bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600';

function OpportunityRow({
  opp,
  onChanged,
}: {
  opp: Opportunity;
  onChanged: (updated: Opportunity) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<OppFormState>({
    title: opp.title,
    org: opp.org,
    kind: opp.kind,
    location: opp.location ?? '',
    apply_url: opp.apply_url ?? '',
    description: opp.description ?? '',
    closes_on: opp.closes_on?.slice(0, 10) ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function set<K extends keyof OppFormState>(key: K, value: OppFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.put<{ opportunity: Opportunity }>(`/auth/admin/opportunities/${opp.id}`, {
        title: form.title.trim(),
        org: form.org.trim(),
        kind: form.kind,
        location: form.location.trim() || null,
        apply_url: form.apply_url.trim() || null,
        description: form.description.trim() || null,
        closes_on: form.closes_on || null,
      });
      onChanged(res.opportunity);
      setEditing(false);
      buzz();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await api.put<{ opportunity: Opportunity }>(`/auth/admin/opportunities/${opp.id}`, {
        active: !opp.active,
      });
      onChanged(res.opportunity);
      buzz();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusy(false);
    }
  }

  async function changeImage(file: File) {
    if (uploading) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('image', file);
      await api.postForm(`/auth/admin/opportunities/${opp.id}/image`, fd);
      buzz();
      onChanged({ ...opp }); // parent refetches; the image component remounts via key
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  const closesLabel = opp.closes_on
    ? new Date(`${opp.closes_on.slice(0, 10)}T00:00:00`).toLocaleDateString('en-ZA', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      })
    : null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
      <div className="flex items-start gap-3">
        <OppImage key={`${opp.id}-${opp.image_url ?? 'none'}`} oppId={opp.id} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold leading-snug">{opp.title}</div>
              <div className="text-xs text-slate-500 mt-0.5">{opp.org}</div>
            </div>
            <span
              className={`shrink-0 text-[9px] font-bold uppercase tracking-wider border rounded-full px-2 py-0.5 ${KIND_STYLES[opp.kind]}`}
            >
              {opp.kind}
            </span>
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
            {opp.location && <span>{opp.location}</span>}
            {closesLabel && <span>Closes {closesLabel}</span>}
            <span className={opp.active ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
              {opp.active ? 'Active' : 'Deactivated'}
            </span>
          </div>
        </div>
      </div>

      {error && <div className="text-xs text-red-400">{error}</div>}

      {!editing ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditing(true);
              buzz();
            }}
            className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:border-amber-500/50 transition-colors"
          >
            <Pencil size={13} /> Edit
          </button>
          <button
            type="button"
            onClick={toggleActive}
            disabled={busy}
            className="min-h-[44px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:border-amber-500/50 disabled:opacity-40 transition-colors"
          >
            {opp.active ? 'Deactivate' : 'Activate'}
          </button>
          <label className="flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-slate-800 border border-slate-700 text-slate-300 text-xs font-bold hover:border-amber-500/50 transition-colors cursor-pointer">
            <ImageIcon size={13} /> {uploading ? 'Uploading…' : 'Image'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) changeImage(f);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      ) : (
        <form onSubmit={saveEdit} className="space-y-2 pt-1 border-t border-slate-800/70">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title" required className={inputCls} />
          <input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="Organisation" className={inputCls} />
          <select value={form.kind} onChange={(e) => set('kind', e.target.value as Opportunity['kind'])} className={inputCls}>
            {KINDS.map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" className={inputCls} />
          <input value={form.apply_url} onChange={(e) => set('apply_url', e.target.value)} placeholder="Apply URL" className={inputCls} />
          <textarea
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Description"
            rows={3}
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600 resize-y"
          />
          <input type="date" value={form.closes_on} onChange={(e) => set('closes_on', e.target.value)} className={inputCls} />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="min-h-[44px] px-4 rounded-xl bg-slate-800 text-slate-400 text-xs font-bold border border-slate-700 hover:text-slate-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || !form.title.trim()}
              className="min-h-[44px] px-5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-40 hover:bg-amber-400"
            >
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function OpportunitiesPanel() {
  const [opps, setOpps] = useState<Opportunity[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState<OppFormState>(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function load() {
    setError(null);
    try {
      const res = await api.get<{ opportunities: Opportunity[] }>('/work/opportunities');
      setOpps(res.opportunities);
      setLoaded(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not load opportunities');
      setLoaded(true);
    }
  }
  useEffect(() => {
    load();
  }, []);

  function set<K extends keyof OppFormState>(key: K, value: OppFormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function addOpportunity(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await api.post<{ opportunity: Opportunity }>('/auth/admin/opportunities', {
        title: form.title.trim(),
        org: form.org.trim(),
        kind: form.kind,
        location: form.location.trim() || null,
        apply_url: form.apply_url.trim() || null,
        description: form.description.trim() || null,
        closes_on: form.closes_on || null,
      });
      setOpps((os) => [res.opportunity, ...os]);
      setForm(EMPTY_FORM);
      setAdding(false);
      buzz();
      setMsg({ ok: true, text: `Added "${res.opportunity.title}"` });
    } catch (err: unknown) {
      setMsg({ ok: false, text: err instanceof Error ? err.message : 'Create failed' });
    } finally {
      setBusy(false);
    }
  }

  function onRowChanged(updated: Opportunity) {
    // PUT returns the full row; deactivate drops it from the public feed on the
    // next load, but keep it visible here so the admin can re-activate.
    setOpps((os) => os.map((o) => (o.id === updated.id ? { ...updated, image_url: updated.image_url ?? o.image_url } : o)));
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
        <button
          type="button"
          onClick={() => {
            setAdding((a) => !a);
            buzz();
          }}
          className="w-full flex items-center justify-between min-h-[44px] px-4 rounded-2xl bg-slate-900 border border-slate-800 text-left"
        >
          <span className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
            <Plus size={13} /> Add opportunity
          </span>
          <ChevronDown size={14} className={`text-slate-600 transition-transform ${adding ? 'rotate-180' : ''}`} />
        </button>
        <AnimatePresence initial={false}>
          {adding && (
            <motion.form
              onSubmit={addOpportunity}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="overflow-hidden"
            >
              <div className="mt-2 bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-2">
                <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Title (e.g. NSFAS Bursary 2027)" required className={inputCls} />
                <input value={form.org} onChange={(e) => set('org', e.target.value)} placeholder="Organisation" className={inputCls} />
                <select value={form.kind} onChange={(e) => set('kind', e.target.value as Opportunity['kind'])} className={inputCls}>
                  {KINDS.map((k) => (
                    <option key={k} value={k}>
                      {k}
                    </option>
                  ))}
                </select>
                <input value={form.location} onChange={(e) => set('location', e.target.value)} placeholder="Location" className={inputCls} />
                <input value={form.apply_url} onChange={(e) => set('apply_url', e.target.value)} placeholder="Apply URL" className={inputCls} />
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  placeholder="Description"
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600 resize-y"
                />
                <input type="date" value={form.closes_on} onChange={(e) => set('closes_on', e.target.value)} className={inputCls} />
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={busy || !form.title.trim()}
                    className="min-h-[44px] px-5 rounded-xl bg-amber-500 text-slate-950 text-xs font-black disabled:opacity-40 hover:bg-amber-400"
                  >
                    {busy ? 'Adding…' : 'Add opportunity'}
                  </button>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </section>

      {!loaded ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-400">
          Loading opportunities...
        </div>
      ) : error ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center space-y-3">
          <p className="text-sm text-slate-400">{error}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl px-4 py-2.5 text-sm"
          >
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : opps.length === 0 ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 text-center text-sm text-slate-500">
          No opportunities yet. Add the first one above.
        </div>
      ) : (
        <div className="space-y-3">
          {opps.map((o) => (
            <OpportunityRow key={o.id} opp={o} onChanged={onRowChanged} />
          ))}
        </div>
      )}
    </div>
  );
}


type AdminTab = 'status' | 'accounts' | 'persona' | 'opportunities';

const TABS: { id: AdminTab; label: string }[] = [
  { id: 'status', label: 'Status' },
  { id: 'accounts', label: 'Accounts' },
  { id: 'persona', label: 'Bra Hero' },
  { id: 'opportunities', label: 'Opportunities' },
];

export default function Admin({ onExperienceMember }: { onExperienceMember: () => void }) {
  const [tab, setTab] = useState<AdminTab>('status');

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-black text-xl">Dashboard</h1>
          <p className="text-slate-400 text-sm mt-0.5">Keep an eye on every member and manage the community.</p>
        </div>
        <button
          type="button"
          onClick={onExperienceMember}
          className="shrink-0 flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-xl px-4 min-h-[44px] text-xs uppercase tracking-wider active:scale-95 transition"
        >
          <Eye size={14} />
          Experience as member
        </button>
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
      {tab === 'opportunities' && <OpportunitiesPanel />}
    </div>
  );
}
