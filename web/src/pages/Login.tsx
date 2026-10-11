import { useState } from 'react';
import { motion } from 'motion/react';
import { api } from '../api';
import type { User } from '../../../shared/types';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [shake, setShake] = useState(0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      const res = await api.post<{ user: User }>('/auth/login', { username, password });
      onLogin(res.user);
    } catch (err: any) {
      setError(err?.message === 'Not logged in' ? 'Wrong username or password' : err?.message || 'Login failed');
      setShake((n) => n + 1);
      setBusy(false);
    }
  }

  const field =
    'w-full min-h-12 rounded-xl bg-slate-900 border border-slate-800 px-4 text-sm text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-amber-500 transition-colors';

  return (
    <div className="min-h-dvh bg-slate-950 flex flex-col items-center justify-center px-6 py-10">
      <div className="w-full max-w-sm flex flex-col items-center">
        {/* Portrait with soft amber glow */}
        <div className="relative">
          <div className="absolute -inset-6 rounded-full bg-amber-500/20 blur-2xl pointer-events-none" />
          <motion.img
            src="/brand/portrait.png"
            alt="HEROES Academy"
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            className="relative h-36 w-auto object-contain"
          />
        </div>

        {/* Wordmark */}
        <motion.img
          src="/brand/wordmark.png"
          alt="HEROES"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
          className="h-10 w-auto object-contain mt-4"
        />

        {/* Values row */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.5 }}
          className="flex items-center gap-3 mt-5"
        >
          {['RESPONSIBILITY', 'RESPECT', 'DISCIPLINE'].map((v, i) => (
            <span key={v} className="flex items-center gap-3">
              {i > 0 && <span className="w-1 h-1 rounded-full bg-amber-500/60" />}
              <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500">{v}</span>
            </span>
          ))}
        </motion.div>

        {/* Form */}
        <motion.form
          key={shake}
          onSubmit={submit}
          initial={shake > 0 ? { x: 0 } : false}
          animate={shake > 0 ? { x: [0, -9, 9, -6, 6, 0] } : undefined}
          transition={{ duration: 0.4 }}
          className="w-full mt-9 space-y-3"
        >
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect="off"
            autoComplete="username"
            className={field}
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className={field}
          />

          {error && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-sm font-bold text-red-400 text-center"
            >
              {error}
            </motion.p>
          )}

          <button
            type="submit"
            disabled={busy || !username.trim() || !password}
            className="w-full min-h-12 rounded-xl bg-amber-500 text-slate-950 font-black text-base disabled:opacity-40 hover:bg-amber-400 transition-colors"
          >
            {busy ? 'Signing in…' : 'Sign in'}
          </button>
        </motion.form>

        <p className="text-[10px] uppercase tracking-widest text-slate-600 mt-10 text-center">
          HEROES Academy · Alumni Portal
        </p>
      </div>
    </div>
  );
}
