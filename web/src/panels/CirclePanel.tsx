import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChevronDown, MessageCircle, Send } from 'lucide-react';
import { api } from '../api';
import type { CirclePost, CircleComment } from '../../../shared/types';
import { buzz, PanelHeader, PanelMount, PanelState } from './shared';
function relativeTime(iso: string): string {
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

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm shrink-0">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

function CommentRow({ comment }: { comment: CircleComment }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-slate-600 font-black text-[10px] shrink-0 mt-0.5">
        {(comment.author_name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-xs">
          <span className="font-bold text-slate-900">{comment.author_name}</span>{' '}
          <span className="text-slate-500">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="text-sm text-slate-700 leading-snug">{comment.content}</p>
      </div>
    </div>
  );
}

function PostCard({
  post,
  onComment,
}: {
  post: CirclePost;
  onComment: (postId: number, content: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const comments = post.comments ?? [];

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      await onComment(post.id, content);
      setDraft('');
    } finally {
      setSending(false);
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20"
    >
      <div className="flex items-start gap-3">
        <Avatar name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="font-bold text-sm">{post.author_name}</span>
            <span className="text-[11px] text-slate-400">{relativeTime(post.created_at)}</span>
          </div>
          <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-wrap mt-0.5">
            {post.content}
          </p>
        </div>
      </div>

      <button
        type="button"
        onClick={() => {
          buzz();
          setOpen((o) => !o);
        }}
        className="mt-2 min-h-11 flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-amber-600 px-1 -ml-1 rounded-lg transition-colors"
      >
        <MessageCircle size={14} />
        {comments.length > 0 ? `${comments.length} comment${comments.length === 1 ? '' : 's'}` : 'Comment'}
        <ChevronDown
          size={14}
          className={`transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="pt-2 space-y-3 border-t border-slate-100">
              {comments.map((c) => (
                <CommentRow key={c.id} comment={c} />
              ))}
              <form onSubmit={send} className="flex items-center gap-2 pt-1">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 bg-slate-100 rounded-xl px-3 py-2.5 text-sm min-h-11 focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Post comment"
                  className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors shrink-0"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function CirclePanel({ onDismiss }: { onDismiss?: () => void }) {
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    let alive = true;
    api
      .get<{ posts: CirclePost[] }>('/circle/posts')
      .then((r) => {
        if (!alive) return;
        setPosts(r.posts);
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

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if (!content || posting) return;
    buzz();
    setPosting(true);
    try {
      const r = await api.post<{ post: CirclePost }>('/circle/posts', { content });
      setPosts((ps) => [r.post, ...ps]);
      setDraft('');
      composerRef.current?.blur();
    } catch {
      // keep draft; the ApiError path surfaces via the feed staying unchanged
    } finally {
      setPosting(false);
    }
  }

  async function addComment(postId: number, content: string) {
    const r = await api.post<{ comment: CircleComment }>(`/circle/posts/${postId}/comments`, {
      content,
    });
    setPosts((ps) =>
      ps.map((p) => (p.id === postId ? { ...p, comments: [...p.comments, r.comment] } : p))
    );
  }

  return (
    <PanelMount className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-3 shrink-0">
        <PanelHeader icon={MessageCircle} label="Circle" onDismiss={onDismiss} />

        <form onSubmit={publish} className="bg-white rounded-2xl p-3 text-slate-950 shadow-lg shadow-black/20">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Share something with the brothers…"
            className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
          />
          <div className="flex justify-end mt-2">
            <button
              type="submit"
              disabled={!draft.trim() || posting}
              className="min-h-11 px-5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
            >
              Post
            </button>
          </div>
        </form>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-8 space-y-3">
        {!loaded ? (
          <PanelState busy>Loading the Circle…</PanelState>
        ) : error ? (
          <PanelState>Could not load the feed. Try again.</PanelState>
        ) : posts.length === 0 ? (
          <PanelState>
            Nothing posted yet. Be the first to share a win, a question, or a word for the brothers.
          </PanelState>
        ) : (
          posts.map((p) => <PostCard key={p.id} post={p} onComment={addComment} />)
        )}
      </div>
    </PanelMount>
  );
}
