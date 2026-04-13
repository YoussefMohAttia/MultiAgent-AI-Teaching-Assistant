import { useMemo } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import './Pomodoro.css';

function formatCountdown(totalSeconds) {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function TimeAdjuster({ label, value, onChange }) {
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
      <small>minutes</small>
    </div>
  );
}

export default function Pomodoro() {
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
    () => (isBreak ? 'Break Time' : 'Focus Session'),
    [isBreak],
  );

  return (
    <div className="pomodoro-root">
      <section className="card pomodoro-main-card">
        <div className="pomodoro-top-row">
          <div>
            <p className="pomodoro-kicker">Productivity Focus</p>
            <h2>{statusText}</h2>
          </div>
          <span className={`badge ${isBreak ? 'badge-success' : 'badge-warning'}`}>
            {mode.toUpperCase()}
          </span>
        </div>

        <div className="pomodoro-timer-wrap">
          <div className="pomodoro-ring" style={{ '--progress': `${progress}%` }}>
            <p className="pomodoro-countdown">{formatCountdown(secondsLeft)}</p>
          </div>
        </div>

        <div className="pomodoro-controls">
          {!isRunning ? (
            <button className="btn btn-primary" onClick={start}>▶ Start</button>
          ) : (
            <button className="btn btn-secondary" onClick={pause}>⏸ Pause</button>
          )}
          <button className="btn btn-secondary" onClick={reset}>↺ Reset</button>
          {isBreak && (
            <button className="btn btn-secondary" onClick={skipBreak}>⏭ Skip Break</button>
          )}
        </div>

        <div className="pomodoro-toggle-row">
          <label className="pomodoro-toggle">
            <input
              type="checkbox"
              checked={autoStartNext}
              onChange={(e) => setAutoStartNext(e.target.checked)}
            />
            <span>Auto-start next session</span>
          </label>
        </div>
      </section>

      <section className="pomodoro-settings-grid">
        <div className="card">
          <h3 className="pomodoro-section-title">Session Settings</h3>
          <div className="pomodoro-adjust-grid">
            <TimeAdjuster label="Work Session" value={workMinutes} onChange={updateWorkMinutes} />
            <TimeAdjuster label="Short Break" value={breakMinutes} onChange={updateBreakMinutes} />
          </div>
        </div>

        <div className="card">
          <h3 className="pomodoro-section-title">Progress Bonus</h3>
          <div className="pomodoro-metrics">
            <div>
              <p className="pomodoro-metric-value">{completedCycles}</p>
              <p className="pomodoro-metric-label">Completed Cycles</p>
            </div>
            <div>
              <p className="pomodoro-metric-value">+{streakBonus}</p>
              <p className="pomodoro-metric-label">Streak Bonus</p>
            </div>
          </div>
          <small className="pomodoro-note">
            Every full focus cycle adds +10 streak points.
          </small>
        </div>
      </section>
    </div>
  );
}
