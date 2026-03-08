import { useState } from 'react';
import { evaluateSummary } from '../services/api';
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
  const [lectureText, setLectureText] = useState('');
  const [studentSummary, setStudentSummary] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);

  const handleEvaluate = async () => {
    if (!lectureText.trim() || !studentSummary.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(null);
    const t0 = Date.now();
    try {
      const res = await evaluateSummary(lectureText, studentSummary);
      setResult(res.data);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || 'Evaluation failed.');
    }
    setLoading(false);
  };

  return (
    <div>
      {/* ── Input Section ──────────────────────────── */}
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>📄 Lecture / Source Text</h3>
          <textarea
            className="form-textarea"
            rows={12}
            placeholder="Paste the original lecture notes or source material…"
            value={lectureText}
            onChange={(e) => setLectureText(e.target.value)}
          />
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {lectureText.length.toLocaleString()} chars
          </div>
        </div>

        <div className="card">
          <h3 style={{ fontSize: '0.95rem', marginBottom: 12 }}>📝 Student Summary</h3>
          <textarea
            className="form-textarea"
            rows={12}
            placeholder="Paste the student's summary to evaluate…"
            value={studentSummary}
            onChange={(e) => setStudentSummary(e.target.value)}
          />
          <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
            {studentSummary.length.toLocaleString()} chars
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
        <button
          className="btn btn-primary"
          onClick={handleEvaluate}
          disabled={loading || !lectureText.trim() || !studentSummary.trim()}
        >
          {loading ? 'Evaluating…' : '🔍 Evaluate Summary'}
        </button>
        {loading && <span className="spinner" />}
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
                  {/* bar */}
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
