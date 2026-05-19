import { useState, useEffect, useMemo, useRef } from 'react';
import { evaluateSummary, evaluateUploadedSummary, getCourses, getDocuments, logProgressEvent } from '../services/api';
import '../components/Shared.css';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementStat } from '../lib/activity';
import { UploadCloud } from 'lucide-react';
import CustomSelect from '../components/CustomSelect';

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
  };
}

function colorForScore(score) {
  if (score >= 8) return 'var(--success)';
  if (score >= 5) return 'var(--warning, #f59e0b)';
  return 'var(--danger)';
}

const TECH_DETAIL_RE = /(cos_|rouge|mean_sim|max_sim|covered=|domain terms matched|length ratio)/i;

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
  const [summaryInputMode, setSummaryInputMode] = useState('text'); // 'text' | 'upload'
  const [studentSummaryFile, setStudentSummaryFile] = useState(null);
  const studentSummaryFileInputRef = useRef(null);

  // Result
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);
  const [showTechnical, setShowTechnical] = useState(false);

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
  const studentSummaryReady = summaryInputMode === 'upload' ? studentSummaryFile : studentSummary.trim();
  const isDisabled = loading || !lectureReady || !studentSummaryReady;

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
      const res = summaryInputMode === 'upload'
        ? await evaluateUploadedSummary(studentSummaryFile, source)
        : await evaluateSummary(studentSummary, source);
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
              <label>{t('evaluatorCourseLabel')}</label>
              <CustomSelect
                value={courseId}
                onChange={(val) => { setCourseId(String(val)); setResult(null); setDocs([]); setSelectedDocId(''); }}
                options={courses.map(c => ({ id: c.id, title: c.title }))}
                placeholder={t('evaluatorLoadingCourses')}
              />

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
                <CustomSelect
                  value={selectedDocId}
                  onChange={(val) => setSelectedDocId(String(val))}
                  options={docs.map(d => ({ id: d.id, title: `${d.download_url ? '📄' : d.google_drive_url ? '☁️' : '📝'} ${d.title}${d.doc_type ? ` (${d.doc_type})` : ''}` }))}
                  placeholder={t('evaluatorSelectDocument')}
                  disabled={!courseId}
                />
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
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>{t('evaluatorSummaryInputType')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${summaryInputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSummaryInputMode('text')}
              >
                ✏️ {t('evaluatorSummaryInputText')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${summaryInputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSummaryInputMode('upload')}
              >
                📄 {t('evaluatorSummaryInputUpload')}
              </button>
            </div>
          </div>
          <div className="form-group">
            {summaryInputMode === 'text' ? (
              <>
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
              </>
            ) : (
              <div
                onClick={() => studentSummaryFileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 16,
                  padding: 24,
                  minHeight: 300,
                  background: 'var(--bg-hover)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  cursor: 'pointer',
                }}
              >
                <div className="icon" style={{ width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <UploadCloud size={22} />
                </div>
                <p style={{ margin: 0, fontWeight: 600, textAlign: 'center' }}>
                  {studentSummaryFile ? studentSummaryFile.name : t('evaluatorSummaryUploadBrowse')}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t('evaluatorSummaryUploadHint')}
                </p>
                <input
                  ref={studentSummaryFileInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    setStudentSummaryFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                />
              </div>
            )}
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

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
            <button
              type="button"
              className="btn btn-sm btn-secondary"
              onClick={() => setShowTechnical((v) => !v)}
            >
              {showTechnical ? t('evaluatorHideTechnical') : t('evaluatorShowTechnical')}
            </button>
          </div>

          <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
            <div className="card" style={{ flex: 1, minWidth: 150, padding: 12 }}>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('evaluatorStudentWords')}</div>
              <div style={{ fontSize: '1.3rem', fontWeight: 700 }}>
                {summaryInputMode === 'upload'
                  ? (studentSummaryFile ? t('evaluatorStudentWordsUpload') : '-')
                  : studentSummary.trim().split(/\s+/).filter(Boolean).length}
              </div>
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
                  const detail = metric.feedback || '';
                  const isEvalError = /^Evaluation error/i.test(detail);
                  const isTechnical = TECH_DETAIL_RE.test(detail);
                  const strength = score >= 8
                    ? t('metricStrengthStrong')
                    : score >= 5
                      ? t('metricStrengthOkay')
                      : t('metricStrengthWeak');
                  const displayDetail = showTechnical || !isTechnical
                    ? (isEvalError ? t('metricEvalError') : detail)
                    : strength;
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
                        {displayDetail && <div>{displayDetail}</div>}
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

