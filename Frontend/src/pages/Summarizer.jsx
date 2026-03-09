import { useState, useEffect } from 'react';
import { summarizeText, getCourses, getDocuments } from '../services/api';
import '../components/Shared.css';

export default function Summarizer() {
  // Course + source
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [sourceMode, setSourceMode] = useState('text'); // 'text' | 'document'
  const [text, setText] = useState('');
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');

  // Result
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);

  useEffect(() => {
    getCourses()
      .then((r) => {
        const list = r.data.courses || [];
        setCourses(list);
        if (list.length) setCourseId(String(list[0].id));
      })
      .catch(() => {});
  }, []);

  // Load documents when switching to document mode or changing course
  useEffect(() => {
    if (sourceMode === 'document' && courseId) {
      setDocsLoading(true);
      setSelectedDocId('');
      getDocuments(Number(courseId))
        .then((r) => {
          const usable = (r.data.documents || []).filter(
            (d) => d.download_url || d.google_drive_url || d.raw_text
          );
          setDocs(usable);
          if (usable.length) setSelectedDocId(String(usable[0].id));
        })
        .catch(() => setDocs([]))
        .finally(() => setDocsLoading(false));
    }
  }, [sourceMode, courseId]);

  const isDisabled = loading || (sourceMode === 'text' ? !text.trim() : !selectedDocId);

  const handleSummarize = async () => {
    if (isDisabled) return;
    setLoading(true);
    setError('');
    setSummary('');
    setElapsed(null);
    const source = sourceMode === 'document'
      ? { documentId: Number(selectedDocId) }
      : { text };
    const t0 = Date.now();
    try {
      const res = await summarizeText(source);
      setSummary(res.data.summary);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || 'Summarization failed.');
    }
    setLoading(false);
  };

  return (
    <div>
      {/* ── Course selector ───────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Course</label>
          <select
            className="form-select"
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setSummary(''); setDocs([]); setSelectedDocId(''); }}
          >
            {courses.length === 0 && <option value="">Loading courses…</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid-2">
        {/* ── Input ─────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <span className="icon">📝</span>
            <h2>Source</h2>
          </div>

          {/* Source mode toggle */}
          <div className="form-group">
            <label>Input type</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${sourceMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSourceMode('text')}
              >
                ✏️ Enter Text
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sourceMode === 'document' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSourceMode('document')}
              >
                📄 Course Document
              </button>
            </div>
          </div>

          {sourceMode === 'text' && (
            <div className="form-group">
              <label>Paste lecture text, article, or notes</label>
              <textarea
                className="form-textarea"
                rows={10}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Paste your text here…"
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {text.length.toLocaleString()} chars
              </div>
            </div>
          )}

          {sourceMode === 'document' && (
            <div className="form-group">
              <label>Select document</label>
              {docsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span className="spinner" style={{ marginRight: 6 }} />Loading documents…
                </p>
              ) : docs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No usable documents found for this course.
                  Upload a PDF on the <strong>Courses</strong> page first,
                  or paste text manually.
                </p>
              ) : (
                <select
                  className="form-select"
                  value={selectedDocId}
                  onChange={(e) => setSelectedDocId(e.target.value)}
                >
                  {docs.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.download_url ? '📄' : d.google_drive_url ? '☁️' : '📝'}{' '}
                      {d.title}{d.doc_type ? ` (${d.doc_type})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={handleSummarize}
              disabled={isDisabled}
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
            <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.7, maxHeight: 500, overflowY: 'auto' }}>
              {summary}
            </div>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Your summary will appear here.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
