import { useState } from 'react';
import { motion } from 'motion/react';
import { ShieldCheck, Flame, Heart, Users, ArrowRight } from 'lucide-react';
import { api } from '../api';
import type { User } from '../../../shared/types';

export default function Login({ onLogin }: { onLogin: (user: User) => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

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
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col md:flex-row">
      {/* Hero side */}
      <div className="relative flex-1 bg-gradient-to-br from-slate-900 via-slate-900 to-amber-950/40 flex flex-col justify-between p-8 md:p-14 overflow-hidden">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center">
            <span className="text-slate-950 font-black text-2xl">H</span>
          </div>
          <div>
            <div className="font-black tracking-widest text-lg">HEROES</div>
            <div className="text-[10px] uppercase tracking-[0.2em] text-slate-400">Alumni Portal</div>
          </div>
        </div>

        <div className="my-10">
          <motion.h1
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-4xl md:text-5xl font-black leading-tight max-w-md"
          >
            Your brothers walked out with you.
            <span className="text-amber-500"> We walk with you still.</span>
          </motion.h1>
          <p className="mt-4 text-slate-400 max-w-md text-sm leading-relaxed">
            One place for your goals, your money, your body and your circle. And an older brother
            who answers when you need him.
          </p>
        </div>

        <div className="flex gap-6 text-xs">
          <div className="flex items-center gap-2 text-amber-500">
            <ShieldCheck size={16} />
            <span className="uppercase tracking-wider font-semibold">Responsibility</span>
          </div>
          <div className="flex items-center gap-2 text-amber-500">
            <Heart size={16} />
            <span className="uppercase tracking-wider font-semibold">Respect</span>
          </div>
          <div className="flex items-center gap-2 text-amber-500">
            <Flame size={16} />
            <span className="uppercase tracking-wider font-semibold">Discipline</span>
          </div>
        </div>
        <div className="hidden md:flex items-center gap-2 text-slate-600 text-xs mt-6">
          <Users size={14} /> HEROES Academy Alumni Programme
        </div>
      </div>

      {/* Form side */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-950">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="w-full max-w-sm"
        >
          <h2 className="text-2xl font-black mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-8">Log in with the account your HEROES admin gave you.</p>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
                Username
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoCapitalize="none"
                autoCorrect="off"
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                placeholder="e.g. sipho"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                placeholder="Your password"
              />
            </div>
            {error && (
              <div className="text-red-400 text-sm bg-red-950/40 border border-red-900/40 rounded-xl px-4 py-3">
                {error}
              </div>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl px-4 py-3.5 text-sm flex items-center justify-center gap-2 transition-colors"
            >
              {busy ? 'Logging in…' : 'Enter the portal'}
              {!busy && <ArrowRight size={16} />}
            </button>
          </form>
        </motion.div>
      </div>
    </div>
  );
}
