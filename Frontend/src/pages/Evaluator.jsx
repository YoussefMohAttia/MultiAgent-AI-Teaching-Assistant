import { useState, useEffect } from 'react';
import { evaluateSummary, getCourses, getDocuments } from '../services/api';
import '../components/Shared.css';

const METRIC_INFO = {
  correctness:        { label: 'Correctness',        icon: '✅' },
  relevance:          { label: 'Relevance',           icon: '🎯' },
  coherence:          { label: 'Coherence',           icon: '🔗' },
  completeness:       { label: 'Completeness',        icon: '📋' },
  conciseness:        { label: 'Conciseness',         icon: '✂️' },
  terminology:        { label: 'Terminology',         icon: '📖' },
  hallucination:      { label: 'Hallucination',       icon: '👻' },
  missing_key_points: { label: 'Missing Key Points',  icon: '🔑' },
  factual_accuracy:   { label: 'Factual Accuracy',    icon: '📐' },
  critical_analysis:  { label: 'Critical Analysis',   icon: '🧠' },
};

function colorForScore(score) {
  if (score >= 8) return 'var(--success)';
  if (score >= 5) return 'var(--warning, #f59e0b)';
  return 'var(--danger)';
}

export default function Evaluator() {
  // Course + lecture source
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');
  const [sourceMode, setSourceMode] = useState('text'); // 'text' | 'document'
  const [lectureText, setLectureText] = useState('');
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');

  // Student summary (always typed manually)
  const [studentSummary, setStudentSummary] = useState('');

  // Result
  const [result, setResult] = useState(null);
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

  const lectureReady = sourceMode === 'text' ? lectureText.trim() : selectedDocId;
  const isDisabled = loading || !lectureReady || !studentSummary.trim();

  const handleEvaluate = async () => {
    if (isDisabled) return;
    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(null);
    const source = sourceMode === 'document'
      ? { documentId: Number(selectedDocId) }
      : { text: lectureText };
    const t0 = Date.now();
    try {
      const res = await evaluateSummary(studentSummary, source);
      setResult(res.data);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || 'Evaluation failed.');
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
            onChange={(e) => { setCourseId(e.target.value); setResult(null); setDocs([]); setSelectedDocId(''); }}
          >
            {courses.length === 0 && <option value="">Loading courses…</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Input Section ──────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Lecture / Source */}
        <div className="card">
          <div className="card-header">
            <span className="icon">📄</span>
            <h3 style={{ fontSize: '0.95rem' }}>Lecture / Source Material</h3>
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
              <textarea
                className="form-textarea"
                rows={10}
                placeholder="Paste the original lecture notes or source material…"
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {lectureText.length.toLocaleString()} chars
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
        </div>

        {/* Student Summary */}
        <div className="card">
          <div className="card-header">
            <span className="icon">📝</span>
            <h3 style={{ fontSize: '0.95rem' }}>Student Summary</h3>
          </div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              rows={14}
              placeholder="Paste the student's summary to evaluate…"
              value={studentSummary}
              onChange={(e) => setStudentSummary(e.target.value)}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {studentSummary.length.toLocaleString()} chars
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <button
          className="btn btn-primary"
          onClick={handleEvaluate}
          disabled={isDisabled}
        >
          {loading ? <><span className="spinner" /> Evaluating…</> : '🔍 Evaluate Summary'}
        </button>
        {elapsed && (
          <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
            ⏱ {elapsed}s
          </span>
        )}
      </div>

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {/* ── Results Section ─────────────────────────── */}
      {result && (
        <>
          {/* Overall Score */}
          <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>Overall Score</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: colorForScore(result.overall_score) }}>
              {result.overall_score}<span style={{ fontSize: '1.5rem', opacity: 0.6 }}>/10</span>
            </div>
            {result.overall_feedback && (
              <p style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {result.overall_feedback}
              </p>
            )}
          </div>

          {/* Per-metric scores */}
          <div className="grid-2">
            {Object.entries(METRIC_INFO).map(([key, { label, icon }]) => {
              const metric = result.metrics?.[key];
              if (!metric) return null;
              return (
                <div className="card" key={key} style={{ padding: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      {icon} {label}
                    </span>
                    <span style={{ fontWeight: 700, fontSize: '1.1rem', color: colorForScore(metric.score) }}>
                      {metric.score}/10
                    </span>
                  </div>
                  {/* score bar */}
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-hover)', overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      style={{
                        width: `${metric.score * 10}%`,
                        height: '100%',
                        borderRadius: 3,
                        background: colorForScore(metric.score),
                        transition: 'width .6s ease',
                      }}
                    />
                  </div>
                  {metric.feedback && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                      {metric.feedback}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

