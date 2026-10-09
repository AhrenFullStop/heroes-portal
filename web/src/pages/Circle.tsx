import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { MessageCircle, Send } from 'lucide-react';
import { api } from '../api';
import type { CirclePost } from '../../../shared/types';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function Circle() {
  const [posts, setPosts] = useState<CirclePost[]>([]);
  const [composer, setComposer] = useState('');
  const [commentDrafts, setCommentDrafts] = useState<Record<number, string>>({});
  const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
  const [busy, setBusy] = useState(false);

  async function load() {
    const res = await api.get<{ posts: CirclePost[] }>('/circle/posts');
    setPosts(res.posts);
  }
  useEffect(() => { load().catch(() => {}); }, []);

  async function submitPost(e: React.FormEvent) {
    e.preventDefault();
    if (!composer.trim() || busy) return;
    setBusy(true);
    try {
      await api.post('/circle/posts', { content: composer.trim() });
      setComposer('');
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function submitComment(postId: number) {
    const draft = (commentDrafts[postId] ?? '').trim();
    if (!draft) return;
    await api.post(`/circle/posts/${postId}/comments`, { content: draft });
    setCommentDrafts((d) => ({ ...d, [postId]: '' }));
    await load();
  }

  return (
    <div className="h-full overflow-y-auto px-4 pt-4 pb-8 space-y-4">
      <div>
        <h1 className="font-black text-xl">Circle</h1>
        <p className="text-slate-400 text-sm mt-0.5">Your brothers. Your wins. Keep each other going.</p>
      </div>

      <form onSubmit={submitPost}>
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
          <textarea
            value={composer}
            onChange={(e) => setComposer(e.target.value)}
            placeholder="Share a win, a struggle, or ask for help…"
            rows={3}
            className="w-full bg-transparent text-sm resize-none focus:outline-none placeholder:text-slate-600"
          />
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!composer.trim() || busy}
              className="bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-slate-950 font-bold text-xs uppercase tracking-wider rounded-xl px-4 py-2"
            >
              Post
            </button>
          </div>
        </div>
      </form>

      {posts.length === 0 && (
        <p className="text-slate-500 text-sm text-center py-8">Quiet in here. Be the first to share something.</p>
      )}

      {posts.map((p) => (
        <motion.article key={p.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-500 font-black text-sm">
              {p.author_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-sm">{p.author_name}</div>
              <div className="text-[11px] text-slate-500">{timeAgo(p.created_at)}</div>
            </div>
          </div>
          <p className="mt-3 text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">{p.content}</p>

          <button
            onClick={() => setOpenComments((o) => ({ ...o, [p.id]: !o[p.id] }))}
            className="mt-3 flex items-center gap-1.5 text-xs text-slate-400 hover:text-amber-500"
          >
            <MessageCircle size={14} />
            {p.comments.length > 0 ? `${p.comments.length} comment${p.comments.length > 1 ? 's' : ''}` : 'Comment'}
          </button>

          {openComments[p.id] && (
            <div className="mt-3 space-y-3 border-t border-slate-800 pt-3">
              {p.comments.map((c) => (
                <div key={c.id} className="flex gap-2.5">
                  <div className="w-7 h-7 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 font-bold text-xs shrink-0">
                    {c.author_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="bg-slate-800/60 rounded-xl px-3 py-2 flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-bold text-xs">{c.author_name}</span>
                      <span className="text-[10px] text-slate-500">{timeAgo(c.created_at)}</span>
                    </div>
                    <p className="text-sm text-slate-300 mt-0.5">{c.content}</p>
                  </div>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  submitComment(p.id);
                }}
                className="flex gap-2"
              >
                <input
                  value={commentDrafts[p.id] ?? ''}
                  onChange={(e) => setCommentDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                  placeholder="Add a comment…"
                  className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-amber-500 placeholder:text-slate-600"
                />
                <button type="submit" className="text-amber-500 hover:text-amber-400 px-2" aria-label="Send comment">
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </motion.article>
      ))}
    </div>
  );
}
