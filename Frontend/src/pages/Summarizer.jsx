import { useState } from 'react';
import { summarizeText } from '../services/api';
import '../components/Shared.css';

export default function Summarizer() {
  const [text, setText] = useState('');
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);

  const handleSummarize = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setSummary('');
    const t0 = Date.now();
    try {
      const res = await summarizeText(text);
      setSummary(res.data.summary);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || 'Summarization failed.');
    }
    setLoading(false);
  };

  return (
    <div className="grid-2">
      {/* ── Input ─────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="icon">📝</span>
          <h2>Input Text</h2>
        </div>
        <div className="form-group">
          <label>Paste lecture text, article, or notes</label>
          <textarea
            className="form-textarea"
            rows={14}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste your text here…"
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            {text.length.toLocaleString()} chars
          </span>
          <button
            className="btn btn-primary"
            onClick={handleSummarize}
            disabled={loading || !text.trim()}
          >
            {loading ? <><span className="spinner" /> Summarizing…</> : '✨ Summarize'}
          </button>
        </div>
      </div>

      {/* ── Output ────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="icon">📄</span>
          <h2>Summary</h2>
          {elapsed && (
            <span className="badge badge-success" style={{ marginLeft: 'auto' }}>
              {elapsed}s
            </span>
          )}
        </div>

        {error && <div className="alert alert-error">{error}</div>}

        {loading ? (
          <div className="loading-overlay">
            <span className="spinner" /> Generating summary…
          </div>
        ) : summary ? (
          <div
            style={{
              whiteSpace: 'pre-wrap',
              fontSize: '0.9rem',
              lineHeight: 1.7,
              maxHeight: 500,
              overflowY: 'auto',
            }}
          >
            {summary}
          </div>
        ) : (
          <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Your summary will appear here.
          </p>
        )}
      </div>
    </div>
  );
}
