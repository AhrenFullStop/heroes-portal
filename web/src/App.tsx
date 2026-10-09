import { useEffect, useState } from 'react';
import { MessageSquare, Target, Users, Wallet, Dumbbell, Briefcase, LifeBuoy, Settings, LogOut } from 'lucide-react';
import { api } from './api';
import Login from './pages/Login';
import Chat from './pages/Chat';
import Path from './pages/Path';
import Circle from './pages/Circle';
import Money from './pages/Money';
import Move from './pages/Move';
import Work from './pages/Work';
import Coach from './pages/Coach';
import Admin from './pages/Admin';
import type { User } from '../../shared/types';

type Page = 'chat' | 'path' | 'circle' | 'money' | 'move' | 'work' | 'coach' | 'admin';

const TABS: { id: Page; label: string; icon: typeof MessageSquare }[] = [
  { id: 'chat', label: 'Chat', icon: MessageSquare },
  { id: 'path', label: 'Path', icon: Target },
  { id: 'circle', label: 'Circle', icon: Users },
  { id: 'money', label: 'Money', icon: Wallet },
  { id: 'move', label: 'Move', icon: Dumbbell },
  { id: 'work', label: 'Work', icon: Briefcase },
  { id: 'coach', label: 'Coach', icon: LifeBuoy },
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);
  const [page, setPage] = useState<Page>('chat');

  useEffect(() => {
    api.get<{ user: User }>('/auth/me')
      .then((res) => setUser(res.user))
      .catch(() => {})
      .finally(() => setBooting(false));
  }, []);

  async function logout() {
    await api.post('/auth/logout').catch(() => {});
    setUser(null);
    setPage('chat');
  }

  if (booting) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-slate-950">
        <div className="w-12 h-12 rounded-xl bg-amber-500 flex items-center justify-center animate-pulse">
          <span className="text-slate-950 font-black text-2xl">H</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Login onLogin={setUser} />;
  }

  const tabs = user.role === 'admin' ? [...TABS, { id: 'admin' as Page, label: 'Admin', icon: Settings }] : TABS;

  function renderPage() {
    switch (page) {
      case 'chat': return <Chat userName={user!.display_name} />;
      case 'path': return <Path />;
      case 'circle': return <Circle />;
      case 'money': return <Money />;
      case 'move': return <Move />;
      case 'work': return <Work />;
      case 'coach': return <Coach user={user!} />;
      case 'admin': return <Admin />;
    }
  }

  return (
    <div className="h-dvh flex bg-slate-950">
      {/* Desktop sidebar */}
      <nav className="hidden md:flex flex-col w-56 border-r border-slate-800/60 bg-slate-950 py-5">
        <div className="flex items-center gap-2.5 px-5 mb-8">
          <div className="w-9 h-9 rounded-lg bg-amber-500 flex items-center justify-center">
            <span className="text-slate-950 font-black text-lg">H</span>
          </div>
          <div>
            <div className="font-black tracking-widest text-sm">HEROES</div>
            <div className="text-[9px] uppercase tracking-[0.2em] text-slate-500">Alumni Portal</div>
          </div>
        </div>
        <div className="flex-1 space-y-1 px-3">
          {tabs.map((t) => {
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
        <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800/60 bg-slate-950/90">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md bg-amber-500 flex items-center justify-center">
              <span className="text-slate-950 font-black text-sm">H</span>
            </div>
            <span className="font-black tracking-widest text-sm">HEROES</span>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-red-400 p-1" aria-label="Log out">
            <LogOut size={16} />
          </button>
        </header>

        <main className={`flex-1 min-h-0 ${page === 'chat' || page === 'coach' ? 'flex flex-col' : ''}`}>
          {renderPage()}
        </main>

        {/* Mobile bottom tab bar */}
        <nav className="md:hidden flex border-t border-slate-800/60 bg-slate-950/95 pb-[env(safe-area-inset-bottom)]">
          {tabs.map((t) => {
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
    </div>
  );
}
