import './UserManual.css';

const TAB_GUIDE = [
  {
    tab: 'Dashboard',
    icon: '📊',
    purpose: 'Your home overview after sign-in.',
    details: [
      'Shows your greeting, date, and key study stats in one place.',
      'Lets you sync Google Classroom and refresh your enrolled course list.',
      'Provides quick action cards to open Chat, Summarizer, Quiz, and Essay Grader faster.',
    ],
  },
  {
    tab: 'Courses',
    icon: '📚',
    purpose: 'Manage courses and their study materials.',
    details: [
      'Open a course and upload PDF documents to build your study knowledge base.',
      'Download previously uploaded documents when needed.',
    ],
  },
  {
    tab: 'Summarizer',
    icon: '📝',
    purpose: 'Turn long content into concise study notes.',
    details: [
      'Paste text or select course documents to generate focused summaries.',
      'Saves time before revision by extracting key concepts quickly.',
      'Useful before exams to create rapid review material.',
    ],
  },
  {
    tab: 'Quiz Generator',
    icon: '❓',
    purpose: 'Create and take AI-generated quizzes.',
    details: [
      'Generate quiz questions from custom text or uploaded course files.',
      'Adjust number of questions and options to match your level.',
      'Switch to Take a Quiz mode to practice with saved quizzes by course.',
    ],
  },
  {
    tab: 'AI Tutor Chat',
    icon: '💬',
    purpose: 'Ask questions and get guided explanations.',
    details: [
      'Use conversational learning to clarify topics step-by-step.',
      'Great for follow-up questions when lecture notes are confusing.',
      'Supports quick concept checks while you study.',
    ],
  },
  {
    tab: 'Evaluator',
    icon: '📊',
    purpose: 'Evaluate summary quality and coverage.',
    details: [
      'Compare generated summaries against expected quality dimensions.',
      'Highlights strengths and weak points to improve summary writing.',
      'Helps verify whether your notes preserved the essential meaning.',
    ],
  },
  {
    tab: 'Essay Grader',
    icon: '🧾',
    purpose: 'Estimate essay quality using the grading model.',
    details: [
      'Submit essay text and receive an AI-based score with feedback cues.',
      'Useful for iterative writing practice before final submissions.',
      'Supports self-assessment and faster writing improvement cycles.',
    ],
  },
  {
    tab: 'User Manual',
    icon: '📘',
    purpose: 'This page. Central reference for using the platform.',
    details: [
      'Explains platform purpose and the function of each tab.',
      'Provides a recommended student workflow from setup to revision.',
      'Can be shared with first-time users for onboarding.',
    ],
  },
];

export default function UserManual() {
  return (
    <div className="manual-root">
      <section className="manual-hero card">
        <p className="manual-kicker">Platform Guide</p>
        <h2>MultiAgent AI Teaching Assistant User Manual</h2>
        <p className="manual-lead">
          This website is built to help students study faster and smarter by combining multiple AI tools
          in one workflow. Its main purpose is to support learning from classroom materials through
          summarization, quiz practice, tutoring conversations, and writing evaluation.
        </p>
      </section>

      <section className="card manual-section">
        <h3>Primary Purpose Of The Website</h3>
        <ul className="manual-list">
          <li>Centralize course content and AI learning tools in a single platform.</li>
          <li>Transform raw study material into summaries, quizzes, and guided explanations.</li>
          <li>Improve comprehension, retention, and writing performance with practical feedback loops.</li>
          <li>Reduce study time while increasing confidence before assessments.</li>
        </ul>
      </section>

      <section className="card manual-section">
        <h3>What Each Left-Side Tab Does</h3>
        <div className="manual-grid">
          {TAB_GUIDE.map((item) => (
            <article key={item.tab} className="manual-tab-card">
              <header>
                <span className="manual-tab-icon" aria-hidden="true">{item.icon}</span>
                <div>
                  <h4>{item.tab}</h4>
                  <p>{item.purpose}</p>
                </div>
              </header>
              <ul className="manual-list compact">
                {item.details.map((detail) => (
                  <li key={detail}>{detail}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="card manual-section">
        <h3>Brought to you by:</h3>
        <ol className="manual-steps">
          <li>Ahmed Samir</li>
          <li>Mohamed Morsy</li>
          <li>Youssef Ibrahim</li>
          <li>Youssef Moh Attia</li>
          <li>Youssef Awad</li>
          <li>Karim Mohamed ElMahrouky</li>
        </ol>
      </section>
    </div>
  );
}
