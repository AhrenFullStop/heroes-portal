import { useEffect, useState } from 'react';
import { Users, UserPlus, KeyRound, Trash2 } from 'lucide-react';
import { api } from '../api';
import { CoachInbox } from './Coach';
import type { AdminUser } from '../../../shared/types';

export default function Admin() {
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
  useEffect(() => { load().catch(() => {}); }, []);

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
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-5">
      <div>
        <h1 className="font-black text-xl">Admin</h1>
        <p className="text-slate-400 text-sm mt-0.5">Create alumni accounts and answer coach messages.</p>
      </div>

      {msg && (
        <div className={`text-sm rounded-xl px-4 py-3 border ${msg.ok ? 'text-emerald-400 bg-emerald-950/30 border-emerald-900/40' : 'text-red-400 bg-red-950/30 border-red-900/40'}`}>
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
            <div key={u.id} className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
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
                  onClick={() => { setResetFor(resetFor === u.id ? null : u.id); setResetPw(''); }}
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
