import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

const NAV = [
  { section: 'Main' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/courses', icon: '📚', label: 'Courses' },
  { section: 'AI Tools' },
  { to: '/summarizer', icon: '📝', label: 'Summarizer' },
  { to: '/quiz', icon: '❓', label: 'Quiz Generator' },
  { to: '/chat', icon: '💬', label: 'AI Tutor Chat' },
  { to: '/evaluator', icon: '📊', label: 'Evaluator' },
];

const pageTitle = {
  '/': 'Dashboard',
  '/courses': 'Courses',
  '/summarizer': 'AI Summarizer',
  '/quiz': 'Quiz Generator',
  '/chat': 'AI Tutor Chat',
  '/evaluator': 'Summary Evaluator',
};

export default function Layout() {
  const { pathname } = useLocation();
  const title = pageTitle[pathname] || 'AI Teaching Assistant';

  return (
    <div className="layout">
      {/* ── Sidebar ──────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span>🎓</span> AI Teaching Asst
        </div>
        <nav className="sidebar-nav">
          {NAV.map((item, i) =>
            item.section ? (
              <div key={i} className="sidebar-section">{item.section}</div>
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
