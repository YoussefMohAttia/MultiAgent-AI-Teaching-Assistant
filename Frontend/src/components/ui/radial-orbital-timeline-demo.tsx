"use client";

import { Calendar, Code, FileText, User, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/contexts/LanguageContext';
import RadialOrbitalTimeline, {
  type TimelineItem,
} from '@/components/ui/radial-orbital-timeline';

export function RadialOrbitalTimelineDemo() {
  const navigate = useNavigate();
  const { t } = useLanguage();

  const timelineData: TimelineItem[] = [
    {
      id: 1,
      title: t('aiSummarizerTitle'),
      date: t('aiAgentLabel'),
      content: t('aiSummarizerContent'),
      category: t('aiSummarizerTitle'),
      icon: FileText,
      relatedIds: [2, 3],
      status: 'completed',
      energy: 100,
      route: '/summarizer',
    },
    {
      id: 2,
      title: t('aiQuizTitle'),
      date: t('aiAgentLabel'),
      content: t('aiQuizContent'),
      category: t('aiQuizTitle'),
      icon: Calendar,
      relatedIds: [1, 3],
      status: 'in-progress',
      energy: 92,
      route: '/quiz',
    },
    {
      id: 3,
      title: t('aiChatTitle'),
      date: t('aiAgentLabel'),
      content: t('aiChatContent'),
      category: t('aiChatTitle'),
      icon: Code,
      relatedIds: [1, 2, 4],
      status: 'in-progress',
      energy: 85,
      route: '/chat',
    },
    {
      id: 4,
      title: t('aiEvaluatorTitle'),
      date: t('aiAgentLabel'),
      content: t('aiEvaluatorContent'),
      category: t('aiEvaluatorTitle'),
      icon: User,
      relatedIds: [3, 5],
      status: 'pending',
      energy: 70,
      route: '/evaluator',
    },
    {
      id: 5,
      title: t('aiEssayTitle'),
      date: t('aiAgentLabel'),
      content: t('aiEssayContent'),
      category: t('aiEssayTitle'),
      icon: Clock,
      relatedIds: [4],
      status: 'pending',
      energy: 65,
      route: '/essay-grader',
    },
  ];

  return (
    <RadialOrbitalTimeline
      timelineData={timelineData}
      openOnNodeClick
      onNodeSelect={(item) => {
        if (item.route) {
          navigate(item.route);
        }
      }}
    />
  );
}

export default { RadialOrbitalTimelineDemo };
