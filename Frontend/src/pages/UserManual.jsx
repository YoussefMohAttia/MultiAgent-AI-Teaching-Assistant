import { useLanguage } from '../contexts/LanguageContext';
import './UserManual.css';

export default function UserManual() {
  const { t } = useLanguage();

  const tabGuide = [
    {
      tab: t('manualTabDashboard'),
      icon: '📊',
      purpose: t('manualTabDashboardPurpose'),
      details: [
        t('manualTabDashboardDetail1'),
        t('manualTabDashboardDetail2'),
        t('manualTabDashboardDetail3'),
      ],
    },
    {
      tab: t('manualTabCourses'),
      icon: '📚',
      purpose: t('manualTabCoursesPurpose'),
      details: [t('manualTabCoursesDetail1'), t('manualTabCoursesDetail2')],
    },
    {
      tab: t('manualTabPomodoro'),
      icon: '⏱️',
      purpose: t('manualTabPomodoroPurpose'),
      details: [
        t('manualTabPomodoroDetail1'),
        t('manualTabPomodoroDetail2'),
        t('manualTabPomodoroDetail3'),
      ],
    },
    {
      tab: t('manualTabMiniGames'),
      icon: '🎮',
      purpose: t('manualTabMiniGamesPurpose'),
      details: [
        t('manualTabMiniGamesDetail1'),
        t('manualTabMiniGamesDetail2'),
        t('manualTabMiniGamesDetail3'),
      ],
    },
    {
      tab: t('manualTabSummarizer'),
      icon: '📝',
      purpose: t('manualTabSummarizerPurpose'),
      details: [
        t('manualTabSummarizerDetail1'),
        t('manualTabSummarizerDetail2'),
        t('manualTabSummarizerDetail3'),
      ],
    },
    {
      tab: t('manualTabQuiz'),
      icon: '❓',
      purpose: t('manualTabQuizPurpose'),
      details: [
        t('manualTabQuizDetail1'),
        t('manualTabQuizDetail2'),
        t('manualTabQuizDetail3'),
      ],
    },
    {
      tab: t('manualTabChat'),
      icon: '💬',
      purpose: t('manualTabChatPurpose'),
      details: [
        t('manualTabChatDetail1'),
        t('manualTabChatDetail2'),
        t('manualTabChatDetail3'),
      ],
    },
    {
      tab: t('manualTabEvaluator'),
      icon: '📊',
      purpose: t('manualTabEvaluatorPurpose'),
      details: [
        t('manualTabEvaluatorDetail1'),
        t('manualTabEvaluatorDetail2'),
        t('manualTabEvaluatorDetail3'),
      ],
    },
    {
      tab: t('manualTabEssay'),
      icon: '🧾',
      purpose: t('manualTabEssayPurpose'),
      details: [
        t('manualTabEssayDetail1'),
        t('manualTabEssayDetail2'),
        t('manualTabEssayDetail3'),
      ],
    },
  ];

  const userManualTab = {
    icon: '📘',
    title: t('manualUserManualTitle'),
    purpose: t('manualUserManualPurpose'),
    description: t('manualUserManualDescription'),
  };
  return (
    <div className="manual-root">
      <section className="manual-hero card">
        <p className="manual-kicker">{t('manualKicker')}</p>
        <h2>{t('manualTitle')}</h2>
        <p className="manual-lead">{t('manualLead')}</p>
      </section>

      <section className="card manual-section">
        <h3>{t('manualPurposeTitle')}</h3>
        <ul className="manual-list">
          <li>{t('manualPurposeList1')}</li>
          <li>{t('manualPurposeList2')}</li>
          <li>{t('manualPurposeList3')}</li>
          <li>{t('manualPurposeList4')}</li>
        </ul>
      </section>

      <section className="card manual-section">
        <h3>{userManualTab.title}</h3>
        <article className="manual-tab-card">
          <header>
            <span className="manual-tab-icon" aria-hidden="true">{userManualTab.icon}</span>
            <div>
              <h4>{t('manualUserManualHeading')}</h4>
              <p>{userManualTab.purpose}</p>
            </div>
          </header>
          <p>{userManualTab.description}</p>
        </article>
      </section>

      <section className="card manual-section">
        <h3>{t('manualLeftTabsTitle')}</h3>
        <div className="manual-grid">
          {tabGuide.map((item) => (
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

    </div>
  );
}
