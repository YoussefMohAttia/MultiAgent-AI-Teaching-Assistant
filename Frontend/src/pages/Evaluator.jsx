import { useState, useEffect, useMemo, useRef } from 'react';
import { evaluateSummary, evaluateUploadedSummary, getCourses, getDocuments, logProgressEvent } from '../services/api';
import '../components/Shared.css';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementStat } from '../lib/activity';
import { ClipboardCheck, UploadCloud, ChevronDown, AlertCircle, Zap, ChevronRight } from 'lucide-react';
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
  if (score >= 8) return '#22c55e';
  if (score >= 5) return '#f59e0b';
  return '#ef4444';
}

function tierForScore(score) {
  if (score >= 8) return 'high';
  if (score >= 5) return 'mid';
  return 'low';
}

const TECH_DETAIL_RE = /(cos_|rouge|mean_sim|max_sim|covered=|domain terms matched|length ratio)/i;

/* ── Score Ring SVG ────────────────────────────────────────────────────── */
function ScoreRing({ score, max = 10, size = 140, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score / max));
  const offset = circumference - progress * circumference;
  const color = colorForScore(score);

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} style={{ transform: 'rotate(-90deg)' }}>
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2} cy={size / 2} r={radius}
          fill="none" stroke={color} strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s', filter: `drop-shadow(0 0 6px ${color}40)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          / {max}
        </span>
      </div>
    </div>
  );
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

  // Student summary
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
  const [expandedMetric, setExpandedMetric] = useState(null);

  useEffect(() => {
    getCourses()
      .then((r) => {
        const list = r.data.courses || [];
        setCourses(list);
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
            (d) => d.doc_type !== 'announcement' && (d.download_url || d.google_drive_url || d.raw_text)
          );
          setDocs(usable);
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
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 w-full">

      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-2">
          <ClipboardCheck className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          {t('aiEvaluatorTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('aiEvaluatorContent')}
        </p>
      </div>

      {/* ── Main Layout ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

        {/* Left Panel — Inputs */}
        <div className="w-full lg:w-2/5 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">

          {/* Lecture / Source Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              📄 {t('evaluatorLectureTitle')}
            </h2>

            {/* Source mode toggle */}
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setSourceMode('text')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'text' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                ✏️ {t('evaluatorInputText')}
              </button>
              <button
                type="button"
                onClick={() => setSourceMode('document')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'document' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                📄 {t('evaluatorInputDocument')}
              </button>
            </div>

            {sourceMode === 'text' && (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
                  rows={8}
                  placeholder={t('evaluatorLecturePlaceholder')}
                  value={lectureText}
                  onChange={(e) => setLectureText(e.target.value)}
                />
                <div className="text-right text-xs text-slate-500">
                  {lectureText.length.toLocaleString()} {t('evaluatorChars')}
                </div>
              </div>
            )}

            {sourceMode === 'document' && (
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-400">{t('evaluatorCourseLabel')}</label>
                  <CustomSelect
                    value={courseId}
                    onChange={(val) => { setCourseId(String(val)); setResult(null); setDocs([]); setSelectedDocId(''); }}
                    options={courses.map(c => ({ id: c.id, title: c.title }))}
                    placeholder={courses.length === 0 ? t('evaluatorLoadingCourses') : t('evaluatorChooseCourse')}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium text-slate-700 dark:text-slate-400">{t('evaluatorSelectDocument')}</label>
                  {docsLoading ? (
                    <p className="text-sm text-slate-500 flex items-center gap-2">
                      <span className="spinner" style={{ width: 14, height: 14 }} />{t('evaluatorLoadingDocuments')}
                    </p>
                  ) : docs.length === 0 ? (
                    <p className="text-sm text-slate-500">{t('evaluatorNoUsableDocs')}</p>
                  ) : (
                    <CustomSelect
                      value={selectedDocId}
                      onChange={(val) => setSelectedDocId(String(val))}
                      options={docs.map(d => ({ id: d.id, title: `${d.download_url ? '📄' : d.google_drive_url ? '☁️' : '📝'} ${d.title}${d.doc_type ? ` (${d.doc_type})` : ''}` }))}
                      placeholder={t('evaluatorChooseDocument')}
                      disabled={!courseId}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Student Summary Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              📝 {t('evaluatorStudentSummaryTitle')}
            </h2>

            {/* Summary input toggle */}
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setSummaryInputMode('text')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${summaryInputMode === 'text' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                ✏️ {t('evaluatorSummaryInputText')}
              </button>
              <button
                type="button"
                onClick={() => setSummaryInputMode('upload')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${summaryInputMode === 'upload' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                📄 {t('evaluatorSummaryInputUpload')}
              </button>
            </div>

            {summaryInputMode === 'text' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
                  rows={10}
                  placeholder={t('evaluatorStudentSummaryPlaceholder')}
                  value={studentSummary}
                  onChange={(e) => setStudentSummary(e.target.value)}
                />
                <div className="text-right text-xs text-slate-500">
                  {studentSummary.length.toLocaleString()} {t('evaluatorChars')}
                </div>
              </div>
            ) : (
              <div
                onClick={() => studentSummaryFileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group min-h-[200px]"
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/20 transition-colors">
                  <UploadCloud className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {studentSummaryFile ? studentSummaryFile.name : t('evaluatorSummaryUploadBrowse')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                    {t('evaluatorSummaryUploadHint')}
                  </p>
                </div>
                <input
                  ref={studentSummaryFileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setStudentSummaryFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                />
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="mt-4 bg-red-50 dark:bg-rose-500/10 border border-red-200 dark:border-rose-500/20 text-red-700 dark:text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                <p>{error}</p>
              </div>
            )}

            {/* CTA */}
            <div className="pt-5 border-t border-slate-200 dark:border-slate-800 mt-5">
              <button
                className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                onClick={handleEvaluate}
                disabled={isDisabled}
              >
                <Zap className={`w-4 h-4 ${loading ? 'animate-pulse text-yellow-300' : ''}`} />
                {loading ? t('evaluatorEvaluating') : `🔍 ${t('evaluatorEvaluate')}`}
              </button>
              {elapsed && (
                <div className="mt-3 text-center">
                  <span className="inline-block px-3 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-full">
                    ⏱ {elapsed}s
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Panel — Results */}
        <div className="w-full lg:w-3/5 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          
          {!result ? (
            /* Empty State */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <ClipboardCheck className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {t('aiEvaluatorContent')}
              </p>
              <p className="text-slate-400 dark:text-slate-600 text-xs mt-2 max-w-xs">
                {t('evaluatorLecturePlaceholder')}
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">

              {/* Score Hero */}
              <div className="flex flex-col items-center py-6 mb-6 bg-slate-50 dark:bg-slate-950/50 rounded-xl border border-slate-200 dark:border-slate-800">
                <p className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-3">
                  {t('evaluatorOverallScore')}
                </p>
                <ScoreRing score={result.overall_score} />
                {result.overall_feedback && (
                  <p className="mt-4 text-sm text-slate-600 dark:text-slate-400 text-center max-w-md leading-relaxed px-4">
                    {result.overall_feedback}
                  </p>
                )}
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('evaluatorStudentWords')}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {summaryInputMode === 'upload'
                      ? (studentSummaryFile ? t('evaluatorStudentWordsUpload') : '-')
                      : studentSummary.trim().split(/\s+/).filter(Boolean).length}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('evaluatorReferenceWords')}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">
                    {result.reference_summary ? result.reference_summary.trim().split(/\s+/).filter(Boolean).length : '-'}
                  </div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('evaluatorKeyPoints')}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{result.key_points?.length ?? '-'}</div>
                </div>
                <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-3 text-center">
                  <div className="text-xs text-slate-500 uppercase tracking-wider font-semibold mb-1">{t('evaluatorMetrics')}</div>
                  <div className="text-xl font-bold text-slate-900 dark:text-white">{Object.keys(result.metrics || {}).length}</div>
                </div>
              </div>

              {/* Technical Toggle */}
              <div className="flex justify-end mb-3">
                <button
                  type="button"
                  className="px-3 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                  onClick={() => setShowTechnical((v) => !v)}
                >
                  {showTechnical ? t('evaluatorHideTechnical') : t('evaluatorShowTechnical')}
                </button>
              </div>

              {/* Metric Cards */}
              <div className="flex flex-col gap-3">
                {Object.entries(metricInfo).map(([key, info]) => {
                  const metric = result.metrics?.[key];
                  if (!metric) return null;
                  const score = Number(metric.score || 0);
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
                  const tier = tierForScore(score);
                  const isExpanded = expandedMetric === key;

                  return (
                    <div
                      key={key}
                      className={`bg-slate-50 dark:bg-slate-950 border rounded-xl overflow-hidden transition-all cursor-pointer ${
                        tier === 'high' ? 'border-emerald-200 dark:border-emerald-900/50' :
                        tier === 'mid' ? 'border-amber-200 dark:border-amber-900/50' :
                        'border-red-200 dark:border-red-900/50'
                      }`}
                      onClick={() => setExpandedMetric(isExpanded ? null : key)}
                    >
                      <div className="flex items-center gap-3 p-4">
                        <span className="text-xl flex-shrink-0">{info.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-semibold text-slate-900 dark:text-white">{info.label}</span>
                            <span className={`text-sm font-bold ${
                              tier === 'high' ? 'text-emerald-500' :
                              tier === 'mid' ? 'text-amber-500' :
                              'text-red-500'
                            }`}>
                              {score.toFixed(1)}/10
                            </span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700 ease-out"
                              style={{
                                width: `${Math.max(0, Math.min(100, score * 10))}%`,
                                background: colorForScore(score),
                              }}
                            />
                          </div>
                        </div>
                        <ChevronRight className={`w-4 h-4 text-slate-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                      </div>

                      {isExpanded && (
                        <div className="px-4 pb-4 pt-0 border-t border-slate-200 dark:border-slate-800">
                          <p className="text-xs text-slate-500 mt-3 mb-1">{info.desc}</p>
                          {displayDetail && (
                            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                              {displayDetail}
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
