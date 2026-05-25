import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useToasts } from '../contexts/ToastContext';
import { getCourses, getProgress, getQuizStatus, getSummaryStatus, runFullSync } from '../services/api';
import { getStats } from '../lib/activity';
import CourseAutomationSelector from '../components/CourseAutomationSelector';
import { readAutomationPrefs, saveAutomationPrefs } from '../lib/automationPreferences';
import {
  Award,
  BookOpen,
  Calendar,
  ChevronRight,
  Flame,
  GraduationCap,
  MessageCircle,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Target,
  Trophy,
  Zap,
} from 'lucide-react';

/* ── Rank Metadata ──────────────────────────────────────────────────────── */
const RANK_META = {
  Copper:            { emoji: '🛡️', color: '#b87333', bg: 'rgba(184,115,51,0.12)' },
  Bronze:            { emoji: '⚔️', color: '#cd7f32', bg: 'rgba(205,127,50,0.12)' },
  Silver:            { emoji: '🗡️', color: '#a8a9b4', bg: 'rgba(168,169,180,0.12)' },
  Gold:              { emoji: '⭐', color: '#ffd700', bg: 'rgba(255,215,0,0.10)' },
  Platinum:          { emoji: '💠', color: '#00ced1', bg: 'rgba(0,206,209,0.10)' },
  Emerald:           { emoji: '🟢', color: '#50c878', bg: 'rgba(80,200,120,0.10)' },
  Diamond:           { emoji: '💎', color: '#b9f2ff', bg: 'rgba(185,242,255,0.10)' },
  Champion:          { emoji: '🏆', color: '#9b59b6', bg: 'rgba(155,89,182,0.12)' },
  'Grand Champion':  { emoji: '🔥', color: '#e74c3c', bg: 'rgba(231,76,60,0.12)' },
  Legend:            { emoji: '👑', color: '#f1c40f', bg: 'rgba(241,196,15,0.12)' },
};

function getRankMeta(rank) {
  return RANK_META[rank] || RANK_META.Copper;
}

/* ── XP Progress Ring ───────────────────────────────────────────────────── */
function XpRing({ progress, color, size = 140, strokeWidth = 10 }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - Math.max(0, Math.min(1, progress)) * circumference;

  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference} strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 0.8s ease', filter: `drop-shadow(0 0 8px ${color}50)` }}
      />
    </svg>
  );
}

