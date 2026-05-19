import { useRef, useState } from 'react';
import { PenLine, UploadCloud, AlertCircle, Zap } from 'lucide-react';
import { gradeEssay, gradeEssayUpload, logProgressEvent } from '../services/api';
import '../components/Shared.css';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementStat } from '../lib/activity';

function bandColor(score) {
  if (score >= 7.5) return '#22c55e';
  if (score >= 5.5) return '#f59e0b';
  return '#ef4444';
}

/* ── Band Score Ring SVG ──────────────────────────────────────────────── */
function BandRing({ score, max = 9, size = 160, strokeWidth = 12 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.max(0, Math.min(1, score / max));
  const offset = circumference - progress * circumference;
  const color = bandColor(score);

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
          style={{ transition: 'stroke-dashoffset 0.8s ease, stroke 0.5s', filter: `drop-shadow(0 0 8px ${color}50)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontSize: '2.8rem', fontWeight: 800, color: 'white', lineHeight: 1 }}>
          {score}
        </span>
        <span style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
          / {max}
        </span>
      </div>
    </div>
  );
}

export default function EssayGrader() {
  const { t } = useLanguage();
  const [question, setQuestion] = useState('');
  const [inputMode, setInputMode] = useState('text');
  const [essayText, setEssayText] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(null);
  const fileInputRef = useRef(null);

  const essayReady = inputMode === 'upload' ? uploadFile : essayText.trim();
  const isDisabled = loading || !essayReady;

  const handleGrade = async () => {
    if (isDisabled) return;
    setLoading(true);
    setError('');
    setResult(null);
    setElapsed(null);

    const t0 = Date.now();
    try {
      const res = inputMode === 'upload'
        ? await gradeEssayUpload(uploadFile, question.trim() || null)
        : await gradeEssay(essayText, question.trim() || null);
      setResult(res.data);
      setElapsed(((Date.now() - t0) / 1000).toFixed(1));
      incrementStat('essays');
      logProgressEvent({ event_type: 'essay_graded' }).catch(() => {});
    } catch (e) {
      setError(e.response?.data?.detail || t('essayFailed'));
    }

    setLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 animate-in fade-in duration-500 w-full">

      {/* ── Header ──────────────────────────────────── */}
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-2">
          <PenLine className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          {t('aiEssayTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('aiEssayContent')}
        </p>
      </div>

      {/* ── Main Layout ─────────────────────────────── */}
      <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">

        {/* Left Panel — Inputs */}
        <div className="w-full lg:w-2/5 flex flex-col gap-6 overflow-y-auto custom-scrollbar pr-1">

          {/* Prompt Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              ❓ {t('essayPromptTitle')}
            </h2>
            <textarea
              className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
              rows={5}
              placeholder={t('essayPromptPlaceholder')}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Optional — provide the essay question for more accurate grading.
            </p>
          </div>

          {/* Essay Input Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
              📝 {t('essayStudentEssay')}
            </h2>

            {/* Input mode toggle */}
            <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 mb-5">
              <button
                type="button"
                onClick={() => setInputMode('text')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${inputMode === 'text' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                ✏️ {t('essayInputText')}
              </button>
              <button
                type="button"
                onClick={() => setInputMode('upload')}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${inputMode === 'upload' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
              >
                📄 {t('essayInputUpload')}
              </button>
            </div>

            {inputMode === 'text' ? (
              <div className="flex flex-col gap-2">
                <textarea
                  className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 custom-scrollbar"
                  rows={10}
                  placeholder={t('essayTextPlaceholder')}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                />
                <div className="text-right text-xs text-slate-500">
                  {essayText.length.toLocaleString()} chars
                </div>
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer group min-h-[200px]"
              >
                <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/20 transition-colors">
                  <UploadCloud className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-medium text-slate-900 dark:text-white">
                    {uploadFile ? uploadFile.name : t('essayUploadBrowse')}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">
                    {t('essayUploadHint')}
                  </p>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
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
                onClick={handleGrade}
                disabled={isDisabled}
              >
                <Zap className={`w-4 h-4 ${loading ? 'animate-pulse text-yellow-300' : ''}`} />
                {loading ? t('essayGrading') : t('essayPredict')}
              </button>

              {!loading && !essayReady && (
                <p className="text-xs text-slate-500 mt-3 text-center">
                  {inputMode === 'upload' ? t('essayUploadHint') : t('essayEnterTextHint')}
                </p>
              )}

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
              <PenLine className="w-14 h-14 text-slate-300 dark:text-slate-700 mb-4" />
              <p className="text-slate-500 dark:text-slate-400 text-sm font-medium">
                {t('aiEssayContent')}
              </p>
              <p className="text-slate-400 dark:text-slate-600 text-xs mt-2 max-w-xs">
                Submit an essay to see the predicted IELTS band score
              </p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto custom-scrollbar">
              {/* Results Header */}
              <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex-shrink-0">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                  ✅ {t('essayPredictedBand')}
                </h2>
              </div>

              {/* Score Display */}
              <div className="flex flex-col items-center py-10 px-6">
                <BandRing score={result.predicted_band} />

                {/* Band Level Label */}
                <div className="mt-6 flex flex-col items-center gap-3">
                  <span
                    className="inline-block px-4 py-1.5 rounded-full text-sm font-bold"
                    style={{
                      background: `${bandColor(result.predicted_band)}18`,
                      color: bandColor(result.predicted_band),
                      border: `1px solid ${bandColor(result.predicted_band)}30`,
                    }}
                  >
                    {result.predicted_band >= 7.5 ? '🏆 Excellent' :
                     result.predicted_band >= 6.5 ? '✨ Very Good' :
                     result.predicted_band >= 5.5 ? '👍 Competent' :
                     result.predicted_band >= 4.5 ? '📝 Modest' :
                     '📖 Developing'}
                  </span>
                </div>

                {/* Objective */}
                {result.objective && (
                  <div className="mt-8 w-full max-w-md bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl p-4">
                    <div className="text-xs uppercase tracking-widest text-slate-500 font-semibold mb-2">
                      {t('essayObjective')}
                    </div>
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium leading-relaxed">
                      {result.objective}
                    </p>
                  </div>
                )}

                {/* Band Scale Visual */}
                <div className="mt-8 w-full max-w-md">
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((band) => {
                      const isActive = Math.round(result.predicted_band) === band;
                      const isPast = band <= Math.round(result.predicted_band);
                      return (
                        <div
                          key={band}
                          className="flex-1 flex flex-col items-center gap-1"
                        >
                          <div
                            className="w-full h-2 rounded-full transition-all duration-500"
                            style={{
                              background: isPast ? bandColor(result.predicted_band) : 'rgba(255,255,255,0.06)',
                              opacity: isActive ? 1 : isPast ? 0.5 : 0.2,
                              boxShadow: isActive ? `0 0 8px ${bandColor(result.predicted_band)}50` : 'none',
                            }}
                          />
                          <span className={`text-[10px] font-bold transition-all ${isActive ? 'text-white scale-110' : 'text-slate-600'}`}>
                            {band}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
