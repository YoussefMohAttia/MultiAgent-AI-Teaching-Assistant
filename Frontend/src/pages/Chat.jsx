import { useState, useEffect, useRef } from 'react';
import { chatWithTutor, getCourses } from '../services/api';
import '../components/Shared.css';

export default function Chat() {
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [convId] = useState(() => `conv-${Date.now()}`);
  const endRef = useRef(null);

  useEffect(() => {
    getCourses()
      .then((r) => {
        const list = r.data.courses || [];
        setCourses(list);
        if (list.length) setCourseId(list[0].id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const send = async () => {
    const q = input.trim();
    if (!q || !courseId) return;
    setMessages((prev) => [...prev, { role: 'user', text: q }]);
    setInput('');
    setLoading(true);
    try {
      const res = await chatWithTutor(courseId, q, convId);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', text: res.data.answer, sources: res.data.sources },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'error', text: e.response?.data?.detail || 'Request failed.' },
      ]);
    }
    setLoading(false);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - var(--header-h) - 64px)' }}>
      {/* ── Header bar ────────────────────────────── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, alignItems: 'center' }}>
        <select
          className="form-select"
          style={{ width: 260 }}
          value={courseId}
          onChange={(e) => setCourseId(+e.target.value)}
        >
          <option value="">Select course…</option>
          {courses.map((c) => (
            <option key={c.id} value={c.id}>{c.title}</option>
          ))}
        </select>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
          Conversation: {convId.slice(0, 12)}…
        </span>
      </div>

      {/* ── Chat area ─────────────────────────────── */}
      <div
        className="card"
        style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}
      >
        {messages.length === 0 && (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: '3rem' }}>💬</span>
            <p>Ask the AI tutor a question about your course material.</p>
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '75%',
              background:
                m.role === 'user'
                  ? 'var(--primary)'
                  : m.role === 'error'
                    ? 'rgba(239,68,68,0.15)'
                    : 'var(--bg-card-hover)',
              color: m.role === 'user' ? '#fff' : m.role === 'error' ? '#f87171' : 'var(--text)',
              padding: '12px 16px',
              borderRadius: 14,
              fontSize: '0.9rem',
              whiteSpace: 'pre-wrap',
              lineHeight: 1.6,
            }}
          >
            {m.text}
            {m.sources?.length > 0 && (
              <div style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Sources: {m.sources.map((s, j) => (
                  <span key={j}>p.{s.page ?? '?'} </span>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: 8, alignItems: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <span className="spinner" /> Thinking…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* ── Input bar ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <input
          className="form-input"
          placeholder="Type your question…"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
          disabled={loading || !courseId}
        />
        <button className="btn btn-primary" onClick={send} disabled={loading || !input.trim() || !courseId}>
          Send
        </button>
      </div>
    </div>
  );
}
