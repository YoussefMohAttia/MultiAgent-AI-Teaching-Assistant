import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import './Layout.css';

const NAV = [
  { section: 'Main' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/courses', icon: '📚', label: 'Courses' },
  { to: '/pomodoro', icon: '⏱️', label: 'Pomodoro' },
  { to: '/mini-games', icon: '🎮', label: 'Mini Games' },
  { to: '/user-manual', icon: '📘', label: 'User Manual' },
  { section: 'AI Tools' },
  { to: '/summarizer', icon: '📝', label: 'Summarizer' },
  { to: '/quiz', icon: '❓', label: 'Quiz Generator' },
  { to: '/chat', icon: '💬', label: 'AI Tutor Chat' },
  { to: '/evaluator', icon: '📊', label: 'Evaluator' },
  { to: '/essay-grader', icon: '🧾', label: 'Essay Grader' },
];

const pageTitle = {
  '/dashboard': 'Dashboard',
  '/courses': 'Courses',
  '/summarizer': 'AI Summarizer',
  '/quiz': 'Quiz Generator',
  '/chat': 'AI Tutor Chat',
  '/evaluator': 'Summary Evaluator',
  '/essay-grader': 'Essay Grader',
  '/user-manual': 'User Manual',
  '/pomodoro': 'Pomodoro Timer',
  '/mini-games': 'Mini Games',
};

export default function Layout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { isBreak } = usePomodoro();

  useEffect(() => {
    if (!isBreak && pathname === '/mini-games') {
      navigate('/pomodoro', { replace: true });
    }
  }, [isBreak, pathname, navigate]);

  const title = pageTitle[pathname] || 'AI Teaching Assistant';

  return (
    <div className="layout">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <img src="/Tung-Tung-Tung-Sahur-PNG-Photos.png" alt="Tung Tung Tung Sahur" className="sidebar-brand-image" />
          <span className="sidebar-brand-text">Squee Learn</span>
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="sidebar-section">{item.section}</div>
            ) : (
              item.to === '/mini-games' && !isBreak ? (
                <div key={item.to} className="sidebar-link sidebar-link-disabled" title="Available during break">
                  <span className="icon">🔒</span>
                  <span>
                    {item.label}
                    <small className="sidebar-help">Available during break</small>
                  </span>
                </div>
              ) : (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `sidebar-link${isActive ? ' active' : ''}`
                  }
                >
                  <span className="icon">{item.icon}</span>
                  {item.label}
                </NavLink>
              )
            ),
          )}
        </nav>
      </aside>

      {/* ── Main area ────────────────────────────────── */}
      <div className="main-content">
        <header className="topbar">
          <h1>{title}</h1>
          <div className="topbar-right">MultiAgent AI</div>
        </header>
        <main className="page-content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
