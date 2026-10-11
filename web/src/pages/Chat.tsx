import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Send, CheckCircle2, Mic, Flame } from 'lucide-react';
import { api } from '../api';
import { PANEL_REGISTRY, type PanelId } from '../panels';
import type { ChatMessage, StreakInfo } from '../../../shared/types';

interface Turn extends ChatMessage {
  pending?: boolean;
}

const QUICK_ACTIONS = ['How did today go?', 'Money check-in', 'Set a goal with me'];

const MILESTONES = [3, 7, 14, 21, 30];

function fmtElapsed(total: number) {
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

interface ChatProps {
  userName: string;
  panel: PanelId | null;
  onPanelDismiss: () => void;
}

export default function Chat({ userName, panel, onPanelDismiss }: ChatProps) {
  const [messages, setMessages] = useState<Turn[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [actionLabels, setActionLabels] = useState<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sendingRef = useRef(false);

  // Streak strip + milestone toast
  const [streak, setStreak] = useState<StreakInfo | null>(null);
  const milestonesShown = useRef<Set<number>>(new Set());
  const [toast, setToast] = useState<string | null>(null);

  // Voice input
  const [micReady, setMicReady] = useState(
    () =>
      typeof window !== 'undefined' &&
      typeof MediaRecorder !== 'undefined' &&
      !!navigator.mediaDevices?.getUserMedia
  );
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string | undefined>(undefined);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  function refreshStreak() {
    api.get<StreakInfo>('/path/streak').then((s) => {
      setStreak(s);
      const n = s.streak;
      if (MILESTONES.includes(n) && !milestonesShown.current.has(n)) {
        milestonesShown.current.add(n);
        setToast(`${n} days strong, brother`);
        try {
          navigator.vibrate([30, 40, 30]);
        } catch {
          /* vibration unsupported */
        }
        window.setTimeout(() => setToast(null), 3000);
      }
    }).catch(() => {});
  }

  useEffect(() => {
    api.get<{ messages: ChatMessage[] }>('/chat').then((res) => {
      setMessages(res.messages.map((m) => ({ ...m, pending: false })));
    }).catch(() => {});
    refreshStreak();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  function stopRecording() {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setRecording(false);
    recorderRef.current?.stop();
  }

  async function toggleRecording() {
    if (recording) {
      stopRecording();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mime =
        typeof MediaRecorder.isTypeSupported === 'function' &&
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : undefined;
      mimeRef.current = mime;
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunksRef.current = [];
      rec.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(chunksRef.current, { type: mimeRef.current ?? rec.mimeType ?? 'audio/webm' });
        void transcribeBlob(blob);
      };
      rec.start();
      recorderRef.current = rec;
      setElapsed(0);
      setRecording(true);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      // Permission denied or device unavailable - hide the mic entirely.
      setMicReady(false);
    }
  }

  async function transcribeBlob(blob: Blob) {
    if (blob.size === 0) return;
    setTranscribing(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = () => reject(reader.error);
        reader.readAsDataURL(blob);
      });
      const audio = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const res = await api.postVoice(audio, blob.type);
      // Never auto-send: drop the transcript in the input for confirmation/edit.
      setInput(res.transcript ?? '');
    } catch {
      // Transcription failed - leave the input alone, user can type instead.
    } finally {
      setTranscribing(false);
    }
  }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy || sendingRef.current || recording) return;
    // Same-tick double-tap guard: busy state alone misses two taps in one tick.
    sendingRef.current = true;
    setBusy(true);
    setInput('');
    setActionLabels([]);
    try {
      navigator.vibrate(10);
    } catch {
      /* vibration unsupported */
    }
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
      refreshStreak();
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
      sendingRef.current = false;
      setBusy(false);
    }
  }

  const PanelComponent = panel !== null ? PANEL_REGISTRY[panel]?.component : undefined;

  return (
    <div className="flex flex-col h-full">
      {/* Dismissible feature panel, mounted above the conversation */}
      {PanelComponent && (
        <div className="px-3 pt-3">
          <PanelComponent onDismiss={onPanelDismiss} />
        </div>
      )}

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
        {/* Streak strip */}
        {streak && (
          <div className="flex items-center gap-2 pb-2">
            <div
              className={`flex items-center gap-1.5 text-xs font-bold ${
                streak.streak > 0 ? 'text-amber-500' : 'text-slate-500'
              }`}
            >
              <Flame size={14} />
              <span>{streak.streak}-day streak</span>
            </div>
            {streak.today_done && (
              <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider font-bold text-emerald-400 bg-emerald-950/30 border border-emerald-900/40 rounded-full px-2 py-0.5">
                <CheckCircle2 size={11} />
                today done
              </div>
            )}
          </div>
        )}

        {/* Milestone toast */}
        <AnimatePresence>
          {toast && (
            <motion.div
              key="streak-toast"
              initial={{ opacity: 0, y: -16, x: '-50%' }}
              animate={{ opacity: 1, y: 0, x: '-50%' }}
              exit={{ opacity: 0, y: -16, x: '-50%' }}
              className="fixed top-4 left-1/2 z-50 flex items-center gap-2 bg-amber-500 text-slate-950 text-sm font-black rounded-full px-4 py-2.5 shadow-xl shadow-amber-500/20"
            >
              <Flame size={15} />
              {toast}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
          {QUICK_ACTIONS.map((qa) => (
            <button
              key={qa}
              onClick={() => send(qa)}
              disabled={busy || recording}
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
          <div className="flex gap-2 items-center">
            {micReady && (
              <button
                type="button"
                onClick={toggleRecording}
                disabled={busy}
                aria-label={recording ? 'Stop recording' : 'Record a voice message'}
                className={`w-11 h-11 shrink-0 rounded-full flex items-center justify-center border transition-colors active:scale-95 ${
                  recording
                    ? 'bg-red-500/15 text-red-400 border-red-500/60 ring-2 ring-red-500/40 animate-pulse'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <Mic size={18} />
              </button>
            )}
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={recording ? 'Listening...' : transcribing ? 'Transcribing…' : 'Type your message…'}
              className="flex-1 min-w-0 bg-slate-900 border border-slate-800 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
            />
            <button
              type="submit"
              disabled={busy || recording || !input.trim()}
              className="bg-amber-500 disabled:opacity-40 hover:bg-amber-400 text-slate-950 rounded-2xl px-4 transition-colors h-11 flex items-center"
              aria-label="Send"
            >
              <Send size={18} />
            </button>
          </div>
          {recording && (
            <div className="flex items-center gap-2 pt-2 text-red-400">
              <div className="flex items-center gap-1 h-4">
                <span className="wavebar" />
                <span className="wavebar" />
                <span className="wavebar" />
                <span className="wavebar" />
              </div>
              <span className="text-xs font-mono tabular-nums">{fmtElapsed(elapsed)}</span>
              <span className="text-[10px] uppercase tracking-[0.2em] font-bold">Recording</span>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
