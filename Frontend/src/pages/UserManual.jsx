import { useMemo, useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import {
  Home, Library, Bot, Timer, Gamepad2, BookOpen, User,
  FileText, BrainCircuit, PenTool, MessageSquare, BarChart2,
  ChevronDown, ChevronRight, GraduationCap, Zap, Lock,
  CloudUpload, Download, Eye, Search, RefreshCw, Flame,
} from 'lucide-react';
import './UserManual.css';

// ─── Section data ────────────────────────────────────────────────

const getSections = (t) => [
  {
    id: 'overview',
    icon: GraduationCap,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    title: t('userManualOverviewTitle'),
    subtitle: t('userManualOverviewSubtitle'),
    content: (
      <div className="um-prose">
        <p>
          <strong>Squee Learn</strong> {t('userManualOverviewBody')}
        </p>
        <div className="um-highlights">
          <div className="um-highlight-item">
            <Zap size={16} />
            <span><strong>{t('userManualOverviewHighlightAgentsLabel')}</strong> - {t('userManualOverviewHighlightAgentsBody')}</span>
          </div>
          <div className="um-highlight-item">
            <RefreshCw size={16} />
            <span><strong>{t('userManualOverviewHighlightSyncLabel')}</strong> - {t('userManualOverviewHighlightSyncBody')}</span>
          </div>
          <div className="um-highlight-item">
            <Timer size={16} />
            <span><strong>{t('userManualOverviewHighlightFocusLabel')}</strong> - {t('userManualOverviewHighlightFocusBody')}</span>
          </div>
          <div className="um-highlight-item">
            <Flame size={16} />
            <span><strong>{t('userManualOverviewHighlightProgressLabel')}</strong> - {t('userManualOverviewHighlightProgressBody')}</span>
          </div>
        </div>
        <div className="um-tip">
          <strong>{t('userManualOverviewTipLabel')}</strong> {t('userManualOverviewTipBody')}
        </div>
      </div>
    ),
  },
  {
    id: 'dashboard',
    icon: Home,
    color: '#6366f1',
    bg: 'rgba(99,102,241,0.12)',
    title: t('userManualDashboardTitle'),
    subtitle: t('userManualDashboardSubtitle'),
    content: (
      <div className="um-prose">
        <p>
          {t('userManualDashboardBody')}
        </p>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#60a5fa' }}>
              <BookOpen size={18} />
            </div>
            <div>
              <h4>{t('activeCourses')}</h4>
              <p>{t('userManualDashboardFeatureCoursesBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(249,115,22,0.15)', color: '#fb923c' }}>
              <Flame size={18} />
            </div>
            <div>
              <h4>{t('dayStreak')}</h4>
              <p>{t('userManualDashboardFeatureStreakBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              <BrainCircuit size={18} />
            </div>
            <div>
              <h4>{t('aiInteractions')}</h4>
              <p>{t('userManualDashboardFeatureInteractionsBody')}</p>
            </div>
          </div>
        </div>
        <h4 className="um-subheading">{t('quickActions')}</h4>
        <p>{t('userManualDashboardQuickActionsIntro')}</p>
        <ul>
          <li><strong>{t('askAi')}</strong> - {t('userManualDashboardQuickActionChat')}</li>
          <li><strong>{t('summarize')}</strong> - {t('userManualDashboardQuickActionSummarize')}</li>
          <li><strong>{t('takeQuiz')}</strong> - {t('userManualDashboardQuickActionTakeQuiz')}</li>
          <li><strong>{t('gradeEssay')}</strong> - {t('userManualDashboardQuickActionGradeEssay')}</li>
        </ul>
        <h4 className="um-subheading">{t('userManualDashboardSyncTitle')}</h4>
        <p>{t('userManualDashboardSyncBody')}</p>
        <div className="um-tip">{t('userManualDashboardSyncTip')}</div>
      </div>
    ),
  },
  {
    id: 'courses',
    icon: Library,
    color: '#0ea5e9',
    bg: 'rgba(14,165,233,0.12)',
    title: t('userManualCoursesTitle'),
    subtitle: t('userManualCoursesSubtitle'),
    content: (
      <div className="um-prose">
        <p>
          {t('userManualCoursesBody')}
        </p>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Search size={18} />
            </div>
            <div>
              <h4>{t('userManualCoursesSearchTitle')}</h4>
              <p>{t('userManualCoursesSearchBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Eye size={18} />
            </div>
            <div>
              <h4>{t('userManualCoursesPreviewTitle')}</h4>
              <p>{t('userManualCoursesPreviewBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(14,165,233,0.15)', color: '#38bdf8' }}>
              <Download size={18} />
            </div>
            <div>
              <h4>{t('userManualCoursesDownloadTitle')}</h4>
              <p>{t('userManualCoursesDownloadBody')}</p>
            </div>
          </div>
        </div>
        <h4 className="um-subheading">{t('userManualCoursesDocTypesTitle')}</h4>
        <ul>
          <li><strong>{t('userManualCoursesDocTypeMaterialLabel')}</strong> - {t('userManualCoursesDocTypeMaterialBody')}</li>
          <li><strong>{t('userManualCoursesDocTypeAnnouncementLabel')}</strong> - {t('userManualCoursesDocTypeAnnouncementBody')}</li>
          <li><strong>{t('userManualCoursesDocTypeManualUploadLabel')}</strong> - {t('userManualCoursesDocTypeManualUploadBody')}</li>
        </ul>
      </div>
    ),
  },
  {
    id: 'ai-agents',
    icon: Bot,
    color: '#8b5cf6',
    bg: 'rgba(139,92,246,0.12)',
    title: t('userManualAgentsTitle'),
    subtitle: t('userManualAgentsSubtitle'),
    content: (
      <div className="um-prose">
        <p>
          {t('userManualAgentsBody')}
        </p>
        <div className="um-agent-list">
          {[
            { color: '#fb923c', label: t('aiEssayTitle'), desc: t('userManualAgentsEssayDesc') },
            { color: '#a78bfa', label: t('aiEvaluatorTitle'), desc: t('userManualAgentsEvaluatorDesc') },
            { color: '#2dd4bf', label: t('aiSummarizerTitle'), desc: t('userManualAgentsSummarizerDesc') },
            { color: '#60a5fa', label: t('aiChatTitle'), desc: t('userManualAgentsChatDesc') },
            { color: '#f472b6', label: t('aiQuizTitle'), desc: t('userManualAgentsQuizDesc') },
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
    title: t('aiSummarizerTitle'),
    subtitle: t('userManualSummarizerSubtitle'),
    content: (
      <div className="um-prose">
        <p>
          {t('userManualSummarizerBody')}
        </p>
        <h4 className="um-subheading">{t('userManualSummarizerInputTitle')}</h4>
        <ul>
          <li><strong>{t('userManualSummarizerInputPasteLabel')}</strong> - {t('userManualSummarizerInputPasteBody')}</li>
          <li><strong>{t('userManualSummarizerInputChooseLabel')}</strong> - {t('userManualSummarizerInputChooseBody')}</li>
          <li><strong>{t('userManualSummarizerInputUploadLabel')}</strong> - {t('userManualSummarizerInputUploadBody')}</li>
        </ul>
        <h4 className="um-subheading">{t('userManualSummarizerAutoTitle')}</h4>
        <p>{t('userManualSummarizerAutoBody')}</p>
      </div>
    ),
  },
  {
    id: 'quiz',
    icon: BrainCircuit,
    color: '#ec4899',
    bg: 'rgba(236,72,153,0.12)',
    title: t('aiQuizTitle'),
    subtitle: t('userManualQuizSubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualQuizBody')}</p>
        <h4 className="um-subheading">{t('userManualQuizGenerateTitle')}</h4>
        <ul>
          <li>{t('userManualQuizGenerateItem1')}</li>
          <li>{t('userManualQuizGenerateItem2')}</li>
          <li>{t('userManualQuizGenerateItem3')}</li>
          <li>{t('userManualQuizGenerateItem4')}</li>
        </ul>
        <h4 className="um-subheading">{t('userManualQuizTakeTitle')}</h4>
        <ul>
          <li>{t('userManualQuizTakeItem1')}</li>
          <li>{t('userManualQuizTakeItem2')}</li>
          <li>{t('userManualQuizTakeItem3')}</li>
        </ul>
        <div className="um-tip">{t('userManualQuizTip')}</div>
      </div>
    ),
  },
  {
    id: 'chat',
    icon: MessageSquare,
    color: '#3b82f6',
    bg: 'rgba(59,130,246,0.12)',
    title: t('aiChatTitle'),
    subtitle: t('userManualChatSubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualChatBody')}</p>
        <h4 className="um-subheading">{t('userManualChatHowTitle')}</h4>
        <ul>
          <li>{t('userManualChatHowItem1')}</li>
          <li>{t('userManualChatHowItem2')}</li>
          <li>{t('userManualChatHowItem3')}</li>
          <li>{t('userManualChatHowItem4')}</li>
        </ul>

      </div>
    ),
  },
  {
    id: 'evaluator',
    icon: BarChart2,
    color: '#7c3aed',
    bg: 'rgba(124,58,237,0.12)',
    title: t('aiEvaluatorTitle'),
    subtitle: t('userManualEvaluatorSubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualEvaluatorBody')}</p>
        <div className="um-metric-grid">
          {[
            { icon: '✅', label: t('userManualEvaluatorMetricCorrectness'), desc: t('userManualEvaluatorMetricCorrectnessDesc') },
            { icon: '🎯', label: t('userManualEvaluatorMetricRelevance'), desc: t('userManualEvaluatorMetricRelevanceDesc') },
            { icon: '🔗', label: t('userManualEvaluatorMetricCoherence'), desc: t('userManualEvaluatorMetricCoherenceDesc') },
            { icon: '📋', label: t('userManualEvaluatorMetricCompleteness'), desc: t('userManualEvaluatorMetricCompletenessDesc') },
            { icon: '✂️', label: t('userManualEvaluatorMetricConciseness'), desc: t('userManualEvaluatorMetricConcisenessDesc') },
            { icon: '📖', label: t('userManualEvaluatorMetricTerminology'), desc: t('userManualEvaluatorMetricTerminologyDesc') },
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
        <h4 className="um-subheading">{t('userManualEvaluatorInputTitle')}</h4>
        <ul>
          <li><strong>{t('userManualEvaluatorInputLectureLabel')}</strong> - {t('userManualEvaluatorInputLectureBody')}</li>
          <li><strong>{t('userManualEvaluatorInputStudentLabel')}</strong> - {t('userManualEvaluatorInputStudentBody')}</li>
        </ul>
        <p>{t('userManualEvaluatorResults')}</p>
      </div>
    ),
  },
  {
    id: 'essay-grader',
    icon: PenTool,
    color: '#f97316',
    bg: 'rgba(249,115,22,0.12)',
    title: t('aiEssayTitle'),
    subtitle: t('userManualEssaySubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualEssayBody')}</p>
        <h4 className="um-subheading">{t('userManualEssayWorkflowTitle')}</h4>
        <ul>
          <li>{t('userManualEssayWorkflowItem1')}</li>
          <li>{t('userManualEssayWorkflowItem2')}</li>
          <li>{t('userManualEssayWorkflowItem3')}</li>
        </ul>
        <h4 className="um-subheading">{t('userManualEssayResultTitle')}</h4>
        <ul>
          <li><strong>{t('userManualEssayResultItem1Label')}</strong> - {t('userManualEssayResultItem1Body')}</li>
          <li><strong>{t('userManualEssayResultItem2Label')}</strong> - {t('userManualEssayResultItem2Body')}</li>
          <li><strong>{t('userManualEssayResultItem3Label')}</strong> - {t('userManualEssayResultItem3Body')}</li>
        </ul>
        <div className="um-tip">{t('userManualEssayTip')}</div>
      </div>
    ),
  },
  {
    id: 'pomodoro',
    icon: Timer,
    color: '#f59e0b',
    bg: 'rgba(245,158,11,0.12)',
    title: t('userManualPomodoroTitle'),
    subtitle: t('userManualPomodoroSubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualPomodoroBody')}</p>
        <h4 className="um-subheading">{t('userManualPomodoroControlsTitle')}</h4>
        <ul>
          <li><strong>{t('userManualPomodoroControlStartPauseLabel')}</strong> - {t('userManualPomodoroControlStartPauseBody')}</li>
          <li><strong>{t('userManualPomodoroControlResetLabel')}</strong> - {t('userManualPomodoroControlResetBody')}</li>
          <li><strong>{t('userManualPomodoroControlSkipLabel')}</strong> - {t('userManualPomodoroControlSkipBody')}</li>
          <li><strong>{t('userManualPomodoroControlAutoLabel')}</strong> - {t('userManualPomodoroControlAutoBody')}</li>
        </ul>
        <h4 className="um-subheading">{t('userManualPomodoroSettingsTitle')}</h4>
        <p>{t('userManualPomodoroSettingsBody')}</p>
        <h4 className="um-subheading">{t('userManualPomodoroProgressTitle')}</h4>
        <p>{t('userManualPomodoroProgressBody')}</p>
        <div className="um-tip">{t('userManualPomodoroTip')}</div>
      </div>
    ),
  },
  {
    id: 'mini-games',
    icon: Gamepad2,
    color: '#22c55e',
    bg: 'rgba(34,197,94,0.12)',
    title: t('navMiniGames'),
    subtitle: t('userManualMiniGamesSubtitle'),
    content: (
      <div className="um-prose">
        <div className="um-locked-notice">
          <Lock size={16} />
          <span>
            {t('userManualMiniGamesLockNotice')}
          </span>
        </div>
        <h4 className="um-subheading">{t('userManualMiniGamesAvailableTitle')}</h4>
        <div className="um-feature-grid">
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              🧩
            </div>
            <div>
              <h4>{t('userManualMiniGamesPuzzleTitle')}</h4>
              <p>{t('userManualMiniGamesPuzzleBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              🃏
            </div>
            <div>
              <h4>{t('userManualMiniGamesMemoryTitle')}</h4>
              <p>{t('userManualMiniGamesMemoryBody')}</p>
            </div>
          </div>
          <div className="um-feature-card">
            <div className="um-feature-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#4ade80' }}>
              ⚡
            </div>
            <div>
              <h4>{t('userManualMiniGamesReactionTitle')}</h4>
              <p>{t('userManualMiniGamesReactionBody')}</p>
            </div>
          </div>
        </div>
        <p>{t('userManualMiniGamesOutro')}</p>
      </div>
    ),
  },
  {
    id: 'profile',
    icon: User,
    color: '#94a3b8',
    bg: 'rgba(148,163,184,0.12)',
    title: t('navProfile'),
    subtitle: t('userManualProfileSubtitle'),
    content: (
      <div className="um-prose">
        <p>{t('userManualProfileBody')}</p>
        <h4 className="um-subheading">{t('userManualProfileFindTitle')}</h4>
        <ul>
          <li>{t('userManualProfileFindItem1')}</li>
          <li>{t('userManualProfileFindItem2')}</li>
          <li>{t('userManualProfileFindItem3')}</li>
          <li>{t('userManualProfileFindItem4')}</li>
        </ul>
      </div>
    ),
  },
];

// ─── Component ───────────────────────────────────────────────────

export default function UserManual() {
  const { t } = useLanguage();
  const [openId, setOpenId] = useState('overview');
  const sections = useMemo(() => getSections(t), [t]);

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
          <p className="um-kicker">{t('userManualHeroKicker')}</p>
          <h1 className="um-title">{t('userManualHeroTitle')}</h1>
          <p className="um-lead">
            {t('userManualHeroLead')}
          </p>
        </div>
      </section>

      {/* Nav pills */}
      <div className="um-pills">
        {sections.map((s) => {
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
      {Array.from({ length: Math.ceil(sections.length / 3) }, (_, rowIdx) => {
        const row = sections.slice(rowIdx * 3, rowIdx * 3 + 3);
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
