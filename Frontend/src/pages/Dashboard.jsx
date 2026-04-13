import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Dashboard.css';

const NAV_ITEMS = [
  { icon: '🏠', label: 'Home',       id: 'home',       path: null },
  { icon: '📚', label: 'Courses',    id: 'courses',    path: '/courses' },
  { icon: '💬', label: 'AI Tutor',   id: 'chat',       path: '/chat' },
  { icon: '❓', label: 'Quizzes',    id: 'quizzes',    path: '/quiz' },
  { icon: '📝', label: 'Summarizer', id: 'summarizer', path: '/summarizer' },
  { icon: '📊', label: 'Evaluator',  id: 'evaluator',  path: '/evaluator' },
  { icon: '🧾', label: 'Essay Grader', id: 'essayGrader', path: '/essay-grader' },
  { icon: '📘', label: 'User Manual', id: 'userManual', path: '/user-manual' },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('home');
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!user) { navigate('/'); return; }
    autoSync();
  }, [user]);

  // Auto-sync: only runs if more than 5 minutes since last sync
  async function autoSync() {
    const lastSync = parseInt(localStorage.getItem('last_sync_ts') || '0');
    if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
      await fetchCourses();
      return;
    }
    await runSync();
  }

  // Full sync — always runs (used by manual button)
  async function runSync() {
    setSyncing(true);
    try {
      await axios.post(`/api/sync/full-sync?user_id=${user.id}`, null, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      localStorage.setItem('last_sync_ts', String(Date.now()));
    } catch (err) {
      console.warn('Sync failed:', err?.response?.data?.detail || err.message);
    } finally {
      setSyncing(false);
    }
    await fetchCourses();
  }

  async function fetchCourses() {
    setCoursesLoading(true);
    try {
      const res = await axios.get('/api/courses/', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCourses(res.data.courses || []);
    } catch {
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }

  function handleLogout() {
    logout();
    navigate('/');
  }

  const initials = user?.name
    ? user.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dash-root">
      {/* ── Sidebar ── */}
      <aside className="sidebar">
        {/* Brand */}
        <div className="sidebar-brand">
          <div className="sidebar-logo">
            <svg viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="20" fill="url(#sg1)" />
              <path d="M12 26 L20 14 L28 26" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M15.5 22 H24.5" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
              <defs>
                <linearGradient id="sg1" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#6366f1" />
                  <stop offset="1" stopColor="#8b5cf6" />
                </linearGradient>
              </defs>
            </svg>
          </div>
          <span className="sidebar-brand-name">EduAI</span>
        </div>

        {/* Nav */}
        <nav className="sidebar-nav">
          {NAV_ITEMS.map(item => (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(item.id); if (item.path) navigate(item.path); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </button>
          ))}
        </nav>

        {/* User footer */}
        <div className="sidebar-footer">
          <div className="user-pill">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <p className="user-name">{user?.name || 'User'}</p>
              <p className="user-email">{user?.email || ''}</p>
            </div>
          </div>
          <button className="logout-btn" onClick={handleLogout} title="Sign out">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      </aside>

      {/* ── Main Content ── */}
      <main className="dash-main">
        {/* Top bar */}
        <header className="dash-header">
          <div>
            <h1 className="dash-greeting">{greeting}, {user?.name?.split(' ')[0] || 'there'} 👋</h1>
            <p className="dash-date">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="header-right">
            <button className="theme-toggle" onClick={toggle} title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="header-avatar">{initials}</div>
          </div>
        </header>

        {/* Stats row */}
        <div className="stats-row">
          <StatCard icon="📚" label="Courses" value={coursesLoading ? '—' : courses.length} color="indigo" />
          <StatCard icon="🤖" label="AI Queries" value="—" color="purple" />
          <StatCard icon="✅" label="Completed" value="—" color="cyan" />
          <StatCard icon="🔥" label="Streak" value="—" color="orange" />
        </div>

        {/* Courses Section */}
        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Your Courses</h2>
            <div style={{display:'flex',gap:'8px'}}>
              <button className="section-action" onClick={runSync} disabled={syncing}>
                {syncing ? '⏳ Syncing…' : '🔄 Sync Classroom'}
              </button>
              <button className="section-action" onClick={fetchCourses}>↻ Refresh</button>
            </div>
          </div>

          {coursesLoading ? (
            <div className="courses-loading">
              {[1,2,3].map(i => <div key={i} className="course-skeleton" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No courses yet. They'll appear here once synced with Google Classroom.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {courses.map(course => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>

        {/* Quick Actions */}
        <section className="section">
          <h2 className="section-title">Quick Actions</h2>
          <div className="actions-grid">
            <ActionCard icon="🤖" title="Ask AI" desc="Get instant help from your AI teaching assistant" onClick={() => navigate('/chat')} />
            <ActionCard icon="📝" title="Summarize" desc="Summarize lecture notes and documents instantly" onClick={() => navigate('/summarizer')} />
            <ActionCard icon="🧩" title="Take a Quiz" desc="Test your knowledge with AI-generated quizzes" onClick={() => navigate('/quiz?tab=take')} />
            <ActionCard icon="🧾" title="Grade Essay" desc="Predict IELTS band score using your fine-tuned model" onClick={() => navigate('/essay-grader')} />
          </div>
        </section>
      </main>
    </div>
  );
}

function StatCard({ icon, label, value, color }) {
  return (
    <div className={`stat-card stat-${color}`}>
      <span className="stat-icon">{icon}</span>
      <div>
        <p className="stat-value">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  );
}

function CourseCard({ course }) {
  const navigate = useNavigate();
  const colors = ['#6366f1','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ef4444'];
  const color = colors[course.id % colors.length];
  return (
    <div className="course-card">
      <div className="course-color-bar" style={{ background: color }} />
      <div className="course-body">
        <h3 className="course-title">{course.title}</h3>
        <p className="course-id">ID: {course.id}</p>
        <button className="course-btn" onClick={() => navigate('/courses')}>Open →</button>
      </div>
    </div>
  );
}

function ActionCard({ icon, title, desc, onClick }) {
  return (
    <div className="action-card" onClick={onClick} style={onClick ? { cursor: 'pointer' } : {}}>
      <span className="action-icon">{icon}</span>
      <h3 className="action-title">{title}</h3>
      <p className="action-desc">{desc}</p>
    </div>
  );
}
