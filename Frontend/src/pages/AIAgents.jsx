import { useNavigate } from 'react-router-dom';
import { RadialOrbitalTimelineDemo } from '@/components/ui/radial-orbital-timeline-demo';
import { useLanguage } from '../contexts/LanguageContext';
import './AIAgents.css';

export default function AIAgents() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  return (
    <div className="ai-agents-page">
      <button
        type="button"
        className="ai-agents-back"
        onClick={() => navigate('/dashboard')}
      >
        ← {t('backToDashboard')}
      </button>
      <RadialOrbitalTimelineDemo />
    </div>
  );
}