/* ── Helpers ────────────────────────────────────────────────────────────── */
function formatLocalDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function computeStreak(userId) {
  const key = `dashboard_streak_${userId}`;
  const today = new Date();
  const todayStr = formatLocalDate(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = formatLocalDate(yesterday);

  let current = { streak: 1, lastDate: todayStr };

  try {
    const savedRaw = localStorage.getItem(key);
    if (savedRaw) {
      const saved = JSON.parse(savedRaw);
      const prevStreak = Number(saved?.streak) || 0;
      const prevDate = saved?.lastDate;

      if (prevDate === todayStr) {
        current = { streak: Math.max(prevStreak, 1), lastDate: todayStr };
      } else if (prevDate === yesterdayStr) {
        current = { streak: Math.max(prevStreak + 1, 1), lastDate: todayStr };
      }
    }
  } catch {
    current = { streak: 1, lastDate: todayStr };
  }

  localStorage.setItem(key, JSON.stringify(current));
  return current.streak;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, toggleLang, t } = useLanguage();
  const { completedCycles, streakBonus, workMinutes } = usePomodoro();
  const { pushToast } = useToasts();
  const isLocalAccount = user?.auth_provider === 'local';

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [streak, setStreak] = useState(1);
  const [progress, setProgress] = useState(null);
  const [progressLoading, setProgressLoading] = useState(false);
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => {
    const raw = localStorage.getItem('profile_notifications');
    return raw ? raw === 'true' : true;
  });
  const [stats, setStats] = useState(() => getStats());
  const [automationSelection, setAutomationSelection] = useState([]);
  const [automationSaved, setAutomationSaved] = useState(false);
  const [automationSyncing, setAutomationSyncing] = useState(false);
  const summaryPollRef = useRef(null);
  const quizPollRef = useRef(null);

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }

    setStreak(computeStreak(user.id));

    setCoursesLoading(true);
    getCourses()
      .then((res) => setCourses(res.data.courses || []))
      .catch(() => setCourses([]))
      .finally(() => setCoursesLoading(false));

    setProgressLoading(true);
    getProgress()
      .then((res) => setProgress(res.data))
      .catch(() => setProgress(null))
      .finally(() => setProgressLoading(false));

    setStats(getStats());
  }, [user, navigate]);

  useEffect(() => () => {
    if (summaryPollRef.current) {
      clearTimeout(summaryPollRef.current);
      summaryPollRef.current = null;
    }
    if (quizPollRef.current) {
      clearTimeout(quizPollRef.current);
      quizPollRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user?.id) return;
    const stored = readAutomationPrefs(user.id);
    setAutomationSelection(stored.selectedCourseIds);
  }, [user?.id]);

  useEffect(() => {
    if (courses.length === 0) return;
    const courseIds = courses.map((course) => String(course.id));
    setAutomationSelection((prev) => prev.filter((id) => courseIds.includes(id)));
  }, [courses]);

  useEffect(() => {
    localStorage.setItem('profile_notifications', String(notificationsEnabled));
  }, [notificationsEnabled]);

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const focusMinutes = useMemo(() => completedCycles * workMinutes, [completedCycles, workMinutes]);
  const totals = progress?.totals || {
    summaries: stats.summaries,
    quizzes_generated: stats.quizzesGenerated,
    quizzes_taken: stats.quizzesTaken,
    chats: stats.chats,
    essays: stats.essays,
    evaluations: stats.evaluations,
    pomodoro_cycles: completedCycles,
    quiz_correct: 0,
  };
  const xp = progress?.xp ?? 0;
  const level = progress?.level ?? 1;
  const rank = progress?.rank ?? t('profileRankFallback');
  const nextLevelXp = progress?.next_level_xp ?? 0;
  const levelProgress = progress?.level_progress ?? 0;
  const streakValue = progress?.day_streak ?? streak;
  const tasks = progress?.tasks || [];
  const leaderboard = progress?.leaderboard || [];

  const rankMeta = getRankMeta(rank);

  const quickStats = [
    { id: 'courses', label: t('profileActiveCourses'), value: coursesLoading ? '—' : courses.length, icon: BookOpen, color: '#60a5fa' },
    { id: 'streak', label: t('profileStreak'), value: streakValue, icon: Flame, color: '#f97316' },
    { id: 'focus', label: t('profileFocusHours'), value: (focusMinutes / 60).toFixed(1), icon: Calendar, color: '#2dd4bf' },
    { id: 'cycles', label: t('profileCompletedCycles'), value: completedCycles, icon: Target, color: '#a78bfa' },
    { id: 'interactions', label: t('profileTotalInteractions'), value: totals.summaries + totals.quizzes_generated + totals.quizzes_taken + totals.chats, icon: Zap, color: '#fbbf24' },
    { id: 'bonus', label: t('profileStreakBonus'), value: `+${streakBonus}`, icon: Sparkles, color: '#ec4899' },
  ];

  const achievements = (progress?.achievements?.length
    ? progress.achievements.map((item) => ({
        id: item.key,
        label: item.title,
        goal: item.goal,
        value: item.progress,
      }))
    : [
        { id: 'streak-3', label: t('profileAchievementStreak'), goal: 3, value: streakValue },
        { id: 'summaries-3', label: t('profileAchievementSummaries'), goal: 3, value: stats.summaries },
        { id: 'quizzes-2', label: t('profileAchievementQuizzes'), goal: 2, value: stats.quizzesGenerated },
        { id: 'focus-3', label: t('profileAchievementFocus'), goal: 3, value: completedCycles },
      ]
  );

  const learningAction = (() => {
    if (totals.summaries === 0) return t('profileNextSummary');
    if (totals.quizzes_generated === 0) return t('profileNextQuiz');
    if (completedCycles === 0) return t('profileNextFocus');
    return t('profileNextReview');
  })();

  const automationCanSave = courses.length > 0 && !coursesLoading;

  function scheduleSummaryPolling(scheduledIds) {
    if (summaryPollRef.current) {
      clearTimeout(summaryPollRef.current);
      summaryPollRef.current = null;
    }

    const pendingIds = Array.from(new Set(scheduledIds || []));
    if (!pendingIds.length) return;
    const maxAttempts = 12;

    const poll = async (attempt) => {
      if (!pendingIds.length || attempt >= maxAttempts) return;
      try {
        const res = await getSummaryStatus(pendingIds);
        const statuses = res.data?.statuses || {};
        for (let i = pendingIds.length - 1; i >= 0; i -= 1) {
          const docId = pendingIds[i];
          if (statuses[String(docId)] === 'ready') {
            pendingIds.splice(i, 1);
          }
        }
        if (!pendingIds.length) {
          pushToast({
            title: t('syncSummaryReadyTitle'),
            message: t('syncSummaryReadyContent'),
            tone: 'success',
          });
          return;
        }
      } catch {
        return;
      }

      summaryPollRef.current = setTimeout(() => poll(attempt + 1), 5000);
    };

    poll(0);
  }

  function scheduleQuizPolling(scheduledIds) {
    if (quizPollRef.current) {
      clearTimeout(quizPollRef.current);
      quizPollRef.current = null;
    }

    const pendingIds = Array.from(new Set(scheduledIds || []));
    if (!pendingIds.length) return;
    const maxAttempts = 12;

    const poll = async (attempt) => {
      if (!pendingIds.length || attempt >= maxAttempts) return;
      try {
        const res = await getQuizStatus(pendingIds);
        const statuses = res.data?.statuses || {};
        for (let i = pendingIds.length - 1; i >= 0; i -= 1) {
          const docId = pendingIds[i];
          if (statuses[String(docId)] === 'ready') {
            pendingIds.splice(i, 1);
          }
        }
        if (!pendingIds.length) {
          pushToast({
            title: t('syncQuizReadyTitle'),
            message: t('syncQuizReadyContent'),
            tone: 'success',
          });
          return;
        }
      } catch {
        return;
      }

      quizPollRef.current = setTimeout(() => poll(attempt + 1), 5000);
    };

    poll(0);
  }

  const handleSaveAutomation = async () => {
    if (!user?.id || !automationCanSave) return;
    const courseIds = new Set(courses.map((course) => String(course.id)));
    const nextSelection = automationSelection.filter((id) => courseIds.has(id));
    saveAutomationPrefs(user.id, nextSelection);
    setAutomationSelection(nextSelection);
    setAutomationSaved(true);
    window.setTimeout(() => setAutomationSaved(false), 2000);
    if (!isLocalAccount) {
      try {
        setAutomationSyncing(true);
        const res = await runFullSync(user.id, nextSelection);
        const responsePayload = res?.data || {};
        const scheduledSummaryIds = responsePayload.auto_summary?.scheduled_doc_ids || [];
        const scheduledQuizIds = responsePayload.auto_quiz?.scheduled_doc_ids || [];

        if (scheduledSummaryIds.length) {
          pushToast({
            title: t('syncSummaryQueuedTitle'),
            message: t('syncSummaryQueuedGeneric'),
            tone: 'warning',
          });
          scheduleSummaryPolling(scheduledSummaryIds);
        }

        if (scheduledQuizIds.length) {
          pushToast({
            title: t('syncQuizQueuedTitle'),
            message: t('syncQuizQueuedGeneric'),
            tone: 'warning',
          });
          scheduleQuizPolling(scheduledQuizIds);
        }
        localStorage.setItem('last_sync_ts', String(Date.now()));
      } catch {
        // Ignore sync errors; user can retry from dashboard if needed.
      } finally {
        setAutomationSyncing(false);
      }
    }
  };

  const MEDAL = ['🥇', '🥈', '🥉'];

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in duration-500 pb-8">

      {/* ═══════════════ HERO SECTION ═══════════════ */}
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-100 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-black p-8 shadow-xl">
        {/* Background glow */}
        <div className="absolute inset-0 pointer-events-none" style={{
          background: `radial-gradient(circle at 20% 50%, ${rankMeta.color}15 0%, transparent 50%), radial-gradient(circle at 80% 30%, rgba(99,102,241,0.08) 0%, transparent 50%)`
        }} />

        <div className="relative flex flex-col md:flex-row md:items-center gap-8">
          {/* Left: Avatar + Info */}
          <div className="flex items-center gap-5 flex-1 min-w-0">
            {/* Avatar with rank ring */}
            <div className="relative flex-shrink-0">
              <XpRing progress={levelProgress} color={rankMeta.color} size={96} strokeWidth={5} />
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="h-16 w-16 rounded-2xl border-2 flex items-center justify-center text-2xl font-bold"
                  style={{
                    background: rankMeta.bg,
                    borderColor: `${rankMeta.color}40`,
                    color: rankMeta.color,
                  }}
                >
                  {initials}
                </div>
              </div>
            </div>

            <div className="min-w-0">
              <p className="text-sm flex items-center gap-2 mb-1" style={{ color: rankMeta.color }}>
                <GraduationCap className="w-4 h-4" /> {t('profileKicker')}
              </p>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight truncate">
                {user?.name || t('profileTitleFallback')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm truncate">{user?.email || t('profileSubtitle')}</p>
            </div>
          </div>

          {/* Right: Rank Badge + XP Info */}
          <div className="flex flex-wrap items-center gap-4">
            {/* Rank Badge */}
            <div className="flex items-center gap-3 rounded-2xl px-5 py-4 border"
              style={{
                background: rankMeta.bg,
                borderColor: `${rankMeta.color}25`,
              }}
            >
              <span className="text-3xl">{rankMeta.emoji}</span>
              <div>
                <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">Rank</p>
                <p className="text-lg font-bold" style={{ color: rankMeta.color }}>{rank}</p>
              </div>
            </div>

            {/* Level + XP */}
            <div className="rounded-2xl px-5 py-4 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{t('profileLevel')} {level}</p>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{xp.toLocaleString()} <span className="text-sm font-medium text-slate-500">XP</span></p>
              <div className="mt-2 h-1.5 w-full rounded-full bg-slate-200 dark:bg-white/10 min-w-[120px]">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{ width: `${Math.round(levelProgress * 100)}%`, background: rankMeta.color }}
                />
              </div>
              {nextLevelXp > 0 && (
                <p className="mt-1 text-[0.65rem] text-slate-500 dark:text-slate-500">
                  {t('profileNextLevel')} {nextLevelXp.toLocaleString()} XP
                </p>
              )}
            </div>

            {/* Streak */}
            <div className="rounded-2xl px-5 py-4 bg-white/50 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-center">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wider font-semibold">{t('profileStreak')}</p>
              <p className="text-2xl font-bold text-orange-500 dark:text-orange-400 flex items-center justify-center gap-1">
                <Flame className="w-5 h-5" /> {streakValue}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════ QUICK STATS ═══════════════ */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {quickStats.map(({ id, label, value, icon: Icon, color }) => (
          <div key={id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex items-center gap-3 hover:border-slate-300 dark:hover:border-slate-700 transition-colors">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: `${color}15`, color }}
            >
              <Icon className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-[11px] text-slate-500 dark:text-slate-400 uppercase tracking-wide truncate">{label}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* ═══════════════ MAIN CONTENT GRID ═══════════════ */}
      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2/3) */}
        <div className="lg:col-span-2 flex flex-col gap-6">

          {/* ── Achievements ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500 dark:text-amber-400" /> {t('profileAchievements')}
              </h2>
              <span className="text-xs text-slate-500 dark:text-slate-500">{t('profileAchievementsHint')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {achievements.map((achievement) => {
                const earned = achievement.value >= achievement.goal;
                const pct = Math.min(100, Math.round((achievement.value / achievement.goal) * 100));
                return (
                  <div key={achievement.id}
                    className={`border rounded-xl p-4 transition-all ${earned
                      ? 'border-amber-300 dark:border-amber-500/30 bg-amber-50/50 dark:bg-amber-500/5'
                      : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40'
                    }`}
                    style={earned ? { boxShadow: '0 0 16px rgba(245,158,11,0.08)' } : {}}
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-900 dark:text-slate-200 font-medium flex items-center gap-2">
                        {earned && <span className="text-amber-500">🏅</span>}
                        {achievement.label}
                      </p>
                      <span className={`text-xs font-semibold ${earned ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-500'}`}>
                        {earned ? t('profileAchieved') : `${achievement.value}/${achievement.goal}`}
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full rounded-full transition-all duration-500 ${earned ? 'bg-amber-500' : 'bg-indigo-600 dark:bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Daily Tasks ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600 dark:text-indigo-400" /> {t('profileDailyTasks')}
              </h2>
              {progressLoading && <span className="text-xs text-slate-500 dark:text-slate-500">{t('profileLoadingTasks')}</span>}
            </div>
            {tasks.length === 0 ? (
              <div className="text-sm text-slate-500 dark:text-slate-500">{t('profileTaskEmpty')}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks.map((task) => {
                  const progressPct = Math.min(100, Math.round((task.progress / Math.max(task.goal, 1)) * 100));
                  return (
                    <div key={task.key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{task.title}</p>
                          {task.description && <p className="text-xs text-slate-500 dark:text-slate-500">{task.description}</p>}
                        </div>
                        <span className={`text-xs font-semibold ${task.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-500'}`}>
                          {task.completed ? t('profileTaskCompleted') : `${task.progress}/${task.goal}`}
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${task.completed ? 'bg-emerald-500' : 'bg-sky-600 dark:bg-indigo-500'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">{t('profileTaskReward')} {task.xp_reward} XP</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Rank Progression Map ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-5">
              <Trophy className="w-5 h-5 text-indigo-500 dark:text-indigo-400" /> Rank Progression
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              {Object.entries(RANK_META).map(([name, meta]) => {
                const isActive = name === rank;
                const isPast = Object.keys(RANK_META).indexOf(name) < Object.keys(RANK_META).indexOf(rank);
                return (
                  <div key={name}
                    className={`flex items-center gap-3 rounded-xl px-3 py-2.5 border transition-all ${
                      isActive
                        ? 'border-current shadow-sm'
                        : isPast
                        ? 'border-slate-200 dark:border-slate-700 opacity-60'
                        : 'border-slate-200 dark:border-slate-800 opacity-30'
                    }`}
                    style={isActive ? { borderColor: meta.color, background: meta.bg, boxShadow: `0 0 12px ${meta.color}20` } : {}}
                  >
                    <span className="text-xl">{meta.emoji}</span>
                    <div>
                      <p className={`text-xs font-bold ${isActive ? '' : 'text-slate-600 dark:text-slate-400'}`}
                        style={isActive ? { color: meta.color } : {}}
                      >{name}</p>
                    </div>
                    {isActive && <ChevronRight className="w-3 h-3 ml-auto" style={{ color: meta.color }} />}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column (1/3) */}
        <div className="flex flex-col gap-6">

          {/* ── Leaderboard ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> {t('profileLeaderboard')}
            </h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-500">{t('profileLeaderboardEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {leaderboard.map((entry, index) => {
                  const isMe = entry.user_id === user?.id;
                  const entryRankMeta = getRankMeta(entry.rank);
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between rounded-xl border px-4 py-3 transition-all ${isMe ? 'shadow-sm' : 'bg-slate-50 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800'}`}
                      style={isMe ? { borderColor: `${entryRankMeta.color}50`, background: `${entryRankMeta.color}08` } : {}}
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold min-w-[24px]">
                          {index < 3 ? MEDAL[index] : `#${index + 1}`}
                        </span>
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{entry.name}</p>
                          <p className="text-xs text-slate-500 dark:text-slate-500 flex items-center gap-1">
                            <span>{entryRankMeta.emoji}</span>
                            {t('profileLevel')} {entry.level} · {entry.rank}
                          </p>
                        </div>
                      </div>
                      <span className="text-sm font-semibold text-slate-900 dark:text-white">{entry.xp.toLocaleString()} XP</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ── Settings ── */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-500 dark:text-slate-300" /> {t('profileSettings')}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{t('automationTitle')}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-500">{t('automationBody')}</p>
                  </div>
                  {automationSaved && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('automationSaved')}</span>
                  )}
                </div>
                {coursesLoading ? (
                  <p className="text-xs text-slate-500 dark:text-slate-500">{t('profileLoadingCourses')}</p>
                ) : (
                  <CourseAutomationSelector
                    courses={courses}
                    selectedCourseIds={automationSelection}
                    onChange={setAutomationSelection}
                  />
                )}
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={handleSaveAutomation}
                    disabled={!automationCanSave || automationSyncing}
                    className="px-4 py-2 rounded-lg bg-sky-600 text-white text-sm font-semibold hover:bg-sky-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {automationSyncing ? t('syncing') : t('automationSave')}
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={toggle}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <span className="flex items-center gap-2">
                  {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                  {t('profileTheme')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{theme === 'dark' ? t('profileThemeDark') : t('profileThemeLight')}</span>
              </button>
              <button
                type="button"
                onClick={toggleLang}
                className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <MessageCircle className="w-4 h-4" />
                  {t('profileLanguage')}
                </span>
                <span className="text-xs text-slate-500 dark:text-slate-400">{lang === 'en' ? 'English' : 'Arabic'}</span>
              </button>
              <label className="flex items-center justify-between rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3 text-sm text-slate-900 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors cursor-pointer">
                <span>{t('profileNotifications')}</span>
                <input
                  type="checkbox"
                  checked={notificationsEnabled}
                  onChange={(e) => setNotificationsEnabled(e.target.checked)}
                  className="h-4 w-4 accent-sky-600 dark:accent-indigo-500"
                />
              </label>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
