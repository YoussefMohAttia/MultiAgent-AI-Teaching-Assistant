import { Outlet, useNavigate } from 'react-router-dom';
import './AgentPageLayout.css';

export default function AgentPageLayout() {
  const navigate = useNavigate();

  return (
    <div className="agent-layout-root">
      <header className="agent-layout-header">
        <button
          type="button"
          className="agent-layout-back"
          onClick={() => navigate('/ai-agents')}
          aria-label="Back to AI Agents"
        >
          ← Back to AI Agents
        </button>
      </header>
      <main className="agent-layout-content">
        <Outlet />
      </main>
    </div>
  );
}
