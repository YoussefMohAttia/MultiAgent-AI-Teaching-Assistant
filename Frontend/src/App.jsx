import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import { LanguageProvider } from './contexts/LanguageContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import AgentPageLayout from './components/AgentPageLayout';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import QuizGenerator from './pages/QuizGenerator';
import Chat from './pages/Chat';
import Summarizer from './pages/Summarizer';
import Evaluator from './pages/Evaluator';
import EssayGrader from './pages/EssayGrader';
import UserManual from './pages/UserManual';
import Pomodoro from './pages/Pomodoro';
import MiniGames from './pages/MiniGames';
import AIAgents from './pages/AIAgents';
import Profile from './pages/Profile';
import { PomodoroProvider } from './contexts/PomodoroContext';

// Handles ?token= query param injected by the backend redirect
function TokenHandler() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    if (token) {
      login(token);
      // Remove token from URL immediately
      navigate('/dashboard', { replace: true });
    }
  }, []);

  return null;
}

function AppRoutes() {
  return (
    <>
      <TokenHandler />
      <Routes>
        <Route path="/" element={<SignIn />} />
        {/* Layout-wrapped AI tool pages */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/courses" element={<Courses />} />
          <Route path="/ai-agents" element={<AIAgents />} />
          <Route path="/pomodoro" element={<Pomodoro />} />
          <Route path="/mini-games" element={<MiniGames />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/user-manual" element={<UserManual />} />
        </Route>

        <Route
          element={
            <ProtectedRoute>
              <AgentPageLayout />
            </ProtectedRoute>
          }
        >
          <Route path="/quiz" element={<QuizGenerator />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/summarizer" element={<Summarizer />} />
          <Route path="/evaluator" element={<Evaluator />} />
          <Route path="/essay-grader" element={<EssayGrader />} />
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<SignIn />} />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <LanguageProvider>
        <AuthProvider>
          <PomodoroProvider>
            <AppRoutes />
          </PomodoroProvider>
        </AuthProvider>
      </LanguageProvider>
    </ThemeProvider>
  );
}

