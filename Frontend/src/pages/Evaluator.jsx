import { useState, useEffect, useMemo } from 'react';
import { evaluateSummary, getCourses, getDocuments, logProgressEvent } from '../services/api';
import '../components/Shared.css';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementStat } from '../lib/activity';

function buildMetricInfo(t) {
  return {
    correctness: {
      label: t('metricCorrectness'),
      icon: '✅',
      desc: t('metricCorrectnessDesc'),
    },
    relevance: {
      label: t('metricRelevance'),
      icon: '🎯',
      desc: t('metricRelevanceDesc'),
    },
    coherence: {
      label: t('metricCoherence'),
      icon: '🔗',
      desc: t('metricCoherenceDesc'),
    },
    completeness: {
      label: t('metricCompleteness'),
      icon: '📋',
      desc: t('metricCompletenessDesc'),
    },
    conciseness: {
      label: t('metricConciseness'),
      icon: '✂️',
      desc: t('metricConcisenessDesc'),
    },
    terminology: {
      label: t('metricTerminology'),
      icon: '📖',
      desc: t('metricTerminologyDesc'),
    },
    hallucination: {
      label: t('metricHallucination'),
      icon: '👻',
      desc: t('metricHallucinationDesc'),
    },
    missing_key_points: {
      label: t('metricMissingKeyPoints'),
      icon: '🔑',
      desc: t('metricMissingKeyPointsDesc'),
    },
    factual_accuracy: {
      label: t('metricFactualAccuracy'),
      icon: '📐',
      desc: t('metricFactualAccuracyDesc'),
    },
    critical_analysis: {
      label: t('metricCriticalAnalysis'),
      icon: '🧠',
      desc: t('metricCriticalAnalysisDesc'),
    },
  };
}

function colorForScore(score) {
  if (score >= 8) return 'var(--success)';
  if (score >= 5) return 'var(--warning, #f59e0b)';
  return 'var(--danger)';
}

export default function Evaluator() {
  const { t } = useLanguage();
  const metricInfo = useMemo(() => buildMetricInfo(t), [t]);
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
      incrementStat('evaluations');
      logProgressEvent({ event_type: 'evaluation_completed' }).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.detail || t('evaluatorFailed'));
    }
    setLoading(false);
  };

  return (
    <div>
      {/* ── Course selector ───────────────────────── */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label>{t('evaluatorCourseLabel')}</label>
          <select
            className="form-select"
            value={courseId}
            onChange={(e) => { setCourseId(e.target.value); setResult(null); setDocs([]); setSelectedDocId(''); }}
          >
            {courses.length === 0 && <option value="">{t('evaluatorLoadingCourses')}</option>}
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
            <h3 style={{ fontSize: '0.95rem' }}>{t('evaluatorLectureTitle')}</h3>
          </div>

          {/* Source mode toggle */}
          <div className="form-group">
            <label>{t('evaluatorInputType')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${sourceMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSourceMode('text')}
              >
                ✏️ {t('evaluatorInputText')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${sourceMode === 'document' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSourceMode('document')}
              >
                📄 {t('evaluatorInputDocument')}
              </button>
            </div>
          </div>

          {sourceMode === 'text' && (
            <div className="form-group">
              <textarea
                className="form-textarea"
                rows={10}
                placeholder={t('evaluatorLecturePlaceholder')}
                value={lectureText}
                onChange={(e) => setLectureText(e.target.value)}
              />
              <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                {lectureText.length.toLocaleString()} {t('evaluatorChars')}
              </div>
            </div>
          )}

          {sourceMode === 'document' && (
            <div className="form-group">
              <label>{t('evaluatorSelectDocument')}</label>
              {docsLoading ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  <span className="spinner" style={{ marginRight: 6 }} />{t('evaluatorLoadingDocuments')}
                </p>
              ) : docs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {t('evaluatorNoUsableDocs')}
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
            <h3 style={{ fontSize: '0.95rem' }}>{t('evaluatorStudentSummaryTitle')}</h3>
          </div>
          <div className="form-group">
            <textarea
              className="form-textarea"
              rows={14}
              placeholder={t('evaluatorStudentSummaryPlaceholder')}
              value={studentSummary}
              onChange={(e) => setStudentSummary(e.target.value)}
            />
            <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
              {studentSummary.length.toLocaleString()} {t('evaluatorChars')}
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
          {loading ? <><span className="spinner" /> {t('evaluatorEvaluating')}</> : `🔍 ${t('evaluatorEvaluate')}`}
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
          <div className="card" style={{ textAlign: 'center', marginBottom: 24 }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>{t('evaluatorOverallScore')}</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: colorForScore(result.overall_score) }}>
              {result.overall_score}<span style={{ fontSize: '1.5rem', opacity: 0.6 }}>/10</span>
            </div>
            {result.overall_feedback && (
              <p style={{ marginTop: 12, whiteSpace: 'pre-wrap', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--text-muted)' }}>
                {result.overall_feedback}
              </p>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 150, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('evaluatorStudentWords')}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{studentSummary.trim().split(/\s+/).filter(Boolean).length}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 150, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('evaluatorReferenceWords')}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {result.reference_summary ? result.reference_summary.trim().split(/\s+/).filter(Boolean).length : '-'}
              </div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 150, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('evaluatorKeyPoints')}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{result.key_points?.length ?? '-'}</div>
            </div>
            <div className="card" style={{ flex: 1, minWidth: 150, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('evaluatorMetrics')}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>{Object.keys(result.metrics || {}).length}</div>
            </div>
          </div>

          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-hover)' }}>
                  <th style={{ textAlign: 'left', padding: 12 }}>{t('evaluatorMetric')}</th>
                  <th style={{ textAlign: 'center', padding: 12, width: 120 }}>{t('evaluatorScore')}</th>
                  <th style={{ textAlign: 'left', padding: 12, width: '30%' }}>{t('evaluatorVisual')}</th>
                  <th style={{ textAlign: 'left', padding: 12 }}>{t('evaluatorDetails')}</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(metricInfo).map(([key, info]) => {
                  const metric = result.metrics?.[key];
                  if (!metric) return null;
                  const score = Number(metric.score || 0);
                  const icon = score >= 7 ? '🟢' : score >= 4 ? '🟡' : '🔴';
                  return (
                    <tr key={key} style={{ borderTop: '1px solid var(--border)' }}>
                      <td style={{ padding: 12, fontWeight: 600 }}>{icon} {info.label}</td>
                      <td style={{ padding: 12, textAlign: 'center', fontWeight: 700 }}>
                        {score.toFixed(1)}
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}> /10</span>
                      </td>
                      <td style={{ padding: 12 }}>
                        <div style={{ height: 10, borderRadius: 6, background: 'var(--bg-hover)', overflow: 'hidden' }}>
                          <div
                            style={{
                              width: `${Math.max(0, Math.min(100, score * 10))}%`,
                              height: '100%',
                              borderRadius: 6,
                              background: colorForScore(score),
                              transition: 'width .4s ease',
                            }}
                          />
                        </div>
                      </td>
                      <td style={{ padding: 12, fontSize: '0.85rem', lineHeight: 1.45 }}>
                        <div style={{ marginBottom: 4, color: 'var(--text-muted)' }}>{info.desc}</div>
                        {metric.feedback && <div>{metric.feedback}</div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

