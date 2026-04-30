import { useMemo } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useLanguage } from '../contexts/LanguageContext';
import './Pomodoro.css';

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function TimeAdjuster({ label, value, onChange, unit }) {
  return (
    <div className="pomodoro-adjust-card">
      <p>{label}</p>
      <div className="pomodoro-adjust-controls">
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(value - 1)}>-</button>
        <input
          type="number"
          min={1}
          max={120}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="pomodoro-number-input"
        />
        <button className="btn btn-secondary btn-sm" onClick={() => onChange(value + 1)}>+</button>
      </div>
      <small>{unit}</small>
    </div>
  );
}

export default function Pomodoro() {
  const { t } = useLanguage();
  const {
    mode,
    isBreak,
    secondsLeft,
    isRunning,
    autoStartNext,
    workMinutes,
    breakMinutes,
    completedCycles,
    streakBonus,
    progress,
    start,
    pause,
    reset,
    skipBreak,
    updateWorkMinutes,
    updateBreakMinutes,
    setAutoStartNext,
  } = usePomodoro();

  const statusText = useMemo(
    () => (isBreak ? t('pomodoroBreak') : t('pomodoroFocus')),
    [isBreak, t],
  );

  return (
    <div className="pomodoro-root">
      <section className="card pomodoro-main-card">
        <div className="pomodoro-top-row">
          <div>
            <p className="pomodoro-kicker">{t('pomodoroKicker')}</p>
            <h2>{statusText}</h2>
          </div>
          <span className={`badge ${isBreak ? 'badge-success' : 'badge-warning'}`}>
            {isBreak ? t('pomodoroModeBreak') : t('pomodoroModeWork')}
          </span>
        </div>

        <div className="pomodoro-timer-wrap">
          <div className="pomodoro-ring" style={{ '--progress': `${progress}%` }}>
            <p className="pomodoro-countdown">{formatCountdown(secondsLeft)}</p>
          </div>
        </div>

        <div className="pomodoro-controls">
          {!isRunning ? (
            <button className="btn btn-primary" onClick={start}>▶ {t('pomodoroStart')}</button>
          ) : (
            <button className="btn btn-secondary" onClick={pause}>⏸ {t('pomodoroPause')}</button>
          )}
          <button className="btn btn-secondary" onClick={reset}>↺ {t('pomodoroReset')}</button>
          {isBreak && (
            <button className="btn btn-secondary" onClick={skipBreak}>⏭ {t('pomodoroSkipBreak')}</button>
          )}
        </div>

        <div className="pomodoro-toggle-row">
          <label className="pomodoro-toggle">
            <input
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
            />
            <span>{t('pomodoroAutoStart')}</span>
          </label>
        </div>
      </section>

      <section className="pomodoro-settings-grid">
        <div className="card">
          <h3 className="pomodoro-section-title">{t('pomodoroSessionSettings')}</h3>
          <div className="pomodoro-adjust-grid">
            <TimeAdjuster label={t('pomodoroWorkSession')} value={workMinutes} onChange={updateWorkMinutes} unit={t('pomodoroMinutes')} />
            <TimeAdjuster label={t('pomodoroShortBreak')} value={breakMinutes} onChange={updateBreakMinutes} unit={t('pomodoroMinutes')} />
          </div>
        </div>

        <div className="card">
          <h3 className="pomodoro-section-title">{t('pomodoroProgressBonus')}</h3>
          <div className="pomodoro-metrics">
            <div>
              <p className="pomodoro-metric-value">{completedCycles}</p>
              <p className="pomodoro-metric-label">{t('pomodoroCompletedCycles')}</p>
            </div>
            <div>
              <p className="pomodoro-metric-value">+{streakBonus}</p>
              <p className="pomodoro-metric-label">{t('pomodoroStreakBonus')}</p>
            </div>
          </div>
          <small className="pomodoro-note">
            {t('pomodoroNote')}
          </small>
        </div>
      </section>
    </div>
  );
}
