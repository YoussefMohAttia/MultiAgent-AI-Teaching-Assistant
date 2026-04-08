import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { generateQuiz, getQuizzesByCourse, getCourses, getDocuments } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import '../components/Shared.css';
import './QuizGenerator.css';

export default function QuizGenerator() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'take' ? 'take' : 'generate');

  // Shared
  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');

  // Generate tab
  const [sourceMode, setSourceMode] = useState('text'); // 'text' | 'document'
  const [text, setText] = useState('');
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [nItems, setNItems] = useState(5);
  const [nOptions, setNOptions] = useState(4);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  const [generatedItems, setGeneratedItems] = useState([]);
  const [generatedQuizId, setGeneratedQuizId] = useState(null);

  // Take tab
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [takeItems, setTakeItems] = useState([]);

  useEffect(() => {
    getCourses()
      .then((r) => {
        const list = r.data.courses || [];
        setCourses(list);
        if (list.length) setCourseId(String(list[0].id));
      })
      .catch(() => {});
  }, []);

  // Fetch quizzes when switching to Take tab or changing course
  useEffect(() => {
    if (tab === 'take' && courseId) {
      setActiveQuiz(null);
      setTakeItems([]);
      setQuizzesLoading(true);
      getQuizzesByCourse(Number(courseId))
        .then((r) => setQuizzes(r.data || []))
        .catch(() => setQuizzes([]))
        .finally(() => setQuizzesLoading(false));
    }
  }, [tab, courseId]);

  const handleCourseChange = (e) => {
    setCourseId(e.target.value);
    setGeneratedItems([]);
    setGeneratedQuizId(null);
    setActiveQuiz(null);
    setTakeItems([]);
    setDocs([]);
    setSelectedDocId('');
  };

  // Load usable documents whenever course changes and source mode is 'document'
  useEffect(() => {
    if (sourceMode === 'document' && courseId) {
      setDocsLoading(true);
      setSelectedDocId('');
      getDocuments(Number(courseId))
        .then((r) => {
          // Show docs that have a local PDF, a Drive URL (backend downloads on-demand), or raw text
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

  const isGenerateDisabled = genLoading || !courseId || (
    sourceMode === 'text' ? !text.trim() : !selectedDocId
  );

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;
    setGenLoading(true);
    setGenError('');
    setGeneratedItems([]);
    setGeneratedQuizId(null);
    const source = sourceMode === 'document'
      ? { documentId: Number(selectedDocId) }
      : { text };
    try {
      const res = await generateQuiz(Number(courseId), user.id, source, nItems, nOptions);
      setGeneratedItems(res.data.items || []);
      setGeneratedQuizId(res.data.quiz_id);
    } catch (e) {
      setGenError(e.response?.data?.detail || 'Quiz generation failed.');
    }
    setGenLoading(false);
  };

  const handleSelectQuiz = (quiz) => {
    setActiveQuiz(quiz);
    const items = (quiz.questions || []).map((q) => {
      const opts = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
      return {
        stem: q.question,
        options: opts,
        answer_index: opts.indexOf(q.correct_answer),
      };
    });
    setTakeItems(items);
  };

  return (
    <div>
      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <button
          className={`btn ${tab === 'generate' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('generate')}
        >
          🧠 Generate Quiz
        </button>
        <button
          className={`btn ${tab === 'take' ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setTab('take')}
        >
          📋 Take a Quiz
        </button>
      </div>

      {/* Shared course selector */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>Course</label>
          <select className="form-select" value={courseId} onChange={handleCourseChange}>
            {courses.length === 0 && <option value="">Loading courses…</option>}
            {courses.map((c) => (
              <option key={c.id} value={c.id}>{c.title}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── GENERATE TAB ── */}
      {tab === 'generate' && (
        <>
          <div className="card" style={{ marginBottom: 24 }}>
            <div className="card-header">
              <span className="icon">❓</span>
              <h2>Generate Quiz</h2>
            </div>

            {/* Source mode toggle */}
            <div className="form-group">
              <label>Source</label>
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
                <label>Source text (lecture, article, notes)</label>
                <textarea
                  className="form-textarea"
                  rows={6}
                  value={text}
                  onChange={(e) => setText(e.target.value)}
                  placeholder="Paste text to generate quiz from…"
                />
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
                        {d.title}{d.doc_type ? ` (${d.doc_type})` : ''}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

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
                <button
                  className="btn btn-primary"
                  onClick={handleGenerate}
                  disabled={isGenerateDisabled}
                  style={{ width: '100%' }}
                >
                  {genLoading ? <><span className="spinner" /> Generating…</> : '🧠 Generate Quiz'}
                </button>
              </div>
            </div>
          </div>

          {genError && <div className="alert alert-error">{genError}</div>}

          {genLoading && (
            <div className="loading-overlay">
              <span className="spinner" /> Generating quiz questions…
            </div>
          )}

          {generatedQuizId && (
            <div className="alert alert-success" style={{ marginBottom: 16 }}>
              ✅ Quiz #{generatedQuizId} saved to the database. Find it any time under <strong>Take a Quiz</strong>.
            </div>
          )}

          {generatedItems.length > 0 && (
            <QuizTaker
              items={generatedItems}
              title="Practice Multiple Choice Questions"
              subtitle="Generated Quiz"
            />
          )}
        </>
      )}

      {/* ── TAKE A QUIZ TAB ── */}
      {tab === 'take' && (
        <>
          {activeQuiz ? (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => { setActiveQuiz(null); setTakeItems([]); }}
                >
                  ← Back
                </button>
                <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                  Quiz #{activeQuiz.id}
                  <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 8, fontSize: '0.85rem' }}>
                    {takeItems.length} questions
                  </span>
                </h3>
              </div>
              <QuizTaker items={takeItems} title={`Quiz #${activeQuiz.id}`} subtitle="Saved Quiz" />
            </>
          ) : (
            <>
              {quizzesLoading ? (
                <div className="loading-overlay"><span className="spinner" /> Loading quizzes…</div>
              ) : quizzes.length === 0 ? (
                <div className="card">
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem' }}>
                    No quizzes for this course yet. Switch to <strong>Generate Quiz</strong> to create one!
                  </p>
                </div>
              ) : (
                <>
                  <h3 style={{ marginBottom: 12, fontSize: '1rem' }}>
                    {quizzes.length} Quiz{quizzes.length !== 1 ? 'zes' : ''} available
                  </h3>
                  {quizzes.map((quiz) => (
                    <div
                      key={quiz.id}
                      className="card"
                      style={{ marginBottom: 12, cursor: 'pointer', borderLeft: '3px solid var(--primary)' }}
                      onClick={() => handleSelectQuiz(quiz)}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <p style={{ fontWeight: 600 }}>Quiz #{quiz.id}</p>
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.82rem', marginTop: 4 }}>
                            {quiz.questions?.length ?? 0} questions · Created{' '}
                            {new Date(quiz.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <button className="btn btn-primary btn-sm">Take Quiz →</button>
                      </div>
                    </div>
                  ))}
                </>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ── Reusable quiz-taking UI (used by both generate and take tabs) ─────────────
function QuizTaker({ items, title, subtitle }) {
  const [selected, setSelected] = useState({});
  const [locked, setLocked] = useState({});
  const [revealedAll, setRevealedAll] = useState(false);
  const [showScoreBar, setShowScoreBar] = useState(false);

  const attempted = Object.values(selected).filter((v) => v !== '__revealed__').length;
  const score = items.filter((q, i) => selected[i] !== '__revealed__' && selected[i] === q.answer_index).length;

  const onAnswer = (qIdx, oIdx) => {
    if (locked[qIdx] || revealedAll) return;
    setSelected((prev) => ({ ...prev, [qIdx]: oIdx }));
    setLocked((prev) => ({ ...prev, [qIdx]: true }));
  };

  const revealAllAnswers = () => {
    const nextLocked = {};
    const nextSelected = { ...selected };
    items.forEach((_, i) => {
      nextLocked[i] = true;
      if (nextSelected[i] === undefined) nextSelected[i] = '__revealed__';
    });
    setLocked(nextLocked);
    setSelected(nextSelected);
    setRevealedAll(true);
  };

  const resetAll = () => {
    setSelected({});
    setLocked({});
    setRevealedAll(false);
    setShowScoreBar(false);
  };

  return (
    <section className="quiz-format-root">
      <header className="quiz-format-header">
        <div className="quiz-format-course">{title || 'Practice Multiple Choice Questions'}</div>
        <div className="quiz-format-subtitle">{subtitle || 'Generated from your selected source'}</div>
        <div className="quiz-format-meta">
          <span>AI Teaching Assistant</span>
          <span>{items.length} Questions</span>
        </div>
      </header>

      <div className="quiz-format-controls">
        <label>Quiz Controls:</label>
        <button className="btn btn-primary" onClick={revealAllAnswers}>Reveal All Answers</button>
        <button className="btn btn-secondary" onClick={() => setShowScoreBar(true)}>Show Score</button>
        <button className="btn btn-outline" onClick={resetAll}>Reset</button>
      </div>

      {showScoreBar && (
        <div className="quiz-format-scorebar">
          Score: {score} / {attempted} answered ({items.length} total) - {Math.round((score / Math.max(items.length, 1)) * 100)}%
        </div>
      )}

      <main className="quiz-format-main">
        {items.map((q, qi) => {
          const chosen = selected[qi];
          const isRevealedOnly = chosen === '__revealed__';
          const isAnswered = chosen !== undefined;
          const isCorrectAnswered = !isRevealedOnly && chosen === q.answer_index;
          const isWrongAnswered = !isRevealedOnly && isAnswered && chosen !== q.answer_index;

          return (
            <div
              key={qi}
              className={`quiz-question-card ${
                isCorrectAnswered
                  ? 'answered-correct'
                  : isWrongAnswered || isRevealedOnly
                  ? 'answered-wrong'
                  : ''
              }`}
            >
              <div className="quiz-q-header">
                <div className="quiz-q-num">{qi + 1}</div>
                <div className="quiz-q-text">{q.stem}</div>
              </div>

              <ul className="quiz-options">
                {q.options.map((opt, oi) => {
                  const isCorrect = oi === q.answer_index;
                  const isSelected = chosen === oi;
                  const className = [
                    'quiz-option-btn',
                    isSelected && !isCorrect && (isWrongAnswered ? 'wrong' : ''),
                    (isCorrect && locked[qi]) || (isCorrect && revealedAll) ? 'correct' : '',
                  ]
                    .filter(Boolean)
                    .join(' ');

                  return (
                    <li key={oi}>
                      <button
                        type="button"
                        className={className}
                        onClick={() => onAnswer(qi, oi)}
                        disabled={!!locked[qi] || revealedAll}
                      >
                        <span className="quiz-opt-letter">{String.fromCharCode(65 + oi)}</span>
                        <span>{opt}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {(locked[qi] || revealedAll) && (
                <div className="quiz-explanation show">
                  <strong>Correct answer:</strong> {String.fromCharCode(65 + q.answer_index)}. {q.options[q.answer_index]}
                </div>
              )}
            </div>
          );
        })}
      </main>
    </section>
  );
}
