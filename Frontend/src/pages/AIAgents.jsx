import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Languages, Moon, Sun, MessageSquare, FileText, ClipboardCheck, PenLine, BrainCircuit, ArrowRight, Sparkles } from 'lucide-react';
import './AIAgents.css';

export default function AIAgents() {
  const navigate = useNavigate();
  const { t, toggleLang, lang } = useLanguage();
  const { theme, toggle } = useTheme();

  const agents = useMemo(
    () => [
      {
        key: 'tutor',
        label: t('aiChatTitle'),
        tip: t('aiChatContent'),
        route: '/chat',
        color: '#6366f1',
        gradient: 'linear-gradient(135deg, rgba(99,102,241,0.15) 0%, rgba(139,92,246,0.08) 100%)',
        glowColor: 'rgba(99,102,241,0.3)',
        hero: true,
        icon: <MessageSquare />,
        badge: '✨ AI Powered',
      },
      {
        key: 'summarizer',
        label: t('aiSummarizerTitle'),
        tip: t('aiSummarizerContent'),
        route: '/summarizer',
        color: '#14b8a6',
        gradient: 'linear-gradient(135deg, rgba(20,184,166,0.12) 0%, rgba(6,182,212,0.06) 100%)',
        glowColor: 'rgba(20,184,166,0.3)',
        icon: <FileText />,
      },
      {
        key: 'quiz',
        label: t('aiQuizTitle'),
        tip: t('aiQuizContent'),
        route: '/quiz',
        color: '#ec4899',
        gradient: 'linear-gradient(135deg, rgba(236,72,153,0.12) 0%, rgba(244,114,182,0.06) 100%)',
        glowColor: 'rgba(236,72,153,0.3)',
        icon: <BrainCircuit />,
      },
      {
        key: 'evaluator',
        label: t('aiEvaluatorTitle'),
        tip: t('aiEvaluatorContent'),
        route: '/evaluator',
        color: '#7c5cfc',
        gradient: 'linear-gradient(135deg, rgba(124,92,252,0.12) 0%, rgba(168,85,247,0.06) 100%)',
        glowColor: 'rgba(124,92,252,0.3)',
        icon: <ClipboardCheck />,
      },
      {
        key: 'essay-grader',
        label: t('aiEssayTitle'),
        tip: t('aiEssayContent'),
        route: '/essay-grader',
        color: '#f97316',
        gradient: 'linear-gradient(135deg, rgba(249,115,22,0.12) 0%, rgba(251,146,60,0.06) 100%)',
        glowColor: 'rgba(249,115,22,0.3)',
        icon: <PenLine />,
      },
    ],
    [t],
  );

  return (
    <div className="ai-bento">
      {/* Header */}
      <div className="ai-bento-header">
        <div className="ai-bento-header-left">
          <div className="ai-bento-header-badge">
            <Sparkles className="ai-bento-header-badge-icon" />
            <span>Multi-Agent System</span>
          </div>
          <h1>{t('navAiAgents')}</h1>
          <p>{t('aiAgentsSubtitle')}</p>
        </div>
        <div className="ai-bento-header-actions">
          <button type="button" className="ai-bento-btn" onClick={toggle}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? t('lightMode') : t('darkMode')}
          </button>
          <button type="button" className="ai-bento-btn" onClick={toggleLang}>
            <Languages />
            {lang === 'en' ? 'AR' : 'EN'}
          </button>
        </div>
      </div>

      {/* Bento Grid */}
      <div className="ai-bento-grid">
        {agents.map((agent) => (
          <button
            key={agent.key}
            type="button"
            className={`ai-bento-card ${agent.hero ? 'ai-bento-card-hero' : ''}`}
            style={{
              '--card-color': agent.color,
              '--card-gradient': agent.gradient,
              '--card-glow': agent.glowColor,
            }}
            onClick={() => navigate(agent.route)}
          >
            {/* Animated background effects */}
            <div className="ai-bento-card-bg" />
            <div className="ai-bento-card-shine" />

            {/* Content */}
            <div className="ai-bento-card-content">
              <div className="ai-bento-card-icon">
                {agent.icon}
              </div>
              <div className="ai-bento-card-text">
                <div className="ai-bento-card-title-row">
                  <h3>{agent.label}</h3>
                  {agent.badge && (
                    <span className="ai-bento-card-badge">{agent.badge}</span>
                  )}
                </div>
                <p>{agent.tip}</p>
              </div>
              <div className="ai-bento-card-arrow">
                <ArrowRight />
              </div>
            </div>

            {/* Corner decoration */}
            <div className="ai-bento-card-corner" />
          </button>
        ))}
      </div>

      {/* Hint */}
      <div className="ai-bento-hint">{t('aiAgentsHint')}</div>
    </div>
  );
}
