import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAuth } from '../contexts/AuthContext';
import { 
  Home, Library, Bot, Timer, Gamepad2, 
  BookOpen, LogOut, Lock, GraduationCap 
} from 'lucide-react';

const NAV = [
  { to: '/dashboard', icon: Home, label: 'Home' }, 
  { to: '/courses', icon: Library, label: 'Courses' },
  { to: '/ai-agents', icon: Bot, label: 'AI Agents' },
  { section: 'Focus & Break' },
  { to: '/pomodoro', icon: Timer, label: 'Pomodoro' },
  { to: '/mini-games', icon: Gamepad2, label: 'Mini Games' },
  { section: 'Support' },
  { to: '/user-manual', icon: BookOpen, label: 'User Manual' },
];

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isBreak } = usePomodoro();
  const { user, logout } = useAuth();

  useEffect(() => {
    if (!isBreak && pathname === '/mini-games') {
      navigate('/pomodoro', { replace: true });
    }
  }, [isBreak, pathname, navigate]);

  function handleSignOut() {
    logout();
    navigate('/', { replace: true });
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  return (
    <div className="flex h-screen w-full bg-slate-950 overflow-hidden font-sans">
      
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300">
        
        {/* Brand Header - Fixed the broken image by using a sleek vector icon */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 mr-3 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Squee Learn</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 custom-scrollbar">
          {NAV.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {item.section}
                </div>
              );
            }

            const Icon = item.icon;

            if (item.to === '/mini-games' && !isBreak) {
              return (
                <div 
                  key={item.to} 
                  className="flex items-center justify-between mx-3 px-3 py-2.5 rounded-lg opacity-50 cursor-not-allowed text-slate-400 bg-transparent border-l-2 border-transparent"
                  title="Available during break"
                >
                  <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5" />
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <Lock className="w-3.5 h-3.5 text-slate-500" />
                </div>
              );
            }

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center gap-3 mx-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group border-l-2 ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500' // Added left accent border
                      : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}`} />
                    {item.label}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / User Profile & Sign Out */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold border border-slate-700">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200 truncate w-24">
                  {user?.name?.split(' ')[0] || 'Student'}
                </span>
                {/* Changed "Free Tier" to something contextual */}
                <span className="text-xs text-slate-500"></span>
              </div>
            </div>
            
            <button 
              onClick={handleSignOut}
              title="Sign out"
              className="p-2 text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main Content Area ────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-950">
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}