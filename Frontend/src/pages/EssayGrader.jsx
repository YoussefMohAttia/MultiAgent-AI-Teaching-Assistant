import { useState } from 'react';
import { gradeEssay } from '../services/api';
import '../components/Shared.css';

function bandColor(score) {
  if (score >= 7.5) return 'var(--success)';
  if (score >= 5.5) return 'var(--warning, #f59e0b)';
  return 'var(--danger)';
}

export default function EssayGrader() {
  const [question, setQuestion] = useState('');
  const [essayText, setEssayText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);

  const isDisabled = loading || !essayText.trim();

  const handleGrade = async () => {
    if (isDisabled) return;
    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(null);

    const t0 = Date.now();
    try {
      const res = await gradeEssay(essayText, question.trim() || null);
      setResult(res.data);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
    } catch (e) {
      setError(e.response?.data?.detail || 'Essay grading failed.');
    }

    setLoading(false);
  };

  return (
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="icon">❓</span>
            <h3 style={{ fontSize: '0.95rem' }}>Essay Prompt (Optional)</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder="Paste the essay question/prompt if your model was trained with question context..."
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="icon">📝</span>
            <h3 style={{ fontSize: '0.95rem' }}>Student Essay</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              className="form-textarea"
              rows={10}
              placeholder="Paste the full essay text to predict IELTS band..."
              value={essayText}
              onChange={(e) => setEssayText(e.target.value)}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {essayText.length.toLocaleString()} chars
            </div>
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleGrade} disabled={isDisabled}>
              {loading ? <><span className="spinner" /> Grading...</> : 'Predict IELTS Band'}
            </button>
            {!loading && !essayText.trim() && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Enter text in Student Essay to enable grading.
              </span>
            )}
          </div>
        </div>
      </div>

      {elapsed && (
        <div style={{ marginBottom: 24 }}>
          <span className="badge" style={{ background: 'var(--primary)', color: '#fff' }}>
            ⏱ {elapsed}s
          </span>
        </div>
      )}

      {error && <div className="alert alert-danger" style={{ marginBottom: 16 }}>{error}</div>}

      {result && (
        <>
          <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>Predicted IELTS Band</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: bandColor(result.predicted_band) }}>
              {result.predicted_band}<span style={{ fontSize: '1.5rem', opacity: 0.6 }}>/9</span>
            </div>
            <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Objective: <strong>{result.objective}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
