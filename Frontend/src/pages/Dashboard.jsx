import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import './Dashboard.css';

function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeStreak(userId) {
  const key = `dashboard_streak_${userId}`;
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  let current = { streak: 1, lastDate: todayStr };

  try {
    const savedRaw = localStorage.getItem(key);
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      const prevStreak = Number(saved?.streak) || 0;
      const prevDate = saved?.lastDate;

      if (prevDate === todayStr) {
        current = { streak: Math.max(prevStreak, 1), lastDate: todayStr };
      } else if (prevDate === yesterdayStr) {
        current = { streak: Math.max(prevStreak + 1, 1), lastDate: todayStr };
      }
    }
  } catch {
    current = { streak: 1, lastDate: todayStr };
  }

  localStorage.setItem(key, JSON.stringify(current));
  return current.streak;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const navigate = useNavigate();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [streak, setStreak] = useState(1);

  const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setStreak(computeStreak(user.id));
    autoSync();
  }, [user]);

  async function autoSync() {
    const lastSync = parseInt(localStorage.getItem('last_sync_ts') || '0', 10);
    if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
      await fetchCourses();
      return;
    }
    await runSync();
  }

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

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : '?';

  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div className="dash-root">
      <main className="dash-main">
        <header className="dash-header">
          <div>
            <h1 className="dash-greeting">
              {greeting}, {user?.name?.split(' ')[0] || 'there'} 👋
            </h1>
            <p className="dash-date">
              {new Date().toLocaleDateString('en-US', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          <div className="header-right">
            <button
              className="theme-toggle"
              onClick={toggle}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            <div className="header-avatar">{initials}</div>
          </div>
        </header>

        <div className="stats-row">
          <StatCard icon="📚" label="Courses" value={coursesLoading ? '—' : courses.length} color="indigo" />
          <StatCard icon="🔥" label="Streak" value={streak} color="orange" />
        </div>

        <section className="section">
          <div className="section-header">
            <h2 className="section-title">Your Courses</h2>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button className="section-action" onClick={runSync} disabled={syncing}>
                {syncing ? '⏳ Syncing…' : '🔄 Sync Classroom'}
              </button>
              <button className="section-action" onClick={fetchCourses}>↻ Refresh</button>
            </div>
          </div>

          {coursesLoading ? (
            <div className="courses-loading">
              {[1, 2, 3].map((i) => <div key={i} className="course-skeleton" />)}
            </div>
          ) : courses.length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📭</span>
              <p>No courses yet. They will appear here once synced with Google Classroom.</p>
            </div>
          ) : (
            <div className="courses-grid">
              {courses.map((course) => (
                <CourseCard key={course.id} course={course} />
              ))}
            </div>
          )}
        </section>

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
  const colors = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444'];
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
