import { Outlet, useNavigate } from 'react-router-dom';
import { useLanguage } from '../contexts/LanguageContext';
import './AgentPageLayout.css';

export default function AgentPageLayout() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="agent-layout-root">
      <header className="agent-layout-header">
        <button
          type="button"
          className="agent-layout-back"
          onClick={() => navigate('/ai-agents')}
          aria-label={t('backToAiAgents')}
        >
          ← {t('backToAiAgents')}
        </button>
      </header>
      <main className="agent-layout-content">
        <Outlet />
      </main>
    </div>
  );
}
