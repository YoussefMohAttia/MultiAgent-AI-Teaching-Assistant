import { useNavigate } from 'react-router-dom';
import './AIAgents.css';

const AGENTS = [
  {
    title: 'Summarizer',
    icon: '📝',
    description: 'Turn long lecture notes into concise, exam-ready summaries.',
    to: '/summarizer',
  },
  {
    title: 'Quiz Generator',
    icon: '❓',
    description: 'Generate practice quizzes from text or documents.',
    to: '/quiz',
  },
  {
    title: 'AI Tutor Chat',
    icon: '💬',
    description: 'Ask follow-up questions and learn concepts step-by-step.',
    to: '/chat',
  },
  {
    title: 'Evaluator',
    icon: '📊',
    description: 'Evaluate summary quality with structured feedback.',
    to: '/evaluator',
  },
  {
    title: 'Essay Grader',
    icon: '🧾',
    description: 'Get an AI-based essay score and writing guidance.',
    to: '/essay-grader',
  },
];

export default function AIAgents() {
  const navigate = useNavigate();

  return (
    <div className="agents-page">
      <header className="agents-header card">
        <p className="agents-kicker">AI Workspace</p>
        <h1>AI Agents</h1>
        <p>Select one of the five AI models to start your task.</p>
        <button className="btn btn-secondary" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </header>

      <section className="agents-grid">
        {AGENTS.map((agent) => (
          <article key={agent.title} className="card agents-card">
            <div className="agents-card-icon" aria-hidden="true">{agent.icon}</div>
            <h2>{agent.title}</h2>
            <p>{agent.description}</p>
            <button className="btn btn-primary" onClick={() => navigate(agent.to)}>
              Open
            </button>
          </article>
        ))}
      </section>
    </div>
  );
}
