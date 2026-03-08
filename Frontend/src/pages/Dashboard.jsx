import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getCourses } from '../services/api';
import '../components/Shared.css';

const TOOLS = [
  { icon: '📝', title: 'Summarizer', desc: 'AI-powered text summarization', to: '/summarizer', color: '#6c63ff' },
  { icon: '❓', title: 'Quiz Generator', desc: 'Auto-generate quiz questions', to: '/quiz', color: '#00d2ff' },
  { icon: '💬', title: 'AI Tutor Chat', desc: 'RAG-powered course tutor', to: '/chat', color: '#22c55e' },
  { icon: '📊', title: 'Evaluator', desc: '10-metric summary evaluation', to: '/evaluator', color: '#f59e0b' },
];

export default function Dashboard() {
  const [courses, setCourses] = useState([]);

  useEffect(() => {
    getCourses()
      .then((r) => setCourses(r.data.courses || []))
      .catch(() => {});
  }, []);

  return (
    <div>
      {/* ── Quick Stats ─────────────────────────────── */}
      <div className="grid-4" style={{ marginBottom: 32 }}>
        <StatCard icon="📚" value={courses.length} label="Courses" />
        <StatCard icon="📝" value="—" label="Summaries" />
        <StatCard icon="❓" value="—" label="Quizzes" />
        <StatCard icon="💬" value="—" label="Conversations" />
      </div>

      {/* ── AI Tools ────────────────────────────────── */}
      <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>AI Tools</h2>
      <div className="grid-4" style={{ marginBottom: 32 }}>
        {TOOLS.map((t) => (
          <Link key={t.to} to={t.to} style={{ textDecoration: 'none' }}>
            <div className="card" style={{ cursor: 'pointer', transition: 'transform .2s', borderTop: `3px solid ${t.color}` }}>
              <div style={{ fontSize: '2rem', marginBottom: 8 }}>{t.icon}</div>
              <h3 style={{ fontSize: '0.95rem', marginBottom: 4 }}>{t.title}</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{t.desc}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Recent Courses ──────────────────────────── */}
      <h2 style={{ marginBottom: 16, fontSize: '1.1rem' }}>Your Courses</h2>
      {courses.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>
          No courses yet.{' '}
          <Link to="/courses">Create one →</Link>
        </div>
      ) : (
        <div className="grid-3">
          {courses.slice(0, 6).map((c) => (
            <Link key={c.id} to="/courses" style={{ textDecoration: 'none' }}>
              <div className="card" style={{ cursor: 'pointer' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: 8 }}>📘</div>
                <h3 style={{ fontSize: '0.95rem' }}>{c.title}</h3>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  Course #{c.id}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, value, label }) {
  return (
    <div className="card" style={{ textAlign: 'center' }}>
      <div style={{ fontSize: '1.5rem', marginBottom: 6 }}>{icon}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 700 }}>{value}</div>
      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}
