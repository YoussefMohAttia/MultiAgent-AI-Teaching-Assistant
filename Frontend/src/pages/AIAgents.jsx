import { useNavigate } from 'react-router-dom';
import { RadialOrbitalTimelineDemo } from '@/components/ui/radial-orbital-timeline-demo';
import './AIAgents.css';

export default function AIAgents() {
  const navigate = useNavigate();

  return (
    <div className="ai-agents-page">
      <button
        type="button"
        className="ai-agents-back"
        onClick={() => navigate('/dashboard')}
      >
        ← Back to Dashboard
      </button>
      <RadialOrbitalTimelineDemo />
    </div>
  );
}
