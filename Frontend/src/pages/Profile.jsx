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
  Flame,
  GraduationCap,
  MessageCircle,
  Moon,
  Settings,
  Sparkles,
  Sun,
  Target,
} from 'lucide-react';

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

  const quickStats = [
    { id: 'courses', label: t('profileActiveCourses'), value: coursesLoading ? '—' : courses.length, icon: BookOpen },
    { id: 'streak', label: t('profileStreak'), value: streakValue, icon: Flame },
    { id: 'focus', label: t('profileFocusHours'), value: (focusMinutes / 60).toFixed(1), icon: Calendar },
    { id: 'cycles', label: t('profileCompletedCycles'), value: completedCycles, icon: Target },
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

  const totalInteractions = totals.summaries + totals.quizzes_generated + totals.quizzes_taken + totals.chats;

  const learningAction = (() => {
    if (totals.summaries === 0) return t('profileNextSummary');
    if (totals.quizzes_generated === 0) return t('profileNextQuiz');
    if (completedCycles === 0) return t('profileNextFocus');
    return t('profileNextReview');
  })();

  const automationCanSave = courses.length > 0 && automationSelection.length > 0 && !coursesLoading;

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

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      <section className="relative overflow-hidden rounded-3xl border border-slate-200 dark:border-slate-800 bg-slate-100 dark:bg-gradient-to-br dark:from-slate-900 dark:via-slate-950 dark:to-black p-8 shadow-xl">
        <div className="absolute inset-0 opacity-10 dark:opacity-20" style={{ background: 'radial-gradient(circle at top right, rgba(99,102,241,0.25), transparent 55%)' }} />
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-2xl bg-sky-100 dark:bg-indigo-500/20 border border-sky-200 dark:border-indigo-500/30 flex items-center justify-center text-2xl font-bold text-sky-700 dark:text-indigo-200">
              {initials}
            </div>
            <div>
              <p className="text-sm text-sky-700 dark:text-indigo-200 flex items-center gap-2">
                <GraduationCap className="w-4 h-4" /> {t('profileKicker')}
              </p>
              <h1 className="text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
                {user?.name || t('profileTitleFallback')}
              </h1>
              <p className="text-slate-600 dark:text-slate-400 text-sm">{user?.email || t('profileSubtitle')}</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="bg-sky-50 dark:bg-white/5 border border-sky-200 dark:border-white/10 rounded-2xl px-4 py-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('profileTotalInteractions')}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{totalInteractions}</p>
            </div>
            <div className="bg-sky-50 dark:bg-white/5 border border-sky-200 dark:border-white/10 rounded-2xl px-4 py-3 min-w-[140px]">
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('profileXp')}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">{xp} XP</p>
              <p className="text-xs text-slate-600 dark:text-slate-500">{t('profileLevel')} {level} · {rank}</p>
              <div className="mt-2 h-1 w-full rounded-full bg-slate-200 dark:bg-white/10">
                <div
                  className="h-full rounded-full bg-sky-600 dark:bg-indigo-500"
                  style={{ width: `${Math.round(levelProgress * 100)}%` }}
                />
              </div>
              {nextLevelXp > 0 && (
                <p className="mt-1 text-[0.65rem] text-slate-600 dark:text-slate-500">
                  {t('profileNextLevel')} {nextLevelXp} XP
                </p>
              )}
            </div>
            <div className="bg-sky-50 dark:bg-white/5 border border-sky-200 dark:border-white/10 rounded-2xl px-4 py-3">
              <p className="text-xs text-slate-600 dark:text-slate-400">{t('profileStreakBonus')}</p>
              <p className="text-lg font-semibold text-slate-900 dark:text-white">+{streakBonus}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {quickStats.map(({ id, label, value, icon: Icon }) => (
          <div key={id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-indigo-500/10 border border-sky-200 dark:border-indigo-500/20 text-sky-700 dark:text-indigo-300 flex items-center justify-center">
              <Icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-slate-600 dark:text-slate-400 uppercase tracking-wide">{label}</p>
              <p className="text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Award className="w-5 h-5 text-amber-500 dark:text-amber-400" /> {t('profileAchievements')}
              </h2>
              <span className="text-xs text-slate-600 dark:text-slate-500">{t('profileAchievementsHint')}</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {achievements.map((achievement) => {
                const earned = achievement.value >= achievement.goal;
                const progress = Math.min(100, Math.round((achievement.value / achievement.goal) * 100));
                return (
                  <div key={achievement.id} className="border border-slate-200 dark:border-slate-800 rounded-xl p-4 bg-slate-50 dark:bg-slate-950/40">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{achievement.label}</p>
                      <span className={`text-xs font-semibold ${earned ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-500'}`}>
                        {earned ? t('profileAchieved') : `${achievement.value}/${achievement.goal}`}
                      </span>
                    </div>
                    <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                      <div className={`h-full rounded-full ${earned ? 'bg-emerald-500' : 'bg-indigo-600 dark:bg-indigo-500'}`} style={{ width: `${progress}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-sky-600 dark:text-indigo-400" /> {t('profileDailyTasks')}
              </h2>
              {progressLoading && <span className="text-xs text-slate-600 dark:text-slate-500">{t('profileLoadingTasks')}</span>}
            </div>
            {tasks.length === 0 ? (
              <div className="text-sm text-slate-600 dark:text-slate-500">{t('profileTaskEmpty')}</div>
            ) : (
              <div className="flex flex-col gap-3">
                {tasks.map((task) => {
                  const progressPct = Math.min(100, Math.round((task.progress / Math.max(task.goal, 1)) * 100));
                  return (
                    <div key={task.key} className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 px-4 py-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">{task.title}</p>
                          {task.description && <p className="text-xs text-slate-600 dark:text-slate-500">{task.description}</p>}
                        </div>
                        <span className={`text-xs font-semibold ${task.completed ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-500'}`}>
                          {task.completed ? t('profileTaskCompleted') : `${task.progress}/${task.goal}`}
                        </span>
                      </div>
                      <div className="mt-3 h-2 w-full rounded-full bg-slate-200 dark:bg-slate-800">
                        <div
                          className={`h-full rounded-full ${task.completed ? 'bg-emerald-500' : 'bg-sky-600 dark:bg-indigo-500'}`}
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-500">{t('profileTaskReward')} {task.xp_reward} XP</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>

        <div className="flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <MessageCircle className="w-5 h-5 text-emerald-600 dark:text-emerald-400" /> {t('profileLeaderboard')}
            </h2>
            {leaderboard.length === 0 ? (
              <p className="text-sm text-slate-600 dark:text-slate-500">{t('profileLeaderboardEmpty')}</p>
            ) : (
              <div className="flex flex-col gap-3">
                {leaderboard.map((entry, index) => (
                  <div
                    key={entry.user_id}
                    className={`flex items-center justify-between rounded-xl border px-4 py-3 ${entry.user_id === user?.id ? 'border-sky-200 dark:border-indigo-500/50 bg-sky-50 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40'}`}
                  >
                    <div>
                      <p className="text-sm text-slate-900 dark:text-slate-200 font-medium">#{index + 1} {entry.name}</p>
                      <p className="text-xs text-slate-600 dark:text-slate-500">{t('profileLevel')} {entry.level} · {entry.rank}</p>
                    </div>
                    <span className="text-sm font-semibold text-slate-900 dark:text-white">{entry.xp} XP</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-4">
              <Settings className="w-5 h-5 text-slate-600 dark:text-slate-300" /> {t('profileSettings')}
            </h2>
            <div className="flex flex-col gap-4">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{t('automationTitle')}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-500">{t('automationBody')}</p>
                  </div>
                  {automationSaved && (
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">{t('automationSaved')}</span>
                  )}
                </div>
                {coursesLoading ? (
                  <p className="text-xs text-slate-600 dark:text-slate-500">{t('profileLoadingCourses')}</p>
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
                <span className="text-xs text-slate-600 dark:text-slate-400">{theme === 'dark' ? t('profileThemeDark') : t('profileThemeLight')}</span>
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
                <span className="text-xs text-slate-600 dark:text-slate-400">{lang === 'en' ? 'English' : 'Arabic'}</span>
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
