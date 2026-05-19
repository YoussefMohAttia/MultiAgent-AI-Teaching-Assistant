import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { logProgressEvent } from '../services/api';

const PomodoroContext = createContext(null);

const WORK_DEFAULT_MINUTES = 30;
const BREAK_DEFAULT_MINUTES = 5;
const STORAGE_KEY = 'pomodoro_state_v1';
const DAILY_KEY = 'pomodoro_daily_v1';
const DEFAULT_FOCUS_GOAL = 120; // minutes

function clampMinutes(value, fallback) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(120, Math.max(1, Math.round(parsed)));
}

function getTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function loadDailyState() {
  try {
    const raw = localStorage.getItem(DAILY_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (saved?.date !== getTodayStr()) return null; // stale — reset
    return {
      todayFocusSeconds: Math.max(0, Number(saved?.todayFocusSeconds) || 0),
      focusGoalMinutes: Math.max(10, Math.min(480, Number(saved?.focusGoalMinutes) || DEFAULT_FOCUS_GOAL)),
      sessionHistory: Array.isArray(saved?.sessionHistory) ? saved.sessionHistory : [],
    };
  } catch {
    return null;
  }
}

function getDailyDefaults() {
  return {
    todayFocusSeconds: 0,
    focusGoalMinutes: DEFAULT_FOCUS_GOAL,
    sessionHistory: [],
  };
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
  const dailyInitial = loadDailyState() || getDailyDefaults();

  const [workMinutes, setWorkMinutes] = useState(initial.workMinutes);
  const [breakMinutes, setBreakMinutes] = useState(initial.breakMinutes);
  const [mode, setMode] = useState(initial.mode);
  const [secondsLeft, setSecondsLeft] = useState(initial.secondsLeft);
  const [isRunning, setIsRunning] = useState(initial.isRunning);
  const [autoStartNext, setAutoStartNext] = useState(initial.autoStartNext);
  const [completedCycles, setCompletedCycles] = useState(initial.completedCycles);
  const [streakBonus, setStreakBonus] = useState(initial.streakBonus);

  // Daily focus tracking
  const [todayFocusSeconds, setTodayFocusSeconds] = useState(dailyInitial.todayFocusSeconds);
  const [focusGoalMinutes, setFocusGoalMinutes] = useState(dailyInitial.focusGoalMinutes);
  const [sessionHistory, setSessionHistory] = useState(dailyInitial.sessionHistory);

  const completedRef = useRef(initial.completedCycles);
  const intervalRef = useRef(null);

  const isBreak = mode === 'break';
  const totalSeconds = (isBreak ? breakMinutes : workMinutes) * 60;
  const progress = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;
  const todayFocusMinutes = Math.floor(todayFocusSeconds / 60);

  // Persist main timer state
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

  // Persist daily state
  useEffect(() => {
    localStorage.setItem(
      DAILY_KEY,
      JSON.stringify({
        date: getTodayStr(),
        todayFocusSeconds,
        focusGoalMinutes,
        sessionHistory,
      }),
    );
  }, [todayFocusSeconds, focusGoalMinutes, sessionHistory]);

  useEffect(() => {
    const last = completedRef.current;
    if (completedCycles > last) {
      const delta = completedCycles - last;
      logProgressEvent({ event_type: 'pomodoro_cycle', amount: delta }).catch(() => {});
    }
    completedRef.current = completedCycles;
  }, [completedCycles]);

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
            // Log completed work session
            setSessionHistory((prev) => [...prev, { type: 'work', timestamp: Date.now() }]);
            if (autoStartNext) setIsRunning(true);
          } else {
            setMode('work');
            setSecondsLeft(workMinutes * 60);
            // Log completed break session
            setSessionHistory((prev) => [...prev, { type: 'break', timestamp: Date.now() }]);
            if (autoStartNext) setIsRunning(true);
          }

          return 0;
        }

        return prev - 1;
      });

      // Track focus time (only during work mode)
      if (mode === 'work') {
        setTodayFocusSeconds((prev) => prev + 1);
      }
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

  function updateFocusGoal(value) {
    const clamped = Math.max(10, Math.min(480, Math.round(Number(value) || DEFAULT_FOCUS_GOAL)));
    setFocusGoalMinutes(clamped);
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
      todayFocusMinutes,
      todayFocusSeconds,
      focusGoalMinutes,
      sessionHistory,
      start,
      pause,
      reset,
      skipBreak,
      updateWorkMinutes,
      updateBreakMinutes,
      updateFocusGoal,
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
      todayFocusMinutes,
      todayFocusSeconds,
      focusGoalMinutes,
      sessionHistory,
    ],
  );

  return <PomodoroContext.Provider value={value}>{children}</PomodoroContext.Provider>;
}

export function usePomodoro() {
  return useContext(PomodoroContext);
}
