import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';

const PomodoroContext = createContext(null);

const WORK_DEFAULT_MINUTES = 30;
const BREAK_DEFAULT_MINUTES = 5;
const STORAGE_KEY = 'pomodoro_state_v1';

function clampMinutes(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(120, Math.max(1, Math.round(parsed)));
}

function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    const workMinutes = clampMinutes(saved?.workMinutes, WORK_DEFAULT_MINUTES);
    const breakMinutes = clampMinutes(saved?.breakMinutes, BREAK_DEFAULT_MINUTES);
    const mode = saved?.mode === 'break' ? 'break' : 'work';
    const maxSeconds = (mode === 'work' ? workMinutes : breakMinutes) * 60;
    const secondsLeft = Math.min(
      maxSeconds,
      Math.max(0, Number(saved?.secondsLeft) || maxSeconds),
    );

    return {
      workMinutes,
      breakMinutes,
      mode,
      secondsLeft,
      isRunning: false,
      autoStartNext: Boolean(saved?.autoStartNext),
      completedCycles: Math.max(0, Number(saved?.completedCycles) || 0),
      streakBonus: Math.max(0, Number(saved?.streakBonus) || 0),
    };
  } catch {
    return null;
  }
}

function getDefaults() {
  return {
    workMinutes: WORK_DEFAULT_MINUTES,
    breakMinutes: BREAK_DEFAULT_MINUTES,
    mode: 'work',
    secondsLeft: WORK_DEFAULT_MINUTES * 60,
    isRunning: false,
    autoStartNext: true,
    completedCycles: 0,
    streakBonus: 0,
  };
}

function playGentleTone() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();

    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
    gain.connect(context.destination);

    const osc1 = context.createOscillator();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(720, now);
    osc1.connect(gain);
    osc1.start(now);
    osc1.stop(now + 0.38);

    const osc2 = context.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(880, now + 0.28);
    osc2.connect(gain);
    osc2.start(now + 0.28);
    osc2.stop(now + 0.75);

    setTimeout(() => context.close().catch(() => {}), 1000);
  } catch {
    // no-op
  }
}

export function PomodoroProvider({ children }) {
  const initial = loadInitialState() || getDefaults();

  const [workMinutes, setWorkMinutes] = useState(initial.workMinutes);
  const [breakMinutes, setBreakMinutes] = useState(initial.breakMinutes);
  const [mode, setMode] = useState(initial.mode);
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const [isRunning, setIsRunning] = useState(initial.isRunning);
  const [autoStartNext, setAutoStartNext] = useState(initial.autoStartNext);
  const [completedCycles, setCompletedCycles] = useState(initial.completedCycles);
  const [streakBonus, setStreakBonus] = useState(initial.streakBonus);

  const intervalRef = useRef(null);

  const isBreak = mode === 'break';
  const totalSeconds = (isBreak ? breakMinutes : workMinutes) * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

  useEffect(() => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        workMinutes,
        breakMinutes,
        mode,
        secondsLeft,
        autoStartNext,
        completedCycles,
        streakBonus,
      }),
    );
  }, [workMinutes, breakMinutes, mode, secondsLeft, autoStartNext, completedCycles, streakBonus]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
          setIsRunning(false);
          playGentleTone();

          if (mode === 'work') {
            setMode('break');
            setSecondsLeft(breakMinutes * 60);
            setCompletedCycles((value) => value + 1);
            setStreakBonus((value) => value + 10);
            if (autoStartNext) setIsRunning(true);
          } else {
            setMode('work');
            setSecondsLeft(workMinutes * 60);
            if (autoStartNext) setIsRunning(true);
          }

          return 0;
        }

        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, mode, workMinutes, breakMinutes, autoStartNext]);

  function start() {
    setIsRunning(true);
  }

  function pause() {
    setIsRunning(false);
  }

  function reset() {
    setIsRunning(false);
    setMode('work');
    setSecondsLeft(workMinutes * 60);
  }

  function skipBreak() {
    if (mode !== 'break') return;
    setIsRunning(false);
    setMode('work');
    setSecondsLeft(workMinutes * 60);
  }

  function updateWorkMinutes(value) {
    const next = clampMinutes(value, WORK_DEFAULT_MINUTES);
    setWorkMinutes(next);
    if (mode === 'work' && !isRunning) setSecondsLeft(next * 60);
  }

  function updateBreakMinutes(value) {
    const next = clampMinutes(value, BREAK_DEFAULT_MINUTES);
    setBreakMinutes(next);
    if (mode === 'break' && !isRunning) setSecondsLeft(next * 60);
  }

  const value = useMemo(
    () => ({
      workMinutes,
      breakMinutes,
      mode,
      isBreak,
      secondsLeft,
      isRunning,
      autoStartNext,
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
    }),
    [
      workMinutes,
      breakMinutes,
      mode,
      isBreak,
      secondsLeft,
      isRunning,
      autoStartNext,
      completedCycles,
      streakBonus,
      progress,
    ],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro() {
  return useContext(PomodoroContext);
}
