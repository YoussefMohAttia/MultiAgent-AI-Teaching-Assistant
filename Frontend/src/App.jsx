import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import Summarizer from './pages/Summarizer';
import QuizGenerator from './pages/QuizGenerator';
import Chat from './pages/Chat';
import Evaluator from './pages/Evaluator';
import './App.css';

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="courses" element={<Courses />} />
        <Route path="summarizer" element={<Summarizer />} />
        <Route path="quiz" element={<QuizGenerator />} />
        <Route path="chat" element={<Chat />} />
        <Route path="evaluator" element={<Evaluator />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
