import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Timer, Gamepad2, Settings, Trophy, Target } from 'lucide-react';
import './Pomodoro.css';

/* ── helpers ──────────────────────────────────────────────────────────────── */
function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatFocusTime(totalMinutes, t) {
  if (totalMinutes < 60) return `${totalMinutes}${t('minutesShort')}`;
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return m > 0 ? `${h}${t('hoursShort')} ${m}${t('minutesShort')}` : `${h}${t('hoursShort')}`;
}

const QUOTE_KEYS = ['focusQuote1', 'focusQuote2', 'focusQuote3', 'focusQuote4', 'focusQuote5', 'focusQuote6'];

function useQuote(t) {
  const [idx] = useState(() => Math.floor(Math.random() * QUOTE_KEYS.length));
  return t(QUOTE_KEYS[idx]);
}

/* ── SVG Ring ─────────────────────────────────────────────────────────────── */
function TimerRing({ progress, size = 260, strokeWidth = 6 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg className="fh-ring-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle className="fh-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
      <circle
        className="fh-ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

function GoalRing({ progress, size = 100, strokeWidth = 8 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(progress, 100) / 100) * circumference;

  return (
    <svg className="fh-goal-ring-svg" viewBox={`0 0 ${size} ${size}`}>
      <circle className="fh-goal-ring-bg" cx={size / 2} cy={size / 2} r={radius} />
      <circle
        className="fh-goal-ring-progress"
        cx={size / 2}
        cy={size / 2}
        r={radius}
        strokeDasharray={circumference}
        strokeDashoffset={offset}
      />
    </svg>
  );
}

/* ── Time Adjuster ────────────────────────────────────────────────────────── */
function TimeAdjuster({ label, value, onChange, unit }) {
  return (
    <div className="fh-adjust-item">
      <span className="fh-adjust-item-label">{label}</span>
      <div className="fh-adjust-row">
        <button className="fh-adjust-btn" onClick={() => onChange(value - 1)} aria-label="Decrease">−</button>
        <input
          type="number"
          min={1}
          max={120}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="fh-adjust-value"
        />
        <button className="fh-adjust-btn" onClick={() => onChange(value + 1)} aria-label="Increase">+</button>
      </div>
      <span className="fh-adjust-unit">{unit}</span>
    </div>
  );
}

/* ── Session Timeline ─────────────────────────────────────────────────────── */
function SessionTimeline({ sessions, t }) {
  if (!sessions.length) {
    return <div className="fh-timeline"><span className="fh-timeline-empty">{t('noSessionsYet')}</span></div>;
  }

  return (
    <div className="fh-timeline">
      {sessions.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {i > 0 && <div className="fh-timeline-line" />}
          <div
            className={`fh-timeline-dot ${s.type === 'work' ? 'work' : 'break-dot'}`}
            title={`${s.type === 'work' ? 'Focus' : 'Break'} — ${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
          />
        </div>
      ))}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════════════ */
/*  FOCUS HUB — Main Component                                              */
/* ══════════════════════════════════════════════════════════════════════════ */

export default function Pomodoro() {
  const { t } = useLanguage();
  const {
    mode, isBreak, secondsLeft, isRunning, autoStartNext,
    workMinutes, breakMinutes, completedCycles, streakBonus, progress,
    todayFocusMinutes, focusGoalMinutes, sessionHistory,
    start, pause, reset, skipBreak,
    updateWorkMinutes, updateBreakMinutes, updateFocusGoal, setAutoStartNext,
  } = usePomodoro();

  const quote = useQuote(t);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      if (e.code === 'Space') {
        e.preventDefault();
        isRunning ? pause() : start();
      } else if (e.code === 'KeyR') {
        e.preventDefault();
        reset();
      }
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isRunning, start, pause, reset]);

  const statusText = useMemo(
    () => (isBreak ? t('pomodoroBreak') : t('pomodoroFocus')),
    [isBreak, t],
  );

  const goalProgress = focusGoalMinutes > 0
    ? Math.round((todayFocusMinutes / focusGoalMinutes) * 100)
    : 0;

  return (
    <div className={`focus-hub ${isBreak ? 'break-mode' : ''}`}>

      {/* ── Header ────────────────────────────────────────── */}
      <div className="fh-header">
        <div className="fh-title-group">
          <h1><Timer className="fh-header-icon" /> {t('focusHubTitle')}</h1>
          <p>{t('pomodoroKicker')}</p>
        </div>
      </div>

      {/* ── Break CTA — Navigate to Mini Games ────────────── */}
      {isBreak && (
        <Link to="/mini-games" className="fh-break-cta">
          <div className="fh-break-cta-glow" />
          <div className="fh-break-cta-content">
            <div className="fh-break-cta-icon">
              <Gamepad2 size={28} />
            </div>
            <div className="fh-break-cta-text">
              <span className="fh-break-cta-title">{t('miniGoToGames')}</span>
              <span className="fh-break-cta-sub">{t('miniBreakCta')}</span>
            </div>
          </div>
          <div className="fh-break-cta-arrow">→</div>
        </Link>
      )}

      {/* Timer Card */}
      <section className={`fh-timer-card ${isRunning ? 'is-running' : ''}`}>
        {/* Status Row */}
        <div className="fh-status-row">
          <div>
            <p className="fh-mode-kicker">{t('pomodoroKicker')}</p>
            <h2 className="fh-mode-title">{statusText}</h2>
          </div>
          <span className={`fh-mode-badge ${isRunning ? 'is-running' : ''}`}>
            <span className="fh-mode-badge-dot" />
            {isBreak ? t('pomodoroModeBreak') : t('pomodoroModeWork')}
          </span>
        </div>

        {/* Timer Ring */}
        <div className="fh-timer-wrap">
          <div className="fh-ring-container">
            <TimerRing progress={progress} />
            <div className="fh-ring-center">
              <p className="fh-countdown">{formatCountdown(secondsLeft)}</p>
              <p className="fh-quote">{quote}</p>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="fh-controls">
          {!isRunning ? (
            <button className="fh-btn fh-btn-primary" onClick={start}>▶ {t('pomodoroStart')}</button>
          ) : (
            <button className="fh-btn fh-btn-secondary" onClick={pause}>⏸ {t('pomodoroPause')}</button>
          )}
          <button className="fh-btn fh-btn-secondary" onClick={reset}>↺ {t('pomodoroReset')}</button>
          {isBreak && (
            <button className="fh-btn fh-btn-secondary" onClick={skipBreak}>⏭ {t('pomodoroSkipBreak')}</button>
          )}
        </div>

        {/* Keyboard Hints */}
        <div className="fh-keyboard-hints">
          <span className="fh-kbd-hint"><kbd className="fh-kbd">Space</kbd> {t('keyboardHintSpace')}</span>
          <span className="fh-kbd-hint"><kbd className="fh-kbd">R</kbd> {t('keyboardHintR')}</span>
        </div>

        {/* Auto-start Toggle */}
        <div className="fh-toggle-row">
          <label className="fh-toggle-label">
            <input
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
            />
            <span className="fh-toggle-track" />
            <span>{t('pomodoroAutoStart')}</span>
          </label>
        </div>

        {/* Session Timeline */}
        <SessionTimeline sessions={sessionHistory} t={t} />
      </section>

      {/* Bottom Grid: Settings + Stats + Daily Goal */}
      <div className="fh-bottom-grid">
        {/* Settings Card */}
        <div className="fh-settings-card">
          <h3 className="fh-card-title">
            <Settings className="fh-card-title-icon" />
            {t('pomodoroSessionSettings')}
          </h3>
          <div className="fh-adjust-group">
            <TimeAdjuster label={t('pomodoroWorkSession')} value={workMinutes} onChange={updateWorkMinutes} unit={t('pomodoroMinutes')} />
            <TimeAdjuster label={t('pomodoroShortBreak')} value={breakMinutes} onChange={updateBreakMinutes} unit={t('pomodoroMinutes')} />
          </div>
        </div>

        {/* Stats Card */}
        <div className="fh-stats-card">
          <h3 className="fh-card-title">
            <Trophy className="fh-card-title-icon" />
            {t('pomodoroProgressBonus')}
          </h3>
          <div className="fh-metrics">
            <div className="fh-metric">
              <div className="fh-metric-icon cycles">🔄</div>
              <div className="fh-metric-info">
                <p className="fh-metric-value">{completedCycles}</p>
                <p className="fh-metric-label">{t('pomodoroCompletedCycles')}</p>
              </div>
            </div>
            <div className="fh-metric">
              <div className="fh-metric-icon streak">🔥</div>
              <div className="fh-metric-info">
                <p className="fh-metric-value">+{streakBonus}</p>
                <p className="fh-metric-label">{t('pomodoroStreakBonus')}</p>
              </div>
            </div>
          </div>
          <p className="fh-note">{t('pomodoroNote')}</p>
        </div>

        {/* Daily Goal Card */}
        <div className="fh-goal-card">
          <h3 className="fh-card-title">
            <Target className="fh-card-title-icon" />
            {t('dailyGoal')}
          </h3>
          <div className="fh-goal-ring-wrap">
            <div className="fh-goal-ring-container">
              <GoalRing progress={goalProgress} />
              <div className="fh-goal-ring-center">
                <span className="fh-goal-ring-value">{goalProgress}%</span>
                <span className="fh-goal-ring-label">{t('todayFocus')}</span>
              </div>
            </div>
          </div>
          <div className="fh-goal-bar">
            <span>{formatFocusTime(todayFocusMinutes, t)}</span>
            <span>/ {formatFocusTime(focusGoalMinutes, t)}</span>
          </div>
          <div className="fh-goal-adjust">
            <label>{t('focusGoalLabel')}:</label>
            <input
              type="number"
              min={10}
              max={480}
              value={focusGoalMinutes}
              onChange={(e) => updateFocusGoal(Number(e.target.value))}
              className="fh-goal-input"
            />
            <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{t('pomodoroMinutes')}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
