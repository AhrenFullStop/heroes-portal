import { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ChevronLeft, MessageCircle, Send } from 'lucide-react';
import { api } from '../api';
import type { DirectMessage, DmConversation } from '../../../shared/types';
import { buzz, PanelHeader, PanelMount, PanelState } from './shared';

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const t = new Date(iso.endsWith('Z') || iso.includes('T') ? iso : `${iso}Z`).getTime();
  if (Number.isNaN(t)) return '';
  const s = Math.max(0, (Date.now() - t) / 1000);
  if (s < 60) return 'just now';
  const m = s / 60;
  if (m < 60) return `${Math.floor(m)}m ago`;
  const h = m / 60;
  if (h < 24) return `${Math.floor(h)}h ago`;
  const d = h / 24;
  if (d < 7) return `${Math.floor(d)}d ago`;
  return new Date(t).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

function Avatar({ name, size = 'md' }: { name: string; size?: 'md' | 'lg' }) {
  const cls = size === 'lg' ? 'w-11 h-11 text-base' : 'w-9 h-9 text-sm';
  return (
    <div
      className={`${cls} rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black shrink-0`}
    >
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function ConversationList({
  onOpen,
}: {
  onOpen: (userId: number, displayName: string) => void;
}) {
  const [conversations, setConversations] = useState<DmConversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let alive = true;
    api
      .get<{ conversations: DmConversation[] }>('/circle/dm/conversations')
      .then((r) => {
        if (!alive) return;
        setConversations(r.conversations);
        setLoaded(true);
      })
      .catch(() => {
        if (alive) {
          setError(true);
          setLoaded(true);
        }
      });
    return () => {
      alive = false;
    };
  }, []);

  if (!loaded) {
    return (
      <PanelState busy>Loading conversations…</PanelState>
    );
  }
  if (error) {
    return <PanelState>Could not load conversations. Try again.</PanelState>;
  }
  if (conversations.length === 0) {
    return (
      <PanelState>
        No brothers to message yet. Open the Circle and say hello — conversations show up here.
      </PanelState>
    );
  }

  return (
    <div className="space-y-2">
      {conversations.map((c) => (
        <motion.button
          key={c.user_id}
          type="button"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => {
            buzz();
            onOpen(c.user_id, c.display_name);
          }}
          className="w-full flex items-center gap-3 bg-white rounded-2xl p-3.5 text-slate-950 text-left shadow-lg shadow-black/20 active:bg-slate-50 transition-colors"
        >
          <Avatar name={c.display_name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-sm font-bold truncate">{c.display_name}</span>
              <span className="text-[11px] text-slate-400 shrink-0">{relativeTime(c.last_at)}</span>
            </div>
            <p className="text-xs text-slate-500 truncate mt-0.5">
              {c.last_message ?? 'Say hello…'}
            </p>
          </div>
          {c.unread > 0 && (
            <span className="shrink-0 min-w-6 h-6 px-1.5 rounded-full bg-amber-500 text-slate-950 text-[11px] font-black flex items-center justify-center">
              {c.unread}
            </span>
          )}
        </motion.button>
      ))}
    </div>
  );
}

function Thread({
  userId,
  displayName,
  onBack,
}: {
  userId: number;
  displayName: string;
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<DirectMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const meIdRef = useRef<number | null>(null);

  // Resolve my id once so bubbles know which side they render on.
  useEffect(() => {
    api
      .get<{ user: { id: number } }>('/auth/me')
      .then((r) => {
        meIdRef.current = r.user.id;
      })
      .catch(() => {});
  }, []);

  async function load() {
    try {
      const r = await api.get<{ messages: DirectMessage[] }>(`/circle/dm/${userId}`);
      setMessages(r.messages);
      setLoaded(true);
    } catch {
      setError(true);
      setLoaded(true);
    }
  }

  useEffect(() => {
    load();
    const timer = setInterval(load, 5000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    buzz();
    setSending(true);
    try {
      const r = await api.post<{ message: DirectMessage }>(`/circle/dm/${userId}`, { content });
      setMessages((ms) => [...ms, r.message]);
      setDraft('');
    } catch {
      // Keep the draft; thread stays unchanged as the failure signal.
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-4">
        <button
          type="button"
          onClick={() => {
            buzz();
            onBack();
          }}
          aria-label="Back to conversations"
          className="w-11 h-11 -ml-1 flex items-center justify-center rounded-full text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition-colors"
        >
          <ChevronLeft size={22} />
        </button>
        <Avatar name={displayName} />
        <div className="min-w-0">
          <h2 className="font-black text-lg tracking-tight truncate">{displayName}</h2>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 pb-2">
        {!loaded ? (
          <PanelState busy>Loading messages…</PanelState>
        ) : error ? (
          <PanelState>Could not load this thread. Try again.</PanelState>
        ) : messages.length === 0 ? (
          <PanelState>No messages yet. Send the first one.</PanelState>
        ) : (
          messages.map((m) => {
            const mine = meIdRef.current != null && m.from_user === meIdRef.current;
            return (
              <motion.div
                key={m.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex ${mine ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap break-words ${
                    mine
                      ? 'bg-amber-500 text-slate-950 rounded-br-md font-medium'
                      : 'bg-slate-800 text-slate-100 rounded-bl-md'
                  }`}
                >
                  {m.content}
                  <div className={`text-[10px] mt-1 ${mine ? 'text-slate-900/60' : 'text-slate-400'}`}>
                    {relativeTime(m.created_at)}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={send} className="flex gap-2 pt-2 pb-1 shrink-0">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${displayName.split(' ')[0]}…`}
          className="flex-1 min-h-11 bg-slate-900 border border-slate-800 focus:border-amber-500/60 rounded-xl px-4 text-sm text-slate-100 focus:outline-none placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send message"
          className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors shrink-0"
        >
          <Send size={17} />
        </button>
      </form>
    </div>
  );
}

export function MessagesPanel({ onDismiss, embedded }: { onDismiss?: () => void; initialUserId?: number; embedded?: boolean }) {
  const [active, setActive] = useState<{ userId: number; displayName: string } | null>(null);

  return (
    <PanelMount className={embedded ? 'h-full flex flex-col min-h-0' : 'h-full flex flex-col'}>
      {!embedded && (
      <div className="px-4 pt-4 pb-3 shrink-0">
        {!active && <PanelHeader icon={MessageCircle} label="Messages" onDismiss={onDismiss} />}
      </div>
      )}
      <div className="flex-1 overflow-y-auto no-scrollbar px-4 pb-8">
        {active ? (
          <Thread
            userId={active.userId}
            displayName={active.displayName}
            onBack={() => setActive(null)}
          />
        ) : (
          <ConversationList onOpen={(userId, displayName) => setActive({ userId, displayName })} />
        )}
      </div>
    </PanelMount>
  );
}
