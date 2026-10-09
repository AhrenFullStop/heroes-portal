import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { Send, CheckCircle2 } from 'lucide-react';
import { api } from '../api';
import type { ChatMessage } from '../../../shared/types';

interface Turn extends ChatMessage {
  pending?: boolean;
}

const QUICK_ACTIONS = [
  'How did today go?',
  'Money check-in',
  'I want to get my driver\u2019s licence',
  'Talk to a coach',
];

export default function Chat({ userName }: { userName: string }) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionLabels, setActionLabels] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api.get<{ messages: ChatMessage[] }>('/chat').then((res) => {
      setMessages(res.messages.map((m) => ({ ...m, pending: false })));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    setBusy(true);
    setInput('');
    setActionLabels([]);
    const optimistic: Turn = {
      id: -Date.now(),
      role: 'user',
      content: trimmed,
      created_at: new Date().toISOString(),
    };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await api.post<{ reply: string; actions: string[]; message_id?: number }>('/chat', { message: trimmed });
      setMessages((m) => [
        ...m,
        {
          id: res.message_id ?? -Date.now(),
          role: 'assistant',
          content: res.reply,
          created_at: new Date().toISOString(),
        },
      ]);
      setActionLabels(res.actions ?? []);
    } catch (err: any) {
      setMessages((m) => [
        ...m,
        {
          id: -Date.now(),
          role: 'assistant',
          content: err?.status === 401 ? 'Your session expired. Refresh the page.' : 'Ai, something broke on my side. Try again.',
          created_at: new Date().toISOString(),
        },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2 space-y-4">
        {messages.length === 0 && (
          <div className="text-center pt-10 px-6">
            <div className="w-16 h-16 rounded-2xl bg-amber-500 mx-auto flex items-center justify-center mb-4">
              <span className="text-slate-950 font-black text-3xl">H</span>
            </div>
            <h2 className="font-black text-xl">Bra Hero is listening, {userName.split(' ')[0]}.</h2>
            <p className="text-slate-400 text-sm mt-2 max-w-xs mx-auto">
              Tell me how today went. Or what you're chasing. We'll make a plan together.
            </p>
          </div>
        )}
        {messages.map((m) => (
          <motion.div
            key={m.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                m.role === 'user'
                  ? 'bg-amber-500 text-slate-950 rounded-br-md font-medium'
                  : 'bg-slate-800 text-slate-100 rounded-bl-md'
              }`}
            >
              {m.content}
            </div>
          </motion.div>
        ))}
        {busy && (
          <div className="flex justify-start">
            <div className="bg-slate-800 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-slate-400">
              <span className="animate-pulse">Bra Hero is thinking…</span>
            </div>
          </div>
        )}
        {actionLabels.length > 0 && !busy && (
          <div className="space-y-1.5 pt-1">
            {actionLabels.map((label, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-950/30 border border-emerald-900/40 rounded-full px-3 py-1.5 w-fit"
              >
                <CheckCircle2 size={13} />
                {label}
              </motion.div>
            ))}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <div className="px-4 pb-2">
        <div className="flex gap-2 overflow-x-auto pb-2">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa}
              onClick={() => send(qa)}
              disabled={busy}
              className="whitespace-nowrap text-xs bg-slate-800 hover:bg-slate-700 disabled:opacity-40 border border-slate-700 rounded-full px-3 py-1.5 text-slate-300 transition-colors"
            >
              {qa}
            </button>
          ))}
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
        >
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your message…"
              className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="bg-amber-500 disabled:opacity-40 hover:bg-amber-400 text-slate-950 rounded-2xl px-4 transition-colors"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
