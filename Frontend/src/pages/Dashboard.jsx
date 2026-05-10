import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { useLanguage } from '../contexts/LanguageContext';
import { getStats } from '../lib/activity';
import { 
  BookOpen, Flame, RefreshCw, CloudSync, 
  Bot, FileText, BrainCircuit, PenTool, Inbox,
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

export default function Dashboard() {
  const { user } = useAuth();
  const { theme, toggle } = useTheme();
  const { lang, toggleLang, copy } = useLanguage();
  const navigate = useNavigate();
  const isLocalAccount = user?.auth_provider === 'local';

  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [streak, setStreak] = useState(1);
  const [stats, setStats] = useState(() => getStats());

  const SYNC_COOLDOWN_MS = 5 * 60 * 1000;

  useEffect(() => {
    if (!user) {
      navigate('/');
      return;
    }
    setStreak(computeStreak(user.id));
    setStats(getStats());
    if (isLocalAccount) {
      fetchCourses();
      return;
    }
    autoSync();
  }, [user, isLocalAccount]);

  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        setStats(getStats());
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);


  async function autoSync() {
    const lastSync = parseInt(localStorage.getItem('last_sync_ts') || '0', 10);
    if (Date.now() - lastSync < SYNC_COOLDOWN_MS) {
      await fetchCourses();
      return;
    }
    await runSync();
  }

  async function runSync() {
    setSyncing(true);
    try {
      await axios.post(`/api/sync/full-sync?user_id=${user.id}`, null, {
        headers: { Authorization: `Bearer ${user.token}` },
      });
    } catch (err) {
      console.warn('Sync failed:', err?.response?.data?.detail || err.message);
    } finally {
      
      localStorage.setItem('last_sync_ts', String(Date.now()));
      setSyncing(false);
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

  const initials = user?.name
    ? user.name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  const hour = new Date().getHours();
  const greeting = getGreeting(hour, copy);
  const dateLocale = copy.dateLocale || 'en-US';
  const aiInteractions = stats.summaries + stats.quizzesGenerated + stats.quizzesTaken + stats.chats;

  return (
    <div className="flex flex-col gap-8 w-full max-w-6xl mx-auto animate-in fade-in duration-500">
      
      {/* ── Header ── */}
      <header className="flex items-center justify-between gap-4">
        <div className="flex flex-col gap-1">
          {/* Changed text-slate-900 to text-white so it shows on dark background */}
          <h1 className="text-3xl font-bold tracking-tight text-white">
            {greeting}, {user?.name?.split(' ')[0] || copy.greetingFallback}
          </h1>
          {/* Changed to text-slate-400 for a softer subtitle */}
          <p className="text-sm text-slate-400 font-medium">
            {new Date().toLocaleDateString(dateLocale, {
              weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
            })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggle}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            aria-label={theme === 'dark' ? copy.lightMode : copy.darkMode}
          >
            {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            <span>{theme === 'dark' ? copy.lightMode : copy.darkMode}</span>
          </button>
          <button
            type="button"
            onClick={toggleLang}
            className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-lg transition-colors"
            aria-label={copy.language}
          >
            <Languages className="w-4 h-4" />
            <span>{lang === 'en' ? 'AR' : 'EN'}</span>
          </button>
          <div className="h-12 w-12 rounded-full bg-indigo-500/20 text-indigo-300 flex items-center justify-center text-lg font-bold shadow-sm border border-indigo-500/30">
            {initials}
          </div>
        </div>
      </header>

      {/* ── Top Stats Row ── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          icon={BookOpen} 
          label={copy.activeCourses} 
          value={coursesLoading ? '—' : courses.length} 
          colorClass="bg-blue-500/20 text-blue-400" 
        />
        <StatCard 
          icon={Flame} 
          label={copy.dayStreak} 
          value={streak} 
          colorClass="bg-orange-500/20 text-orange-400" 
        />
        <StatCard 
          icon={BrainCircuit} 
          label={copy.aiInteractions} 
          value={aiInteractions} 
          colorClass="bg-emerald-500/20 text-emerald-400" 
        />
      </div>

      {/* ── Courses Section ── */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          {/* Section titles updated to white */}
          <h2 className="text-xl font-bold text-white">{copy.yourCourses}</h2>
          <div className="flex gap-2">
            {isLocalAccount ? (
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 border border-slate-700 text-slate-400 text-sm font-medium rounded-lg">
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
              className="flex items-center gap-2 px-3 py-2 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${coursesLoading ? 'animate-spin text-indigo-400' : ''}`} />
            </button>
          </div>
        </div>

        {coursesLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-800 animate-pulse rounded-xl border border-slate-700" />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 bg-slate-800/50 border border-slate-700 border-dashed rounded-xl text-center">
            <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mb-4">
              <Inbox className="w-6 h-6 text-slate-400" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-1">{copy.noCoursesTitle}</h3>
            <p className="text-sm text-slate-400 max-w-sm">
              {isLocalAccount
                ? 'This account was created locally, so Google Classroom sync is disabled. Create a course manually and upload documents to use the study tools.'
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

      {/* ── Quick Actions Section ── */}
      <section className="flex flex-col gap-4">
        <h2 className="text-xl font-bold text-white">{copy.quickActions}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <ActionCard icon={Bot} title={copy.askAi} desc={copy.askAiDesc} onClick={() => navigate('/chat')} />
          <ActionCard icon={FileText} title={copy.summarize} desc={copy.summarizeDesc} onClick={() => navigate('/summarizer')} />
          <ActionCard icon={BrainCircuit} title={copy.takeQuiz} desc={copy.takeQuizDesc} onClick={() => navigate('/quiz?tab=take')} />
          <ActionCard icon={PenTool} title={copy.gradeEssay} desc={copy.gradeEssayDesc} onClick={() => navigate('/essay-grader')} />
        </div>
      </section>

    </div>
  );
}

// ─── Subcomponents ──────────────────────────────────────────────

function StatCard({ icon: Icon, label, value, colorClass }) {
  return (
    // Changed bg-white to bg-slate-800 and borders to slate-700
    <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-sm flex items-center gap-4">
      <div className={`p-3 rounded-lg ${colorClass}`}>
        <Icon className="w-6 h-6" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-white">{value}</p>
      </div>
    </div>
  );
}

function CourseCard({ course }) {
  const navigate = useNavigate();
  const colors = ['bg-indigo-500', 'bg-violet-500', 'bg-cyan-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500'];
  const colorClass = colors[course.id % colors.length];

  return (
    <div 
      onClick={() => navigate('/courses')}
      className="group bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm hover:shadow-md hover:border-indigo-500 transition-all cursor-pointer flex flex-col justify-between min-h-[140px]"
    >
      <div>
        <div className="flex items-start justify-between mb-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${colorClass}`}>
            <BookOpen className="w-5 h-5" />
          </div>
          {/* Removed the ID badge completely as requested */}
        </div>
        <h3 className="font-semibold text-white group-hover:text-indigo-400 transition-colors line-clamp-2">
          {course.title}
        </h3>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, desc, onClick }) {
  return (
    <div 
      onClick={onClick} 
      className="bg-slate-800 rounded-xl border border-slate-700 p-5 shadow-sm hover:border-indigo-500 hover:shadow-md cursor-pointer transition-all flex flex-col gap-3 group"
    >
      <div className="w-10 h-10 rounded-full bg-slate-700 border border-slate-600 flex items-center justify-center text-slate-300 group-hover:text-indigo-400 group-hover:bg-indigo-500/20 transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h3 className="font-semibold text-white text-sm mb-1">{title}</h3>
        <p className="text-xs text-slate-400 leading-relaxed">{desc}</p>
      </div>
    </div>
  );
}