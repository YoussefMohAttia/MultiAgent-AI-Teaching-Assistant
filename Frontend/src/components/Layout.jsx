import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Layout.css';

const NAV = [
  { section: 'Main' },
  { to: '/dashboard', icon: '📊', label: 'Dashboard' },
  { to: '/courses', icon: '📚', label: 'Courses' },
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
};

export default function Layout() {
  const { pathname } = useLocation();
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
