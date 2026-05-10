import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import { useTheme } from '../contexts/ThemeContext';
import { Languages, Moon, Sun } from 'lucide-react';
import './AIAgents.css';

export default function AIAgents() {
  const navigate = useNavigate();
  const { t, toggleLang, lang } = useLanguage();
  const { theme, toggle } = useTheme();

  const agents = useMemo(
    () => [
      {
        key: 'essay-grader',
        label: t('aiEssayTitle'),
        tip: t('aiEssayContent'),
        route: '/essay-grader',
        color: 'var(--orange)',
        bg: 'var(--orange-bg)',
        glow: 'rgba(249,115,22,.3)',
        ripple: 'rgba(249,115,22,0.9)',
        icon: (
          <svg viewBox="0 0 24 24">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
          </svg>
        ),
      },
      {
        key: 'evaluator',
        label: t('aiEvaluatorTitle'),
        tip: t('aiEvaluatorContent'),
        route: '/evaluator',
        color: 'var(--purple)',
        bg: 'var(--purple-bg)',
        glow: 'rgba(124,92,252,.3)',
        ripple: 'rgba(124,92,252,0.9)',
        icon: (
          <svg viewBox="0 0 24 24">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <polyline points="16 11 18 13 22 9" />
          </svg>
        ),
      },
      {
        key: 'summarizer',
        label: t('aiSummarizerTitle'),
        tip: t('aiSummarizerContent'),
        route: '/summarizer',
        color: 'var(--teal)',
        bg: 'var(--teal-bg)',
        glow: 'rgba(20,184,166,.3)',
        ripple: 'rgba(20,184,166,0.9)',
        icon: (
          <svg viewBox="0 0 24 24">
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <line x1="7" y1="8" x2="17" y2="8" />
            <line x1="7" y1="12" x2="17" y2="12" />
            <line x1="7" y1="16" x2="13" y2="16" />
          </svg>
        ),
      },
      {
        key: 'tutor',
        label: t('aiChatTitle'),
        tip: t('aiChatContent'),
        route: '/chat',
        color: 'var(--blue)',
        bg: 'var(--blue-bg)',
        glow: 'rgba(59,130,246,.3)',
        ripple: 'rgba(59,130,246,0.9)',
        icon: (
          <svg viewBox="0 0 24 24">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        ),
      },
      {
        key: 'quiz',
        label: t('aiQuizTitle'),
        tip: t('aiQuizContent'),
        route: '/quiz',
        color: 'var(--pink)',
        bg: 'var(--pink-bg)',
        glow: 'rgba(236,72,153,.3)',
        ripple: 'rgba(236,72,153,0.9)',
        icon: (
          <svg viewBox="0 0 24 24">
            <rect x="3" y="4" width="18" height="18" rx="2" />
            <line x1="16" y1="2" x2="16" y2="6" />
            <line x1="8" y1="2" x2="8" y2="6" />
            <line x1="3" y1="10" x2="21" y2="10" />
            <polyline points="8 14 10 16 14 12" />
          </svg>
        ),
      },
    ],
    [t],
  );

  function spawnRipple(event, color) {
    const ripple = document.createElement('div');
    ripple.className = 'ai-orbit-ripple';
    const size = 64;
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - size / 2}px`;
    ripple.style.top = `${event.clientY - size / 2}px`;
    ripple.style.background = color;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 700);
  }

  return (
    <div className="ai-orbit">
      <div className="ai-orbit-header">
        <div className="ai-orbit-header-left">
          <h1>{t('navAiAgents')}</h1>
          <p>{t('aiAgentsSubtitle')}</p>
        </div>
        <div className="ai-orbit-header-actions">
          <button type="button" className="ai-orbit-btn" onClick={toggle}>
            {theme === 'dark' ? <Sun /> : <Moon />}
            {theme === 'dark' ? t('lightMode') : t('darkMode')}
          </button>
          <button type="button" className="ai-orbit-btn" onClick={toggleLang}>
            <Languages />
            {lang === 'en' ? 'AR' : 'EN'}
          </button>
        </div>
      </div>

      <div className="ai-orbit-body">
        <div className="ai-orbit-scene">
          <div className="ai-orbit-ring-base" />
          <div className="ai-orbit-ring-inner" />
          <div className="ai-orbit-ring-spin" />

          {agents.map((agent, index) => {
            const n = agents.length;
            const angle = (index / n) * 360 - 90;
            const rad = (angle * Math.PI) / 180;
            const cx = Math.cos(rad) * 210;
            const cy = Math.sin(rad) * 210;

            return (
              <button
                key={agent.key}
                type="button"
                className="ai-orbit-node"
                style={{
                  transform: `translate(${cx}px, ${cy}px)`,
                  '--ic-color': agent.color,
                  '--ic-bg': agent.bg,
                  '--ic-glow': agent.glow,
                }}
                onClick={(event) => {
                  spawnRipple(event, agent.ripple);
                  setTimeout(() => navigate(agent.route), 260);
                }}
              >
                <div className="ai-orbit-disk">
                  <div className="ai-orbit-disk-icon">{agent.icon}</div>
                  <div className="ai-orbit-tip">{agent.tip}</div>
                </div>
                <div className="ai-orbit-label">{agent.label}</div>
              </button>
            );
          })}

          <div className="ai-orbit-orb">
            <div className="ai-orbit-orb-pings">
              <div className="ai-orbit-orb-ping" />
              <div className="ai-orbit-orb-ping" />
              <div className="ai-orbit-orb-ping" />
            </div>
            <div className="ai-orbit-orb-core">
              <svg viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                <circle cx="14" cy="14" r="3.5" />
                <circle cx="14" cy="5" r="2" />
                <circle cx="14" cy="23" r="2" />
                <circle cx="5" cy="14" r="2" />
                <circle cx="23" cy="14" r="2" />
                <circle cx="7.5" cy="7.5" r="1.6" />
                <circle cx="20.5" cy="7.5" r="1.6" />
                <circle cx="7.5" cy="20.5" r="1.6" />
                <circle cx="20.5" cy="20.5" r="1.6" />
                <line x1="14" y1="10.5" x2="14" y2="7" />
                <line x1="14" y1="17.5" x2="14" y2="21" />
                <line x1="10.5" y1="14" x2="7" y2="14" />
                <line x1="17.5" y1="14" x2="21" y2="14" />
                <line x1="11.5" y1="11.5" x2="9.2" y2="9.2" />
                <line x1="16.5" y1="11.5" x2="18.8" y2="9.2" />
                <line x1="11.5" y1="16.5" x2="9.2" y2="18.8" />
                <line x1="16.5" y1="16.5" x2="18.8" y2="18.8" />
              </svg>
            </div>
          </div>
        </div>
        <div className="ai-orbit-hint">{t('aiAgentsHint')}</div>
      </div>
    </div>
  );
}
