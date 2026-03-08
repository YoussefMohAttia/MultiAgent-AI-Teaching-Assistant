import { useState } from 'react';
import { generateQuiz } from '../services/api';
import '../components/Shared.css';

export default function QuizGenerator() {
  const [text, setText] = useState('');
  const [nItems, setNItems] = useState(5);
  const [nOptions, setNOptions] = useState(4);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showAnswers, setShowAnswers] = useState(false);
  const [selected, setSelected] = useState({});

  const handleGenerate = async () => {
    if (!text.trim()) return;
    setLoading(true);
    setError('');
    setItems([]);
    setShowAnswers(false);
    setSelected({});
    try {
      const res = await generateQuiz(text, nItems, nOptions);
      setItems(res.data.items || []);
    } catch (e) {
      setError(e.response?.data?.detail || 'Quiz generation failed.');
    }
    setLoading(false);
  };

  const handleSelect = (qIdx, oIdx) => {
    if (showAnswers) return;
    setSelected((prev) => ({ ...prev, [qIdx]: oIdx }));
  };

  const score =
    showAnswers && items.length
      ? items.filter((q, i) => selected[i] === q.answer_index).length
      : null;

  return (
    <div>
      {/* ── Input area ────────────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-header">
          <span className="icon">❓</span>
          <h2>Generate Quiz</h2>
        </div>

        <div className="form-group">
          <label>Source text (lecture, article, notes)</label>
          <textarea
            className="form-textarea"
            rows={6}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Paste text to generate quiz from…"
          />
        </div>

        <div className="form-row">
          <div className="form-group">
            <label>Number of questions</label>
            <select className="form-select" value={nItems} onChange={(e) => setNItems(+e.target.value)}>
              {[3, 5, 7, 10, 15, 20].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="form-group">
            <label>Options per question</label>
            <select className="form-select" value={nOptions} onChange={(e) => setNOptions(+e.target.value)}>
              {[2, 3, 4, 5, 6].map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn btn-primary" onClick={handleGenerate} disabled={loading || !text.trim()} style={{ width: '100%' }}>
              {loading ? <><span className="spinner" /> Generating…</> : '🧠 Generate Quiz'}
            </button>
          </div>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* ── Quiz questions ────────────────────────── */}
      {loading && (
        <div className="loading-overlay">
          <span className="spinner" /> Generating quiz questions…
        </div>
      )}

      {items.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: '1rem' }}>
              {items.length} Questions Generated
            </h3>
            <div style={{ display: 'flex', gap: 8 }}>
              {!showAnswers && Object.keys(selected).length > 0 && (
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowAnswers(true)}
                >
                  ✅ Check Answers
                </button>
              )}
              {showAnswers && (
                <span className="badge badge-success" style={{ fontSize: '0.9rem', padding: '6px 14px' }}>
                  Score: {score}/{items.length}
                </span>
              )}
            </div>
          </div>

          {items.map((q, qi) => (
            <div
              key={qi}
              className="card"
              style={{ marginBottom: 16, borderLeft: `3px solid ${showAnswers ? (selected[qi] === q.answer_index ? 'var(--success)' : selected[qi] !== undefined ? 'var(--danger)' : 'var(--border)') : 'var(--primary)'}` }}
            >
              <p style={{ fontWeight: 600, marginBottom: 12, fontSize: '0.95rem' }}>
                {qi + 1}. {q.stem}
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.answer_index;
                  const isSelected = selected[qi] === oi;
                  let bg = 'var(--bg-input)';
                  let border = '1px solid var(--border)';
                  if (showAnswers && isCorrect) {
                    bg = 'rgba(34,197,94,0.12)';
                    border = '1px solid var(--success)';
                  } else if (showAnswers && isSelected && !isCorrect) {
                    bg = 'rgba(239,68,68,0.12)';
                    border = '1px solid var(--danger)';
                  } else if (!showAnswers && isSelected) {
                    bg = 'rgba(108,99,255,0.12)';
                    border = '1px solid var(--primary)';
                  }

                  return (
                    <div
                      key={oi}
                      onClick={() => handleSelect(qi, oi)}
                      style={{
                        padding: '10px 14px',
                        borderRadius: 8,
                        background: bg,
                        border,
                        cursor: showAnswers ? 'default' : 'pointer',
                        fontSize: '0.88rem',
                        transition: 'all .2s',
                      }}
                    >
                      <strong style={{ marginRight: 8 }}>
                        {String.fromCharCode(65 + oi)}.
                      </strong>
                      {opt}
                      {showAnswers && isCorrect && ' ✓'}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
