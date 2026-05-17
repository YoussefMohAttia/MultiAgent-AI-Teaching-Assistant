import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { gradeEssay, gradeEssayUpload, logProgressEvent } from '../services/api';
import '../components/Shared.css';
import { useLanguage } from '../contexts/LanguageContext';
import { incrementStat } from '../lib/activity';

function bandColor(score) {
  if (score >= 7.5) return 'var(--success)';
  if (score >= 5.5) return 'var(--warning, #f59e0b)';
  return 'var(--danger)';
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
    <div>
      <div className="grid-2" style={{ marginBottom: 24 }}>
        <div className="card">
          <div className="card-header">
            <span className="icon">❓</span>
            <h3 style={{ fontSize: '0.95rem' }}>{t('essayPromptTitle')}</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <textarea
              className="form-textarea"
              rows={6}
              placeholder={t('essayPromptPlaceholder')}
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="icon">📝</span>
            <h3 style={{ fontSize: '0.95rem' }}>{t('essayStudentEssay')}</h3>
          </div>
          <div className="form-group" style={{ marginBottom: 16 }}>
            <label>{t('essayInputType')}</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className={`btn btn-sm ${inputMode === 'text' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setInputMode('text')}
              >
                ✏️ {t('essayInputText')}
              </button>
              <button
                type="button"
                className={`btn btn-sm ${inputMode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setInputMode('upload')}
              >
                📄 {t('essayInputUpload')}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            {inputMode === 'text' ? (
              <>
                <textarea
                  className="form-textarea"
                  rows={10}
                  placeholder={t('essayTextPlaceholder')}
                  value={essayText}
                  onChange={(e) => setEssayText(e.target.value)}
                />
                <div style={{ textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: 4 }}>
                  {essayText.length.toLocaleString()} chars
                </div>
              </>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border)',
                  borderRadius: 16,
                  padding: 24,
                  minHeight: 220,
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
                  {uploadFile ? uploadFile.name : t('essayUploadBrowse')}
                </p>
                <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                  {t('essayUploadHint')}
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    setUploadFile(e.target.files?.[0] || null);
                    setError('');
                  }}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginTop: 16 }}>
            <button className="btn btn-primary" onClick={handleGrade} disabled={isDisabled}>
              {loading ? <><span className="spinner" /> {t('essayGrading')}</> : t('essayPredict')}
            </button>
            {!loading && !essayReady && (
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {inputMode === 'upload' ? t('essayUploadHint') : t('essayEnterTextHint')}
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', marginBottom: 4 }}>{t('essayPredictedBand')}</p>
            <div style={{ fontSize: '3.5rem', fontWeight: 700, color: bandColor(result.predicted_band) }}>
              {result.predicted_band}<span style={{ fontSize: '1.5rem', opacity: 0.6 }}>/9</span>
            </div>
            <p style={{ marginTop: 10, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {t('essayObjective')}: <strong>{result.objective}</strong>
            </p>
          </div>
        </>
      )}
    </div>
  );
}
