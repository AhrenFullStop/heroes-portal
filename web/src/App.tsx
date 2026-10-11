import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Eye, MessageSquare, Users, Wrench, Settings, LogOut, X } from 'lucide-react';
import { api } from './api';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Admin from './pages/Admin';
import { PANEL_REGISTRY, type PanelId } from './panels';
import type { User } from '../../shared/types';

type Page = 'chat' | 'circle' | 'tools' | 'admin';

const NAV: { id: Page; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'circle', label: 'Circle', icon: Users },
  { id: 'tools', label: 'Tools', icon: Wrench },
];


export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<Page>('chat'); // reset below for admins
  const [panel, setPanel] = useState<PanelId | null>(null);

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then((res) => {
        setUser(res.user);
        if (res.user.role === 'admin') setPage('admin');
      })
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setPage('chat');
    setPanel(null);
  }

  async function enterMemberExperience() {
    try { navigator.vibrate?.(10); } catch { /* desktop */ }
    const res = await api.post<{ user: User }>('/auth/admin/view-as');
    setUser({ ...res.user, impersonating: true });
    setPage('chat');
    setPanel(null);
  }

  if (booting) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <img src="/brand/app-logo.png" alt="HEROES" className="w-14 h-14 object-contain animate-pulse" />
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const isAdmin = user.role === 'admin';
  // Admins manage the community: Dashboard + Circle. Full member nav only in experience mode.
  const navItems: { id: Page; label: string; icon: typeof MessageSquare }[] = isAdmin
    ? user.impersonating
      ? NAV // pure member experience: Chat/Circle/Tools - no admin surface
      : [{ id: 'admin' as Page, label: 'Eed', icon: Settings }, { id: 'circle', label: 'Circle', icon: Users }]
    : NAV;

  function openPanel(id: PanelId) {
    setPanel(id);
    setPage('chat');
  }

  function renderPage() {
    switch (page) {
      case 'chat':
        return <Chat userName={user!.display_name} panel={panel} onPanelDismiss={() => setPanel(null)} onOpenPanel={(id) => setPanel(id)} />;
      case 'circle': {
        const Circle = PANEL_REGISTRY.circle.component;
        return <Circle />;
      }
      case 'admin':
        return <Admin onExperienceMember={enterMemberExperience} />;
      case 'tools':
        return null; // Tools is a slide-up sheet overlay, not a page.
    }
  }

  async function exitViewAs() {
    const res = await api.post<{ ok: boolean; user: User }>('/auth/admin/view-as/exit');
    setPanel(null);
    setPage('admin');
    setUser(res.user);
  }


  return (
    <div className="h-dvh flex flex-col bg-slate-950">
      {user.impersonating && (
        <div className="shrink-0 z-[60] relative bg-amber-500 text-slate-950 flex items-center gap-2 px-4 py-2">
          <Eye size={16} className="shrink-0" />
          <span className="text-xs font-black uppercase tracking-wider truncate flex-1">
            Test mode - experiencing the app as a member
          </span>
          <button
            onClick={exitViewAs}
            className="shrink-0 min-h-9 px-3 rounded-lg bg-slate-950 text-amber-400 text-xs font-black uppercase tracking-wider hover:bg-slate-900 active:scale-95 transition"
          >
            Exit view
          </button>
        </div>
      )}
      <div className="flex-1 min-h-0 flex">
      <nav className="hidden md:flex flex-col w-56 border-r border-slate-800/60 bg-slate-950 pt-[26px] pb-5">
        <div className="flex items-center gap-3 px-5 mb-8">
          <img src="/brand/portrait.png" alt="" className="w-11 h-11 rounded-xl object-cover border border-slate-800" />
          <img src="/brand/wordmark.png" alt="HEROES" className="h-4 w-auto" />
        </div>
        <div className="flex-1 space-y-1 px-3">
          {navItems.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setPage(t.id)}
                className={`w-full flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-semibold transition-colors ${
                  page === t.id ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-900'
                }`}
              >
                <Icon size={17} />
                {t.label}
              </button>
            );
          })}
        </div>
        <div className="px-5 pt-3 border-t border-slate-800/60">
          <div className="text-sm font-bold truncate">{user.display_name}</div>
          <div className="text-xs text-slate-500 truncate">@{user.username}</div>
          <button
            onClick={logout}
            className="mt-3 flex items-center gap-2 text-xs text-slate-500 hover:text-red-400 transition-colors"
          >
            <LogOut size={13} /> Log out
          </button>
        </div>
      </nav>

      {/* Main column */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile header */}
        <header className="md:hidden flex items-center justify-between px-4 pt-[18px] pb-3 border-b border-slate-800/60 bg-slate-950/90 pt-safe">
          <div className="flex items-center gap-2.5">
            <img src="/brand/app-logo.png" alt="" className="h-9 w-9 object-contain" />
            <img src="/brand/wordmark.png" alt="HEROES" className="h-4 w-auto" />
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-400 p-1" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </header>

        <main className="flex-1 min-h-0 flex flex-col">
          <motion.div
            key={page}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="flex-1 min-h-0 flex flex-col"
          >
            {renderPage()}
          </motion.div>
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden flex border-t border-slate-800/60 bg-slate-950/95 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.id}
                onClick={() => setPage(t.id)}
                className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors ${
                  page === t.id ? 'text-amber-500' : 'text-slate-500'
                }`}
              >
                <Icon size={19} />
                <span className="text-[9px] font-bold uppercase tracking-wider">{t.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tools slide-up sheet */}
      <AnimatePresence>
        {page === 'tools' && (
          <motion.div
            key="tools-sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 32, stiffness: 320 }}
            className="fixed inset-0 z-50 flex flex-col bg-slate-950/95 backdrop-blur-md pt-safe"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800/60">
              <div>
                <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500 font-bold">Everything else</div>
                <h2 className="font-black text-lg">Tools</h2>
              </div>
              <button
                onClick={() => setPage('chat')}
                className="w-11 h-11 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-400 hover:text-slate-200 active:scale-95 transition"
                aria-label="Close tools"
              >
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto no-scrollbar p-4">
              <div className="grid grid-cols-2 gap-3 max-w-md mx-auto">
                {(Object.keys(PANEL_REGISTRY) as PanelId[])
                  .filter((id) => id !== 'circle' && id !== 'messages') // Circle is a primary tab; Messages lives inside Circle
                  .map((id) => {
                    const entry = PANEL_REGISTRY[id];
                    const Icon = entry.icon;
                    return (
                      <button
                        key={id}
                        onClick={() => openPanel(id)}
                        className="min-h-28 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-2.5 text-slate-200 hover:border-amber-500/50 active:scale-95 transition"
                      >
                        <Icon size={26} className="text-amber-500" />
                        <span className="text-sm font-bold">{entry.label}</span>
                      </button>
                    );
                  })}
                {isAdmin && (
                  <button
                    onClick={() => setPage('admin')}
                    className="min-h-28 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col items-center justify-center gap-2.5 text-slate-200 hover:border-amber-500/50 active:scale-95 transition"
                  >
                    <Settings size={26} className="text-amber-500" />
                    <span className="text-sm font-bold">Eed</span>
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
