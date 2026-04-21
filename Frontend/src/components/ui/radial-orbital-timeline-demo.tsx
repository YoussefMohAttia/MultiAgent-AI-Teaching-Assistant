"use client";

import { Calendar, Code, FileText, User, Clock } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import RadialOrbitalTimeline, {
  type TimelineItem,
} from '@/components/ui/radial-orbital-timeline';

const timelineData: TimelineItem[] = [
  {
    id: 1,
    title: 'Summarizer',
    date: 'AI Agent',
    content: 'Turn long lecture notes into concise, exam-ready summaries.',
    category: 'Summarizer',
    icon: FileText,
    relatedIds: [2, 3],
    status: 'completed',
    energy: 100,
    route: '/summarizer',
  },
  {
    id: 2,
    title: 'Quiz Generator',
    date: 'AI Agent',
    content: 'Generate practice quizzes from text or course documents.',
    category: 'Quiz',
    icon: Calendar,
    relatedIds: [1, 3],
    status: 'in-progress',
    energy: 92,
    route: '/quiz',
  },
  {
    id: 3,
    title: 'AI Tutor Chat',
    date: 'AI Agent',
    content: 'Ask follow-up questions and get concept explanations instantly.',
    category: 'Chat',
    icon: Code,
    relatedIds: [1, 2, 4],
    status: 'in-progress',
    energy: 85,
    route: '/chat',
  },
  {
    id: 4,
    title: 'Evaluator',
    date: 'AI Agent',
    content: 'Evaluate summary quality and get structured feedback.',
    category: 'Evaluator',
    icon: User,
    relatedIds: [3, 5],
    status: 'pending',
    energy: 70,
    route: '/evaluator',
  },
  {
    id: 5,
    title: 'Essay Grader',
    date: 'AI Agent',
    content: 'Predict IELTS band score and receive writing guidance.',
    category: 'Essay',
    icon: Clock,
    relatedIds: [4],
    status: 'pending',
    energy: 65,
    route: '/essay-grader',
  },
];

export function RadialOrbitalTimelineDemo() {
  const navigate = useNavigate();

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
