import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import ToastHost from './ToastHost';
import { 
  Home, Library, Bot, Timer, Gamepad2, 
  BookOpen, LogOut, Lock, GraduationCap, User
} from 'lucide-react';

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isBreak } = usePomodoro();
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  // Routes where the in-flow legal footer should appear
  const FOOTER_ROUTES = ['/dashboard', '/courses', '/ai-agents', '/pomodoro', '/mini-games', '/user-manual'];
  const showLegalFooter = FOOTER_ROUTES.includes(pathname);

  const navItems = [
    { to: '/dashboard', icon: Home, label: t('navHome') },
    { to: '/courses', icon: Library, label: t('navCourses') },
    { to: '/ai-agents', icon: Bot, label: t('navAiAgents') },
    { to: '/profile', icon: User, label: t('navProfile') },
    { section: t('navFocusBreak') },
    { to: '/pomodoro', icon: Timer, label: t('navPomodoro') },
    { to: '/mini-games', icon: Gamepad2, label: t('navMiniGames'), showLock: !isBreak },
    { section: t('navSupport') },
    { to: '/user-manual', icon: BookOpen, label: t('navUserManual') },
  ];

  // If break ends while on mini-games page, redirect to pomodoro
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
      <ToastHost />
      
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="w-64 flex-shrink-0 flex flex-col bg-slate-900 border-r border-slate-800 transition-all duration-300">
        
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-slate-800">
          <div className="w-8 h-8 mr-3 bg-indigo-500/20 rounded-lg flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-indigo-400" />
          </div>
          <span className="text-white font-bold text-lg tracking-wide">Squee Learn</span>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 overflow-y-auto py-6 flex flex-col gap-1 custom-scrollbar">
          {navItems.map((item, i) => {
            if (item.section) {
              return (
                <div key={i} className="mt-6 mb-2 px-6 text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  {item.section}
                </div>
              );
            }

            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/dashboard'}
                className={({ isActive }) =>
                  `flex items-center justify-between mx-3 px-3 py-2.5 rounded-lg transition-all duration-200 text-sm font-medium group border-l-2 ${
                    isActive 
                      ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <div className="flex items-center gap-3">
                      <Icon className={`w-5 h-5 ${isActive ? 'text-indigo-400' : 'text-slate-500 group-hover:text-slate-300 transition-colors'}`} />
                      {item.label}
                    </div>
                    {item.showLock && (
                      <Lock className="w-3.5 h-3.5 text-slate-500" />
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>

        {/* Footer / User Profile & Sign Out */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate('/profile')}
              className="flex items-center gap-3 text-left group"
            >
              <div className="w-9 h-9 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 text-xs font-bold border border-slate-700 group-hover:border-indigo-500/40 group-hover:text-indigo-300 transition-colors">
                {initials}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-slate-200 truncate w-24 group-hover:text-white transition-colors">
                  {user?.name?.split(' ')[0] || 'Student'}
                </span>
                <span className="text-xs text-slate-500">{t('navProfile')}</span>
              </div>
            </button>
            
            <button 
              onClick={handleSignOut}
              title={t('signOut')}
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

          {/* In-flow legal footer — scrolls with content, only on main pages */}
          {showLegalFooter && (
            <footer className="mt-12 pb-4">
              <div className="flex justify-center items-center gap-4 text-xs legal-footer-react">
                <a href="/privacy/index.html" className="transition-colors">
                  {t('footerPrivacy') || 'Privacy Policy'}
                </a>
                <span>•</span>
                <a href="/terms/index.html" className="transition-colors">
                  {t('footerTerms') || 'Terms of Service'}
                </a>
              </div>
            </footer>
          )}
        </main>
      </div>
    </div>
  );
}