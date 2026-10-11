import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Send, LifeBuoy } from 'lucide-react';
import { api } from '../api';
import type { CoachMessage, CoachThread } from '../../../shared/types';

// Admin-side coach inbox: threads from all alumni, reply inline.
export function CoachInbox() {
  const [threads, setThreads] = useState<CoachThread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const res = await api.get<{ threads: CoachThread[] }>('/coach/inbox');
      setThreads(res.threads ?? []);
    } catch {
      setThreads([]);
    }
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function send(userId: number) {
    const content = reply.trim();
    if (!content || busy) return;
    setBusy(true);
    try {
      await api.post('/coach/reply', { user_id: userId, content });
      setReply('');
      await load();
    } catch {
      // keep the draft on failure
    } finally {
      setBusy(false);
    }
  }

  if (threads.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-6 text-center">
        <LifeBuoy className="mx-auto mb-2 text-slate-600" size={22} />
        <p className="text-sm text-slate-500">No coach messages from the members yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {threads.map((t) => {
        const active = activeId === t.user_id;
        return (
          <div key={t.user_id} className="rounded-2xl border border-slate-800/60 bg-slate-900/40 overflow-hidden">
            <button
              onClick={() => setActiveId(active ? null : t.user_id)}
              className="w-full flex items-center justify-between px-4 py-3 text-left min-h-[44px]"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm">
                  {t.display_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm font-bold text-slate-100">{t.display_name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500">@{t.username}</div>
                </div>
              </div>
              {t.unresolved > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-300 text-[10px] font-bold uppercase tracking-wider">
                  {t.unresolved} open
                </span>
              )}
            </button>
            {active && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="px-4 pb-4 space-y-2.5">
                {t.messages.map((m) => (
                  <div key={m.id} className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                    m.direction === 'from_coach'
                      ? 'ml-auto bg-amber-500/15 text-amber-100 border border-amber-500/30'
                      : 'bg-slate-800/70 text-slate-200'
                  }`}>
                    {m.content}
                  </div>
                ))}
                <form onSubmit={(e) => { e.preventDefault(); send(t.user_id); }} className="flex gap-2 pt-1">
                  <input
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    placeholder="Reply as coach..."
                    className="flex-1 min-h-[44px] rounded-xl bg-slate-800/70 border border-slate-700/60 px-3 text-sm text-slate-100 placeholder:text-slate-500 outline-none focus:border-amber-500/60"
                  />
                  <button
                    type="submit"
                    disabled={busy || !reply.trim()}
                    className="min-h-[44px] px-4 rounded-xl bg-amber-500 text-slate-950 font-bold disabled:opacity-40 flex items-center"
                  >
                    <Send size={15} />
                  </button>
                </form>
              </motion.div>
            )}
          </div>
        );
      })}
    </div>
  );
}
