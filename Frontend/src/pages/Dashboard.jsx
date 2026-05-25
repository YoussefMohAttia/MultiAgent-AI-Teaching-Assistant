import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getSummaryStatus, getQuizStatus, getProgress, runCourseSync, runFullSync } from '../services/api';
import { useToasts } from '../contexts/ToastContext';
import { getStats } from '../lib/activity';
import CourseAutomationSelector from '../components/CourseAutomationSelector';
import { hasAutomationPrefs, readAutomationPrefs, saveAutomationPrefs } from '../lib/automationPreferences';
import { 
  BookOpen, Flame, RefreshCw, CloudSync, 
  BrainCircuit, Inbox, Sparkles,
  Sun, Moon, Languages, ShieldCheck
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

function getGreeting(hour, copy) {
  if (hour < 12) return copy.greetingMorning;
  if (hour < 18) return copy.greetingAfternoon;
  return copy.greetingEvening;
}

function makeStudyToast(doc, contentKey, tone, t) {
  return {
    title: doc.course_title || doc.courseTitle || '',
    subtitle: doc.title || '',
    message: t(contentKey),
    tone,
  };
}

export default function Dashboard() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, toggleLang, copy, t } = useLanguage();
  const navigate = useNavigate();
  const isLocalAccount = user?.auth_provider === 'local';
  const { pushToast } = useToasts();

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [streak, setStreak] = useState(1);
  const [progress, setProgress] = useState(null);
  const [stats, setStats] = useState(() => getStats());
  const summaryPollRef = useRef(null);
  const quizPollRef = useRef(null);
  const syncRunRef = useRef(false);
  const [automationModalOpen, setAutomationModalOpen] = useState(false);
  const [automationSelection, setAutomationSelection] = useState([]);
  const [automationPrefsLoaded, setAutomationPrefsLoaded] = useState(false);

  const SYNC_COOLDOWN_MS = 5 * 60 * 1000;
  const syncStorageKey = user?.id ? `last_sync_ts_${user.id}` : 'last_sync_ts_guest';

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setStreak(computeStreak(user.id));
    setStats(getStats());
    getProgress()
      .then((res) => setProgress(res.data))
      .catch(() => setProgress(null));
    if (isLocalAccount) {
      fetchCourses();
      return;
    }
    if (!automationPrefsLoaded || automationModalOpen) {
      return;
    }
    
    autoSync();
  }, [user, isLocalAccount, automationPrefsLoaded, automationModalOpen]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setStats(getStats());
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
    if (!user?.id) {
      setAutomationPrefsLoaded(false);
      setAutomationSelection([]);
      setAutomationModalOpen(false);
      return;
    }

    const stored = readAutomationPrefs(user.id);
    setAutomationSelection(stored.selectedCourseIds);
    setAutomationPrefsLoaded(true);
  }, [user?.id]);

  useEffect(() => {
    if (!automationPrefsLoaded || coursesLoading || !user?.id) return;
    if (!hasAutomationPrefs(user.id)) {
      setAutomationModalOpen(true);
      return;
    }

    const courseIds = courses.map((course) => String(course.id));
    if (courseIds.length === 0) return;

    setAutomationSelection((prev) => prev.filter((id) => courseIds.includes(id)));
  }, [automationPrefsLoaded, coursesLoading, courses, user?.id]);

  function scheduleSummaryPolling(items, scheduledIds = null) {
    if (summaryPollRef.current) {
      clearTimeout(summaryPollRef.current);
      summaryPollRef.current = null;
    }

    const pendingIds = (scheduledIds && scheduledIds.length)
      ? Array.from(new Set(scheduledIds))
      : items.map((doc) => doc.id);
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

      if (pendingIds.length) {
        summaryPollRef.current = setTimeout(() => poll(attempt + 1), 5000);
      }
    };

    poll(0);
  }

  function scheduleQuizPolling(items, scheduledIds = null) {
    if (quizPollRef.current) {
      clearTimeout(quizPollRef.current);
      quizPollRef.current = null;
    }

    const pendingIds = (scheduledIds && scheduledIds.length)
      ? Array.from(new Set(scheduledIds))
      : items.map((doc) => doc.id);
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

      if (pendingIds.length) {
        quizPollRef.current = setTimeout(() => poll(attempt + 1), 5000);
      }
    };

    poll(0);
  }


  async function autoSync() {
    const lastSync = parseInt(localStorage.getItem(syncStorageKey) || '0', 10);
    if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
      await fetchCourses();
      return;
    }
    await runSync();
  }

  async function runSync(selectionOverride = null) {
    if (syncRunRef.current) return;
    syncRunRef.current = true;
    setSyncing(true);
    let liveFetchTimer = null;
    try {
      try {
        await runCourseSync(user.id);
        await fetchCourses();
      } catch {
        // Continue to full sync even if course-only sync fails.
      }

      liveFetchTimer = setInterval(() => {
        void fetchCourses();
      }, 3000);

      const res = await runFullSync(user.id, selectionOverride || automationSelection);

      const responsePayload = res?.data || {};
      const newMaterials = responsePayload.new_materials || [];
      const scheduledSummaryIds = responsePayload.auto_summary?.scheduled_doc_ids || [];
      const scheduledQuizIds = responsePayload.auto_quiz?.scheduled_doc_ids || [];

      if (newMaterials.length) {
        newMaterials.forEach((doc) => {
          pushToast({ title: t('syncNewDocTitle'), message: doc.title, tone: 'info' });
        });
      }

      if (scheduledSummaryIds.length) {
        pushToast({
          title: t('syncSummaryQueuedTitle'),
          message: t('syncSummaryQueuedGeneric'),
          tone: 'warning',
        });
        scheduleSummaryPolling([], scheduledSummaryIds);
      }

      if (scheduledQuizIds.length) {
        pushToast({
          title: t('syncQuizQueuedTitle'),
          message: t('syncQuizQueuedGeneric'),
          tone: 'warning',
        });
        scheduleQuizPolling([], scheduledQuizIds);
      }
    } catch (err) {
      console.warn('Sync failed:', err?.response?.data?.detail || err.message);
    } finally {
      if (liveFetchTimer) {
        clearInterval(liveFetchTimer);
      }
      localStorage.setItem(syncStorageKey, String(Date.now()));
      setSyncing(false);
      syncRunRef.current = false;
    }
    // Fetch whatever courses we currently have in the DB
    await fetchCourses();
  }

  async function fetchCourses() {
    setCoursesLoading(true);
    try {
      const res = await axios.get('/api/courses/', {
        headers: { Authorization: `Bearer ${user.token}` },
      });
      setCourses(res.data.courses || []);
    } catch {
      setCourses([]);
    } finally {
      setCoursesLoading(false);
    }
  }

  function handleSaveAutomation() {
    if (!user?.id) return;
    const courseIds = new Set(courses.map((course) => String(course.id)));
    const nextSelection = automationSelection.filter((id) => courseIds.has(id));
    saveAutomationPrefs(user.id, nextSelection);
    setAutomationSelection(nextSelection);
    setAutomationModalOpen(false);
    if (!isLocalAccount) {
      void runSync(nextSelection);
    }
  }

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const hour = new Date().getHours();
  const greeting = getGreeting(hour, copy);
  const dateLocale = copy.dateLocale || 'en-US';
  const aiInteractions = stats.summaries + stats.quizzesGenerated + stats.quizzesTaken + stats.chats;
  const dayStreak = progress?.day_streak ?? streak;
  const automationCanSave = courses.length > 0 && !coursesLoading;

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* ── Hero Banner ── */}
      <section className="relative overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-800 p-8 md:p-10"
        style={{
          background: theme === 'dark'
            ? 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(15,23,42,0.95) 40%, rgba(15,23,42,0.98) 100%)'
            : 'linear-gradient(135deg, rgba(99,102,241,0.1) 0%, rgba(248,250,252,0.95) 40%, rgba(248,250,252,0.98) 100%)',
        }}
      >
        {/* Animated gradient orbs */}
        <div className="absolute -top-20 -right-20 w-64 h-64 rounded-full opacity-30 blur-3xl pointer-events-none animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(99,102,241,0.6), transparent 70%)' }}
        />
        <div className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-20 blur-3xl pointer-events-none animate-pulse"
          style={{ background: 'radial-gradient(circle, rgba(56,189,248,0.5), transparent 70%)', animationDelay: '2s' }}
        />
        
        <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="h-16 w-16 rounded-2xl bg-indigo-500/10 dark:bg-indigo-500/20 border border-indigo-200 dark:border-indigo-500/30 flex items-center justify-center text-2xl font-bold text-indigo-600 dark:text-indigo-200 shadow-lg shadow-indigo-500/5 dark:shadow-indigo-500/10">
              {initials}
            </div>
            <div>
              <p className="text-sm text-indigo-600 dark:text-indigo-300 font-medium mb-1 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                {new Date().toLocaleDateString(dateLocale, { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-slate-900 dark:text-white">
                {greeting},{' '}
                <span className="bg-gradient-to-r from-indigo-500 to-sky-500 dark:from-indigo-400 dark:to-sky-400 bg-clip-text text-transparent">
                  {user?.name?.split(' ')[0] || copy.greetingFallback}
                </span>
              </h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button type="button" onClick={toggle}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
            >
              {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              <span>{theme === 'dark' ? copy.lightMode : copy.darkMode}</span>
            </button>
            <button type="button" onClick={toggleLang}
              className="flex items-center gap-2 px-3 py-2 bg-white/80 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-lg transition-colors backdrop-blur-sm"
            >
              <Languages className="w-4 h-4" />
              <span>{lang === 'en' ? 'AR' : 'EN'}</span>
            </button>
          </div>
        </div>
      </section>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={BookOpen} 
          label={copy.activeCourses} 
          value={coursesLoading ? '—' : courses.length} 
          accent="indigo"
        />
        <StatCard 
          icon={Flame} 
          label={copy.dayStreak} 
          value={dayStreak} 
          accent="orange"
          suffix={dayStreak === 1 ? ' day' : ' days'}
        />
        <StatCard 
          icon={BrainCircuit} 
          label={copy.aiInteractions} 
          value={aiInteractions} 
          accent="emerald"
        />
      </div>

      {/* ── Courses Section ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-1 h-6 rounded-full bg-indigo-500" />
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{copy.yourCourses}</h2>
            {!coursesLoading && courses.length > 0 && (
              <span className="text-xs font-medium text-slate-600 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-transparent">
                {courses.length} {courses.length === 1 ? 'course' : 'courses'}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isLocalAccount ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400 text-sm font-medium rounded-lg">
                <ShieldCheck className="w-4 h-4" />
                Local account only
              </div>
            ) : (
              <button 
                onClick={runSync} 
                disabled={syncing}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                <CloudSync className={`w-4 h-4 ${syncing ? 'animate-pulse' : ''}`} />
                {syncing ? copy.syncing : copy.syncClassroom}
              </button>
            )}
            <button 
              onClick={fetchCourses}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${coursesLoading ? 'animate-spin text-indigo-500 dark:text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {coursesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-36 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-xl border border-slate-300 dark:border-slate-700" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 border-dashed rounded-xl text-center">
            <div className="w-14 h-14 bg-slate-200 dark:bg-slate-700 rounded-2xl flex items-center justify-center mb-4">
              <Inbox className="w-7 h-7 text-slate-500 dark:text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-1">{copy.noCoursesTitle}</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 max-w-sm">
              {isLocalAccount
                ? 'This account was created locally, so Google Classroom sync is disabled. Create a course manually and use the AI tools with text or PDF uploads.'
                : copy.noCoursesBody}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {courses.map((course) => (
              <CourseCard key={course.id} course={course} />
            ))}
          </div>
        )}
      </section>

      {/* ── Automation Modal ── */}
      {automationModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 dark:bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-6 shadow-2xl">
            <h2 className="text-xl font-semibold text-slate-900 dark:text-white mb-2">{t('automationModalTitle')}</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">{t('automationModalBody')}</p>
            <CourseAutomationSelector
              courses={courses}
              selectedCourseIds={automationSelection}
              onChange={setAutomationSelection}
            />
            <div className="mt-6 flex items-center justify-end">
              <button
                type="button"
                onClick={handleSaveAutomation}
                disabled={!automationCanSave}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('automationModalCta')}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────

const ACCENT_MAP = {
  indigo:  { bg: 'rgba(99,102,241,0.12)',  ring: 'rgba(99,102,241,0.25)',  text: '#6366f1', darkText: '#a5b4fc', glow: 'rgba(99,102,241,0.08)' },
  orange:  { bg: 'rgba(249,115,22,0.12)',  ring: 'rgba(249,115,22,0.25)',  text: '#ea580c', darkText: '#fdba74', glow: 'rgba(249,115,22,0.08)' },
  emerald: { bg: 'rgba(16,185,129,0.12)',  ring: 'rgba(16,185,129,0.25)',  text: '#059669', darkText: '#6ee7b7', glow: 'rgba(16,185,129,0.08)' },
};

function StatCard({ icon: Icon, label, value, accent, suffix = '' }) {
  const c = ACCENT_MAP[accent] || ACCENT_MAP.indigo;
  return (
    <div
      className="relative group bg-white dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 overflow-hidden hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 cursor-default"
      style={{ boxShadow: `0 0 40px ${c.glow}` }}
    >
      {/* Corner glow on hover */}
      <div
        className="absolute -top-8 -right-8 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-2xl pointer-events-none"
        style={{ background: c.ring }}
      />
      <div className="relative flex items-center gap-4">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{ background: c.bg, boxShadow: `0 0 0 1px ${c.ring}` }}
        >
          <Icon className="w-6 h-6" style={{ color: c.text }} className="dark:hidden" />
          <Icon className="w-6 h-6 hidden dark:block" style={{ color: c.darkText }} />
        </div>
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
          <p className="text-3xl font-bold text-slate-900 dark:text-white tabular-nums">
            {value}
            <span className="text-sm font-medium text-slate-500">{suffix}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

function CourseCard({ course }) {
  const navigate = useNavigate();
  const gradients = [
    'linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%)',
    'linear-gradient(135deg, #7c3aed 0%, #a78bfa 100%)',
    'linear-gradient(135deg, #0ea5e9 0%, #38bdf8 100%)',
    'linear-gradient(135deg, #10b981 0%, #34d399 100%)',
    'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    'linear-gradient(135deg, #f43f5e 0%, #fb7185 100%)',
  ];
  const gradient = gradients[course.id % gradients.length];

  return (
    <div 
      onClick={() => navigate('/courses')}
      className="group relative bg-white dark:bg-slate-900/80 rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm hover:shadow-xl hover:border-slate-300 dark:hover:border-slate-700 transition-all duration-300 cursor-pointer"
    >
      {/* Gradient accent bar at top */}
      <div className="h-1.5 w-full" style={{ background: gradient }} />
      <div className="p-5 flex flex-col justify-between min-h-[130px]">
        <div className="flex items-start justify-between gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center text-white shadow-md"
            style={{ background: gradient }}
          >
            <BookOpen className="w-5 h-5" />
          </div>
          <div className="opacity-0 group-hover:opacity-100 transition-opacity">
            <span className="text-xs font-medium text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-2 py-1 rounded-full border border-indigo-100 dark:border-transparent">
              View →
            </span>
          </div>
        </div>
        <h3 className="font-semibold text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-300 transition-colors line-clamp-2 mt-3 text-sm leading-snug">
          {course.title}
        </h3>
      </div>
    </div>
  );
}
