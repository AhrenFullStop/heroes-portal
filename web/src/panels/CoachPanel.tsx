import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LifeBuoy, Send } from 'lucide-react';
import { api } from '../api';
import type { CoachMessage } from '../../../shared/types';
import { buzz, MicroLabel, PanelHeader, PanelMount, PanelState } from './shared';
function timeLabel(iso: string): string {
  const t = new Date(iso.endsWith('Z') || iso.includes('T') ? iso : `${iso}Z`);
  if (Number.isNaN(t.getTime())) return '';
  const now = Date.now();
  const s = (now - t.getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return t.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
}

export default function CoachPanel({ onDismiss }: { onDismiss?: () => void }) {
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ messages: CoachMessage[] }>('/coach/thread')
      .then((r) => {
        if (!alive) return;
        setMessages(r.messages);
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

  // Keep the newest message in view as the thread grows.
  useLayoutEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, loaded]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    buzz();
    setSending(true);
    try {
      const r = await api.post<{ message: CoachMessage }>('/coach/messages', { content });
      setMessages((ms) => [...ms, r.message]);
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  return (
    <PanelMount className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-2 shrink-0">
        <PanelHeader icon={LifeBuoy} label="Coach" onDismiss={onDismiss} />
        <p className="text-xs text-slate-400 -mt-1">
          A real HEROES coach, not the AI. Coaches usually reply within a day.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-3 space-y-2.5">
        {!loaded ? (
          <PanelState busy>Loading your thread…</PanelState>
        ) : error ? (
          <PanelState>Could not load your thread. Try again.</PanelState>
        ) : messages.length === 0 ? (
          <PanelState>
            <MicroLabel>Start the conversation</MicroLabel>
            <p className="mt-1 text-sm text-slate-500">
              Write to your coach below — anything blocking you, anything you need.
            </p>
          </PanelState>
        ) : (
          messages.map((m) => (
            <div
              key={m.id}
              className={`flex ${m.direction === 'to_coach' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  m.direction === 'to_coach'
                    ? 'bg-slate-800 text-slate-100 rounded-br-md'
                    : 'bg-amber-500/15 border border-amber-500/40 text-amber-100 rounded-bl-md'
                }`}
              >
                {m.content}
                <div className="text-[10px] opacity-50 mt-1">{timeLabel(m.created_at)}</div>
              </div>
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      <form
        onSubmit={send}
        className="shrink-0 flex items-center gap-2 px-4 pb-4 pt-1 border-t border-slate-800/60 bg-slate-950"
        style={{ paddingBottom: 'max(1rem, env(safe-area-inset-bottom))' }}
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write to your coach…"
          className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm min-h-11 focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
        />
        <button
          type="submit"
          disabled={!draft.trim() || sending}
          aria-label="Send to coach"
          className="w-11 h-11 rounded-2xl bg-amber-500 text-slate-950 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors shrink-0"
        >
          <Send size={17} />
        </button>
      </form>
    </PanelMount>
  );
}
