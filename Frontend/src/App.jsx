import { useEffect } from 'react';
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ThemeProvider } from './contexts/ThemeContext';
import ProtectedRoute from './components/ProtectedRoute';
import Layout from './components/Layout';
import SignIn from './pages/SignIn';
import Dashboard from './pages/Dashboard';
import Courses from './pages/Courses';
import QuizGenerator from './pages/QuizGenerator';
import Chat from './pages/Chat';
import Summarizer from './pages/Summarizer';
import Evaluator from './pages/Evaluator';

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
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        {/* Layout-wrapped AI tool pages */}
        <Route
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        >
          <Route path="/courses" element={<Courses />} />
          <Route path="/quiz" element={<QuizGenerator />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/summarizer" element={<Summarizer />} />
          <Route path="/evaluator" element={<Evaluator />} />
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
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </ThemeProvider>
  );
}

