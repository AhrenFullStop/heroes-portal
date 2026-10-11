import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowBigUp, ImagePlus, MessageCircle, Pencil, Send, Trash2, X } from 'lucide-react';
import { api } from '../api';
import type { CircleComment, CirclePost } from '../../../shared/types';
import { buzz, PanelHeader, PanelMount, PanelState } from './shared';
import { MessagesPanel } from './MessagesPanel';

// CirclePost in shared/types.ts carries the original columns; the feed endpoint
// adds votes/media fields which the UI reads.
type FeedPost = CirclePost & {
  votes: number;
  voted_by_me: boolean;
  image_url: string | null;
  edited_at: string | null;
};

type FeedFilter = 'recent' | 'popular' | 'mine';

const FILTERS: { id: FeedFilter; label: string }[] = [
  { id: 'recent', label: 'Recent' },
  { id: 'popular', label: 'Popular' },
  { id: 'mine', label: 'Mine' },
];

// objectURL cache: media bytes are served per-post from Postgres; keep one URL
// per post for the session so re-renders and filter switches don't re-fetch.
const mediaUrls = new Map<number, string>();

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

function Avatar({ name }: { name: string }) {
  return (
    <div className="w-9 h-9 rounded-full bg-amber-500 flex items-center justify-center text-slate-950 font-black text-sm shrink-0">
      {(name || '?').charAt(0).toUpperCase()}
    </div>
  );
}

/** Post photo via the auth-cookie media endpoint, cached per post id. */
function PostImage({ postId }: { postId: number }) {
  const cached = mediaUrls.get(postId);
  const [url, setUrl] = useState<string | null>(cached ?? null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (url || failed) return;
    let alive = true;
    api
      .getBlob(`/circle/media/${postId}`)
      .then((blob) => {
        if (!alive) return;
        const objectUrl = URL.createObjectURL(blob);
        mediaUrls.set(postId, objectUrl);
        setUrl(objectUrl);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
    };
  }, [postId, url, failed]);

  if (!url) return null;
  return (
    <img
      src={url}
      alt=""
      loading="lazy"
      className="mt-3 w-full max-h-80 object-cover rounded-xl bg-slate-100"
      onError={() => setFailed(true)}
    />
  );
}

