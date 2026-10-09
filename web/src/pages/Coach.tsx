import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Send, LifeBuoy } from 'lucide-react';
import { api } from '../api';
import type { User, CoachMessage, CoachThread } from '../../../shared/types';

export default function Coach({ user }: { user: User }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  async function load() {
    const res = await api.get<{ messages: CoachMessage[] }>('/coach/thread');
    setMessages(res.messages);
  }
  useEffect(() => { load().catch(() => {}); }, []);
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput('');
    try {
      await api.post('/coach/messages', { content: text });
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <LifeBuoy size={18} className="text-amber-500" />
          <h1 className="font-black text-xl">HEROES Coach</h1>
        </div>
        <p className="text-slate-400 text-sm mt-0.5">
          A real person from the HEROES team. Honest questions get honest help.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-2 space-y-3">
        {messages.length === 0 && (
          <div className="text-center pt-8 px-6">
            <p className="text-slate-500 text-sm">
              No messages yet. Write to your coach below - about anything. Work, family, money, safety.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.direction === 'to_coach' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.direction === 'to_coach'
                  ? 'bg-amber-500 text-slate-950 rounded-br-md font-medium'
                  : 'bg-slate-800 text-slate-100 rounded-bl-md'
              }`}
            >
              {m.direction === 'from_coach' && (
                <div className="text-[10px] uppercase tracking-widest font-bold text-amber-500 mb-1">Coach</div>
              )}
              {m.content}
            </div>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 px-4 pb-4">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Write to your coach…"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={busy || !input.trim()}
          className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 rounded-2xl px-4 font-bold text-sm transition-colors"
        >
          Send
        </button>
      </form>
    </div>
  );
}

// ---------- Admin coach inbox ----------

export function CoachInbox() {
  const [threads, setThreads] = useState<CoachThread[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get<{ threads: CoachThread[] }>('/coach/inbox');
    setThreads(res.threads);
    if (res.threads.length > 0 && activeId == null) setActiveId(res.threads[0].user_id);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function sendReply(e: React.FormEvent) {
    e.preventDefault();
    if (activeId == null || !reply.trim() || busy) return;
    setBusy(true);
    try {
      await api.post('/coach/reply', { user_id: activeId, content: reply.trim() });
      setReply('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  const active = threads.find((t) => t.user_id === activeId);

  return (
    <div className="space-y-4">
      {threads.length === 0 ? (
        <p className="text-slate-500 text-sm text-center py-6">No coach messages yet.</p>
      ) : (
        <>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {threads.map((t) => (
              <button
                key={t.user_id}
                onClick={() => setActiveId(t.user_id)}
                className={`whitespace-nowrap rounded-xl px-3 py-2 text-xs font-bold transition-colors ${
                  activeId === t.user_id
                    ? 'bg-amber-500 text-slate-950'
                    : 'bg-slate-900 border border-slate-800 text-slate-400'
                }`}
              >
                {t.display_name}
                {t.unresolved > 0 && (
                  <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${activeId === t.user_id ? 'bg-slate-950/20' : 'bg-red-950/60 text-red-400'}`}>
                    {t.unresolved}
                  </span>
                )}
              </button>
            ))}
          </div>

          {active && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
              <div className="space-y-2 max-h-72 overflow-y-auto">
                {active.messages.map((m) => (
                  <div key={m.id} className={`flex ${m.direction === 'to_coach' ? 'justify-start' : 'justify-end'}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3 py-2 text-sm ${
                        m.direction === 'to_coach' ? 'bg-slate-800 text-slate-200' : 'bg-amber-500/90 text-slate-950'
                      }`}
                    >
                      {m.content}
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={sendReply} className="flex gap-2">
                <input
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={`Reply to ${active.display_name}…`}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
                <button
                  type="submit"
                  disabled={busy || !reply.trim()}
                  className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold rounded-xl px-4 text-sm"
                >
                  Reply
                </button>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
