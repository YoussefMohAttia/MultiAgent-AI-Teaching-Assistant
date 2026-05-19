import { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Home, Library, Bot, Timer, Gamepad2, BookOpen, User,
  FileText, BrainCircuit, PenTool, MessageSquare, BarChart2,
  ChevronDown, ChevronRight, GraduationCap, Zap, Lock,
  CloudUpload, Download, Eye, Search, RefreshCw, Flame,
} from 'lucide-react';
import './UserManual.css';

// ─── Section data ────────────────────────────────────────────────

const SECTIONS = [
  {
    id: 'overview',
    icon: GraduationCap,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    title: 'Platform Overview',
    subtitle: 'What Squee Learn is and how it helps you',
    content: (
      <div className="um-prose">
        <p>
          <strong>Squee Learn</strong> is a multi-agent AI teaching assistant designed to help students
          study smarter. It connects directly to your <strong>Google Classroom</strong> to sync your
          courses and documents automatically, then provides a suite of AI-powered tools that work
          on your actual course material — no manual copy-pasting required.
        </p>
        <div className="um-highlights">
          <div className="um-highlight-item">
            <Zap size={16} />
            <span><strong>5 AI agents</strong> — summariser, quiz generator, chat tutor, evaluator, essay grader</span>
          </div>
          <div className="um-highlight-item">
            <RefreshCw size={16} />
            <span><strong>Auto-sync</strong> — your Google Classroom courses and PDFs sync on every login</span>
          </div>
          <div className="um-highlight-item">
            <Timer size={16} />
            <span><strong>Focus tools</strong> — a Pomodoro timer that unlocks mini-games during breaks</span>
          </div>
          <div className="um-highlight-item">
            <Flame size={16} />
            <span><strong>Progress tracking</strong> — day streak, AI interaction count, and per-session stats</span>
          </div>
        </div>
        <div className="um-tip">
          <strong>Two account types:</strong> Sign in with Google to get Classroom sync, or create a
          local account and upload PDFs manually in any AI tool. Both types have full access to all
          AI features.
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: Home,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    title: 'Dashboard',
    subtitle: 'Your home base — stats, courses, quick actions',
    content: (
      <div className="um-prose">
        <p>
          The Dashboard is the first page you see after signing in. It shows you your study snapshot
          at a glance and provides one-click navigation to every major tool.
        </p>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h4>Active Courses</h4>
              <p>Live count of courses synced from your Classroom account.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
              <Flame size={18} />
            </div>
            <div>
              <h4>Day Streak</h4>
              <p>Tracks consecutive days you've logged in and studied.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              <BrainCircuit size={18} />
            </div>
            <div>
              <h4>AI Interactions</h4>
              <p>Total count of summaries, quizzes, chats, and evaluations you've run.</p>
            </div>
          </div>
        </div>
        <h4 className="um-subheading">Quick Actions</h4>
        <p>Four shortcut cards at the bottom let you jump directly into:</p>
        <ul>
          <li><strong>Ask AI</strong> → Chat page</li>
          <li><strong>Summarize</strong> → Summariser page</li>
          <li><strong>Take Quiz</strong> → Quiz Generator (take tab)</li>
          <li><strong>Grade Essay</strong> → Essay Grader</li>
        </ul>
        <h4 className="um-subheading">Google Classroom Sync</h4>
        <p>
          If you signed in with Google, the dashboard automatically syncs your courses on load
          (with a 5-minute cooldown to avoid hammering the API). You can also trigger a manual
          sync with the <strong>Sync Classroom</strong> button. New documents get auto-summarised
          and auto-quizzed in the background — you'll receive a toast notification when they're ready.
        </p>
        <div className="um-tip">
          On first login, a modal will ask which courses you want auto-processed. You can change
          these preferences at any time by clicking <strong>Sync Classroom</strong>.
        </div>
      </div>
    ),
  },
  {
    id: 'courses',
    icon: Library,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.12)',
    title: 'Courses',
    subtitle: 'Browse your synced materials and download PDFs',
    content: (
      <div className="um-prose">
        <p>
          The Courses page is a master-detail file browser for all your synced course materials.
          Select a course on the left to see all its documents on the right.
        </p>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Search size={18} />
            </div>
            <div>
              <h4>Course Search</h4>
              <p>Filter your courses in real-time by title using the search bar.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Eye size={18} />
            </div>
            <div>
              <h4>Preview</h4>
              <p>View PDFs inside a full-screen.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Download size={18} />
            </div>
            <div>
              <h4>Secure Download</h4>
              <p>Download PDFs directly. Google Drive files are resolved automatically.</p>
            </div>
          </div>
        </div>
        <h4 className="um-subheading">Document Types</h4>
        <ul>
          <li><strong>Material / Coursework</strong> — PDFs with Preview & Download buttons</li>
          <li><strong>Announcement / Post</strong> — Text-only items showing their body content</li>
          <li><strong>Manual Upload</strong> — Files you've uploaded yourself through any AI tool</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'ai-agents',
    icon: Bot,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
    title: 'AI Agents Hub',
    subtitle: 'The central launchpad for all five AI tools',
    content: (
      <div className="um-prose">
        <p>
          The AI Agents page is an interactive orbital UI showing all five AI tools arranged
          around a central brain icon. Click any node to launch that tool with a ripple animation.
          Hover over a node to read a brief description of what it does before clicking.
        </p>
        <div className="um-agent-list">
          {[
            { color: '#fb923c', label: 'Essay Grader', desc: 'Predicts an IELTS band score (0–9) for any essay.' },
            { color: '#a78bfa', label: 'Evaluator', desc: 'Scores a student summary against lecture material on 6 metrics.' },
            { color: '#2dd4bf', label: 'Summariser', desc: 'Generates a structured AI summary of any document or pasted text.' },
            { color: '#60a5fa', label: 'AI Tutor Chat', desc: 'Ask questions about your course material in a conversational interface.' },
            { color: '#f472b6', label: 'Quiz Generator', desc: 'Generates and lets you take MCQ/True-False quizzes from course material.' },
          ].map((a) => (
            <div key={a.label} className="um-agent-row">
              <div className="um-agent-dot" style={{ background: a.color }} />
              <div>
                <strong>{a.label}</strong>
                <span>{a.desc}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: 'summarizer',
    icon: FileText,
    color: '#14b8a6',
    bg: 'rgba(20,184,166,0.12)',
    title: 'Summarizer',
    subtitle: 'AI-generated summaries of your lecture material',
    content: (
      <div className="um-prose">
        <p>
          Paste lecture text, or pick a document from one of your synced courses, and the AI
          will return a clean structured summary broken into key topics.
        </p>
        <h4 className="um-subheading">Input Options</h4>
        <ul>
          <li><strong>Paste Text</strong> — Paste lecture notes or any text directly</li>
          <li><strong>Choose Document</strong> — Select a course, then pick a synced PDF</li>
          <li><strong>Upload PDF</strong> — Upload a file from your device</li>
        </ul>
        <h4 className="um-subheading">Auto-Summarize on Sync</h4>
        <p>
          When the Dashboard syncs new materials, the system can automatically queue summaries
          in the background for any course you've opted in. A toast appears when they're ready
          and you can find them under the relevant document in your Courses page.
        </p>
      </div>
    ),
  },
  {
    id: 'quiz',
    icon: BrainCircuit,
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    title: 'Quiz Generator',
    subtitle: 'Generate and take quizzes from your course material',
    content: (
      <div className="um-prose">
        <p>
          The Quiz Generator has two tabs: <strong>Generate</strong> and <strong>Take Quiz</strong>.
        </p>
        <h4 className="um-subheading">Generate Tab</h4>
        <ul>
          <li>Choose a course and document, or paste text / upload a PDF</li>
          <li>Select question type: MCQ (multiple choice) or True/False</li>
          <li>Set the number of questions you want generated</li>
          <li>Click Generate — the AI creates a quiz stored under that document</li>
        </ul>
        <h4 className="um-subheading">Take Quiz Tab</h4>
        <ul>
          <li>Browse all previously generated quizzes by course and document</li>
          <li>Answer each question and submit to see your score and correct answers</li>
          <li>Your quiz-taking count is tracked in the Dashboard AI Interactions stat</li>
        </ul>
        <div className="um-tip">
          Quizzes can also be auto-generated during Classroom sync for opted-in courses.
        </div>
      </div>
    ),
  },
  {
    id: 'chat',
    icon: MessageSquare,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    title: 'AI Tutor Chat',
    subtitle: 'Conversational AI grounded in your course material',
    content: (
      <div className="um-prose">
        <p>
          The Chat page gives you a real-time conversation with an AI tutor that has context about
          your selected course material. Ask it to explain concepts, quiz you verbally, or
          clarify anything confusing from your lectures.
        </p>
        <h4 className="um-subheading">How to use it</h4>
        <ul>
          <li>Select a course and optionally a specific document to focus the AI's context</li>
          <li>Type your question and press Enter or click Send</li>
          <li>The AI responds in Markdown — code blocks, lists, and bold text are all rendered</li>
          <li>The conversation history is preserved within the session</li>
        </ul>

      </div>
    ),
  },
  {
    id: 'evaluator',
    icon: BarChart2,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.12)',
    title: 'Evaluator',
    subtitle: 'Score a student summary against lecture material',
    content: (
      <div className="um-prose">
        <p>
          The Evaluator compares a student's summary to the original lecture material and scores
          it across <strong>6 dimensions</strong>, each out of 10.
        </p>
        <div className="um-metric-grid">
          {[
            { icon: '✅', label: 'Correctness', desc: 'Are the facts accurate?' },
            { icon: '🎯', label: 'Relevance', desc: 'Does it stick to what matters?' },
            { icon: '🔗', label: 'Coherence', desc: 'Does it flow logically?' },
            { icon: '📋', label: 'Completeness', desc: 'Are key points covered?' },
            { icon: '✂️', label: 'Conciseness', desc: 'Is it appropriately brief?' },
            { icon: '📖', label: 'Terminology', desc: 'Is domain vocabulary used correctly?' },
          ].map((m) => (
            <div key={m.label} className="um-metric-card">
              <span>{m.icon}</span>
              <div>
                <strong>{m.label}</strong>
                <p>{m.desc}</p>
              </div>
            </div>
          ))}
        </div>
        <h4 className="um-subheading">Input Options</h4>
        <ul>
          <li><strong>Lecture source</strong> — paste text, or pick a synced document from a course</li>
          <li><strong>Student summary</strong> — type it in or upload a PDF</li>
        </ul>
        <p>
          Results show an overall score, word counts for both texts, a metric breakdown table
          with visual progress bars, and optional technical detail mode.
        </p>
      </div>
    ),
  },
  {
    id: 'essay-grader',
    icon: PenTool,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    title: 'Essay Grader',
    subtitle: 'IELTS band prediction for student essays',
    content: (
      <div className="um-prose">
        <p>
          The Essay Grader uses AI to predict an IELTS writing band score (0–9) for any essay.
          Optionally provide the exam question for a more accurate evaluation.
        </p>
        <h4 className="um-subheading">Workflow</h4>
        <ul>
          <li>Paste the essay question in the left panel (optional but recommended)</li>
          <li>Either type/paste the essay text, or switch to PDF upload mode</li>
          <li>Click <strong>Predict Band</strong> — results appear in seconds</li>
        </ul>
        <h4 className="um-subheading">Result</h4>
        <ul>
          <li><strong>Predicted Band</strong> — shown as a large score out of 9 (colour-coded green/amber/red)</li>
          <li><strong>Objective</strong> — the grading objective the AI used to evaluate</li>
          <li><strong>Response time</strong> — shown as a badge so you know how long the AI took</li>
        </ul>
        <div className="um-tip">
          Band 7.5+ is shown in green, 5.5–7.4 in amber, and below 5.5 in red.
        </div>
      </div>
    ),
  },
  {
    id: 'pomodoro',
    icon: Timer,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    title: 'Pomodoro Timer',
    subtitle: 'Focus sessions with automatic break tracking',
    content: (
      <div className="um-prose">
        <p>
          The Pomodoro timer runs <strong>persistently in the background</strong> across the whole
          app — you can switch to other pages and the timer keeps running. The sidebar shows a
          live progress ring on the Pomodoro icon when a session is active.
        </p>
        <h4 className="um-subheading">Controls</h4>
        <ul>
          <li><strong>▶ Start / ⏸ Pause</strong> — toggle the current session</li>
          <li><strong>↺ Reset</strong> — reset to the start of the current mode</li>
          <li><strong>⏭ Skip Break</strong> — visible only during break; skips to next work session</li>
          <li><strong>Auto-start next</strong> — toggle to automatically start the next session when one ends</li>
        </ul>
        <h4 className="um-subheading">Settings</h4>
        <p>
          Adjust work session length (default 25 min) and break length (default 5 min) using the
          ± controls. Changes take effect on the next session.
        </p>
        <h4 className="um-subheading">Progress & Streak Bonus</h4>
        <p>
          Completed cycles and a streak bonus are tracked per session. The bonus is added to your
          day streak score in the Dashboard stats.
        </p>
        <div className="um-tip">
          The timer is the <strong>key to unlocking Mini Games</strong>. The Mini Games tab is locked
          until the Pomodoro enters break mode.
        </div>
      </div>
    ),
  },
  {
    id: 'mini-games',
    icon: Gamepad2,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    title: 'Mini Games',
    subtitle: 'Brain breaks — only available during Pomodoro breaks',
    content: (
      <div className="um-prose">
        <div className="um-locked-notice">
          <Lock size={16} />
          <span>
            The Mini Games tab is <strong>locked</strong> in the sidebar unless the Pomodoro timer
            is currently in break mode. This is intentional — games are a reward for finishing a
            focus session.
          </span>
        </div>
        <h4 className="um-subheading">Available Games</h4>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              🧩
            </div>
            <div>
              <h4>8-Puzzle (Slide Puzzle)</h4>
              <p>Rearrange numbered tiles into order by sliding them into the empty space. Tracks move count.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              🃏
            </div>
            <div>
              <h4>Memory Match</h4>
              <p>Flip cards and find matching pairs. Uses Italian Brainrot character images. Coming soon.</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              ⚡
            </div>
            <div>
              <h4>Reaction Clicker</h4>
              <p>Test your reaction speed. Coming soon.</p>
            </div>
          </div>
        </div>
        <p>
          When the break ends, the Mini Games page automatically closes and you're redirected
          back to the Pomodoro page to start your next focus session.
        </p>
      </div>
    ),
  },
  {
    id: 'profile',
    icon: User,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    title: 'Profile',
    subtitle: 'Your account info and study statistics',
    content: (
      <div className="um-prose">
        <p>
          The Profile page shows your account details and an overview of your activity stats
          accumulated across all sessions.
        </p>
        <h4 className="um-subheading">What you'll find</h4>
        <ul>
          <li>Display name, email, and account type (Google or Local)</li>
          <li>Total summaries generated, quizzes created and taken, essays graded, chat sessions</li>
          <li>Current day streak and best streak</li>
          <li>Option to change display name (for local accounts)</li>
        </ul>
      </div>
    ),
  },
];

// ─── Component ───────────────────────────────────────────────────

export default function UserManual() {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState('overview');

  function toggle(id) {
    setOpenId((prev) => (prev === id ? null : id));
  }

  return (
    <div className="um-root">
      {/* Hero */}
      <section className="um-hero">
        <div className="um-hero-icon">
          <BookOpen size={28} />
        </div>
        <div>
          <p className="um-kicker">Documentation</p>
          <h1 className="um-title">User Manual</h1>
          <p className="um-lead">
            Everything you need to know about Squee Learn — from syncing your Google Classroom
            to getting the most out of each AI tool.
          </p>
        </div>
      </section>

      {/* Nav pills */}
      <div className="um-pills">
        {SECTIONS.map((s) => {
          const Icon = s.icon;
          const isOpen = openId === s.id;
          return (
            <button
              key={s.id}
              className={`um-pill ${isOpen ? 'um-pill-active' : ''}`}
              style={isOpen ? { background: s.bg, color: s.color, borderColor: s.color + '44' } : {}}
              onClick={() => toggle(s.id)}
            >
              <Icon size={14} />
              {s.title}
            </button>
          );
        })}
      </div>

      {/* Row-chunked grid: panel opens after its own row */}
      {Array.from({ length: Math.ceil(SECTIONS.length / 3) }, (_, rowIdx) => {
        const row = SECTIONS.slice(rowIdx * 3, rowIdx * 3 + 3);
        const openSection = row.find((s) => s.id === openId);
        return (
          <div key={rowIdx} className="um-row-group">
            <div className="um-accordion">
              {row.map((s) => {
                const Icon = s.icon;
                const isOpen = openId === s.id;
                return (
                  <button
                    key={s.id}
                    className={`um-section ${isOpen ? 'um-section-open' : ''}`}
                    style={isOpen ? { borderColor: s.color + '55', boxShadow: `0 0 0 1px ${s.color}22` } : {}}
                    onClick={() => toggle(s.id)}
                    aria-expanded={isOpen}
                  >
                    <div className="um-section-left">
                      <div className="um-section-icon" style={{ background: s.bg, color: s.color }}>
                        <Icon size={18} />
                      </div>
                      <div className="um-section-text">
                        <h2 className="um-section-title">{s.title}</h2>
                        <p className="um-section-sub">{s.subtitle}</p>
                      </div>
                    </div>
                    <div className="um-chevron" style={{ color: isOpen ? s.color : undefined }}>
                      {isOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                    </div>
                  </button>
                );
              })}
            </div>

            {openSection && (() => {
              const s = openSection;
              const Icon = s.icon;
              return (
                <div
                  key={s.id}
                  className="um-content-panel"
                  style={{ borderColor: s.color + '33' }}
                >
                  <div className="um-content-panel-header">
                    <div className="um-section-icon" style={{ background: s.bg, color: s.color }}>
                      <Icon size={20} />
                    </div>
                    <div>
                      <h2 className="um-content-panel-title" style={{ color: s.color }}>{s.title}</h2>
                      <p className="um-content-panel-sub">{s.subtitle}</p>
                    </div>
                  </div>
                  <div className="um-content-panel-body">
                    {s.content}
                  </div>
                </div>
              );
            })()}
          </div>
        );
      })}
    </div>
  );
}