function CommentRow({ comment }: { comment: CircleComment }) {
  return (
    <div className="flex items-start gap-2">
      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[10px] font-black text-slate-600 shrink-0">
        {(comment.author_name || '?').charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-bold text-slate-500">
          {comment.author_name}
          <span className="ml-1.5 font-medium text-slate-400">{relativeTime(comment.created_at)}</span>
        </div>
        <p className="text-sm text-slate-700 leading-snug break-words">{comment.content}</p>
      </div>
    </div>
  );
}

function PostCard({
  post,
  mine,
  onComment,
  onEdit,
  onDelete,
}: {
  post: FeedPost;
  mine: boolean;
  onComment: (postId: number, content: string) => Promise<void>;
  onEdit: (postId: number, content: string) => Promise<void>;
  onDelete: (postId: number) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);

  // Own-post edit / delete state
  const [editing, setEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(post.content);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const [votes, setVotes] = useState(post.votes);
  const [voted, setVoted] = useState(post.voted_by_me);

  const comments = post.comments ?? [];

  async function vote() {
    // Optimistic toggle; the server response is authoritative on settle.
    const nextVoted = !voted;
    setVoted(nextVoted);
    setVotes((v) => v + (nextVoted ? 1 : -1));
    buzz();
    try {
      const r = await api.post<{ voted: boolean; votes: number }>(`/circle/posts/${post.id}/vote`);
      setVoted(r.voted);
      setVotes(r.votes);
    } catch {
      setVoted(!nextVoted);
      setVotes((v) => v + (nextVoted ? -1 : 1));
    }
  }

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

  async function saveEdit() {
    const content = editDraft.trim();
    if (!content) return;
    await onEdit(post.id, content);
    setEditing(false);
  }

  async function remove() {
    if (!confirmingDelete) {
      setConfirmingDelete(true);
      return;
    }
    buzz(20);
    await onDelete(post.id);
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl p-4 text-slate-950 shadow-lg shadow-black/20"
    >
      <div className="flex items-start gap-3">
        <Avatar name={post.author_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-sm font-bold truncate">{post.author_name}</span>
            <span className="text-[11px] text-slate-400 shrink-0">
              {relativeTime(post.created_at)}
              {post.edited_at ? ' (edited)' : ''}
            </span>
          </div>

          {editing ? (
            <div className="mt-2 space-y-2">
              <textarea
                value={editDraft}
                onChange={(e) => setEditDraft(e.target.value)}
                rows={3}
                maxLength={1000}
                className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/60"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(false);
                    setEditDraft(post.content);
                  }}
                  className="min-h-9 px-3 rounded-lg bg-white text-slate-600 text-xs font-bold border border-slate-200 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveEdit}
                  className="min-h-9 px-4 rounded-lg bg-amber-500 text-slate-950 text-xs font-black hover:bg-amber-400"
                >
                  Save
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap break-words mt-0.5">
              {post.content}
            </p>
          )}

          {post.image_url && !editing && <PostImage postId={post.id} />}

          <div className="flex items-center gap-1 mt-2 -ml-2">
            <button
              type="button"
              onClick={vote}
              aria-label={voted ? 'Remove vote' : 'Upvote'}
              className={`flex items-center gap-0.5 min-h-11 px-2 rounded-xl font-black text-sm transition-colors ${
                voted ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ArrowBigUp size={20} fill={voted ? 'currentColor' : 'none'} />
              {votes > 0 ? votes : ''}
            </button>
            <button
              type="button"
              onClick={() => setOpen((o) => !o)}
              className="flex items-center gap-1.5 min-h-11 px-2 rounded-xl text-slate-400 hover:text-slate-600 text-xs font-bold transition-colors"
            >
              <MessageCircle size={16} />
              {comments.length > 0 ? comments.length : 'Comment'}
            </button>
            {mine && !editing && (
              <div className="ml-auto flex items-center">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(true);
                    setConfirmingDelete(false);
                  }}
                  aria-label="Edit post"
                  className="min-h-11 w-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-amber-500 transition-colors"
                >
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  onClick={remove}
                  onBlur={() => setConfirmingDelete(false)}
                  aria-label={confirmingDelete ? 'Tap again to delete' : 'Delete post'}
                  className={`min-h-11 w-11 flex items-center justify-center rounded-xl transition-colors ${
                    confirmingDelete ? 'text-red-500 bg-red-50' : 'text-slate-400 hover:text-red-400'
                  }`}
                >
                  <Trash2 size={16} />
                </button>
              </div>
            )}
          </div>

          {open && (
            <div className="mt-1 space-y-3 border-t border-slate-100 pt-3">
              {comments.length === 0 ? (
                <p className="text-xs text-slate-400">No comments yet.</p>
              ) : (
                comments.map((c) => <CommentRow key={c.id} comment={c} />)
              )}
              <form onSubmit={send} className="flex gap-2">
                <input
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Add a comment…"
                  className="flex-1 min-h-11 bg-slate-100 rounded-xl px-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  disabled={!draft.trim() || sending}
                  aria-label="Send comment"
                  className="w-11 h-11 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center disabled:opacity-40 hover:bg-amber-400 transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </motion.article>
  );
}

export default function CirclePanel({ onDismiss, meId }: { onDismiss?: () => void; meId?: number }) {
  const [view, setView] = useState<'feed' | 'messages'>('feed');
  const [dmUnread, setDmUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    async function pollUnread() {
      try {
        const res = await api.get<{ conversations: { unread: number }[] }>('/circle/dm/conversations');
        if (alive) setDmUnread(res.conversations.reduce((sum, c) => sum + (c.unread || 0), 0));
      } catch { /* silent */ }
    }
    pollUnread();
    const t = setInterval(pollUnread, 8000);
    return () => { alive = false; clearInterval(t); };
  }, [view]);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<FeedFilter>('recent');
  const [draft, setDraft] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async (f: FeedFilter) => {
    try {
      const r = await api.get<{ posts: FeedPost[] }>(`/circle/posts?filter=${f}`);
      setPosts(r.posts);
      setLoaded(true);
    } catch {
      setError(true);
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    setLoaded(false);
    setError(false);
    load(filter);
  }, [filter, load]);

  // Own fetches carry no user id; resolve it once for the "Mine"/edit affordances.
  const [me, setMe] = useState<number | null>(meId ?? null);
  useEffect(() => {
    if (me != null) return;
    api
      .get<{ user: { id: number } }>('/auth/me')
      .then((r) => setMe(r.user.id))
      .catch(() => {});
  }, [me]);

  // Local preview thumbnail lifecycle.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  async function publish(e: React.FormEvent) {
    e.preventDefault();
    const content = draft.trim();
    if ((!content && !file) || posting) return;
    buzz();
    setPosting(true);
    try {
      let created: FeedPost;
      if (file) {
        const fd = new FormData();
        fd.append('content', content);
        fd.append('image', file);
        const r = await api.postForm<{ post: FeedPost }>('/circle/posts', fd);
        created = r.post;
      } else {
        const r = await api.post<{ post: FeedPost }>('/circle/posts', { content });
        created = r.post;
      }
      // "Mine" filter refetches server-side; other filters prepend directly.
      if (filter !== 'mine') setPosts((ps) => [created, ...ps]);
      setDraft('');
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      composerRef.current?.blur();
    } catch {
      // Keep the draft; the feed stays unchanged as the failure signal.
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

  async function editPost(postId: number, content: string) {
    const r = await api.patch<{ post: { id: number; content: string; edited_at: string | null } }>(
      `/circle/posts/${postId}`,
      { content }
    );
    setPosts((ps) =>
      ps.map((p) => (p.id === postId ? { ...p, content: r.post.content, edited_at: r.post.edited_at } : p))
    );
  }

  async function deletePost(postId: number) {
    await api.del(`/circle/posts/${postId}`);
    setPosts((ps) => ps.filter((p) => p.id !== postId));
  }

  return (
    <PanelMount className="h-full flex flex-col">
      <div className="px-4 pt-4 pb-3 shrink-0">
        <PanelHeader icon={MessageCircle} label="Circle" onDismiss={onDismiss} />
        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mt-3">
          {(['feed', 'messages'] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => { setView(v); if (v === 'messages') buzz(8); }}
              className={`relative flex-1 min-h-[40px] rounded-xl px-3 py-2 text-xs font-black uppercase tracking-wider transition-colors ${
                view === v ? 'text-slate-950' : 'text-slate-400'
              }`}
            >
              {view === v && (
                <motion.span layoutId="circle-tab-pill" className="absolute inset-0 bg-amber-500 rounded-xl" transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }} />
              )}
              <span className="relative flex items-center justify-center gap-1.5">
                {v === 'feed' ? 'Feed' : 'Messages'}
                {v === 'messages' && dmUnread > 0 && (
                  <span className="min-w-5 h-5 px-1 rounded-full bg-slate-950 text-amber-400 text-[10px] font-black flex items-center justify-center">
                    {dmUnread}
                  </span>
                )}
              </span>
            </button>
          ))}
        </div>

        {view === 'feed' && (
          <form onSubmit={publish} className="bg-white rounded-2xl p-3 text-slate-950 shadow-lg shadow-black/20">
          <textarea
            ref={composerRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            rows={2}
            placeholder="Share something with the brothers…"
            className="w-full bg-slate-100 rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-amber-500/60 placeholder:text-slate-400"
          />
          {previewUrl && (
            <div className="relative mt-2 inline-block">
              <img src={previewUrl} alt="" className="h-20 w-20 object-cover rounded-xl" />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (fileRef.current) fileRef.current.value = '';
                }}
                aria-label="Remove photo"
                className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full bg-slate-950 text-white flex items-center justify-center"
              >
                <X size={13} />
              </button>
            </div>
          )}
          <div className="flex items-center justify-between mt-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              aria-label="Attach photo"
              className={`min-h-11 w-11 flex items-center justify-center rounded-xl transition-colors ${
                file ? 'text-amber-500' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <ImagePlus size={20} />
            </button>
            <button
              type="submit"
              disabled={(!draft.trim() && !file) || posting}
              className="min-h-11 px-5 rounded-xl bg-amber-500 text-slate-950 font-black text-sm disabled:opacity-40 hover:bg-amber-400 transition-colors"
            >
              {posting ? 'Posting…' : 'Post'}
            </button>
          </div>
        </form>
          )}

        {view === 'feed' && (
        <div className="flex gap-2 mt-3">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => {
                buzz();
                setFilter(f.id);
              }}
              className={`flex-1 min-h-11 rounded-xl text-xs font-black uppercase tracking-wider transition-colors ${
                filter === f.id
                  ? 'bg-amber-500 text-slate-950'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        )}
      </div>

      {view === 'messages' ? (
        <div className="flex-1 min-h-0">
          <MessagesPanel embedded />
        </div>
      ) : (
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
          posts.map((p) => (
            <PostCard
              key={p.id}
              post={p}
              mine={me != null && p.user_id === me}
              onComment={addComment}
              onEdit={editPost}
              onDelete={deletePost}
            />
          ))
        )}
      </div>
      )}
    </PanelMount>
  );
}
