import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { SplineSceneBasic } from '../components/ui/demo';
import './SignIn.css';

export default function SignIn() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Already logged in → go straight to dashboard
  useEffect(() => {
    if (user) navigate('/dashboard');
  }, [user, navigate]);

  function handleGoogleLogin() {
    window.location.href = '/api/login/_login_route';
  }

  return (
    <div className="signin-root">
      <SplineSceneBasic onSignIn={handleGoogleLogin} />
      <div className="signin-footer">
        <a href="/privacy">Privacy Policy</a>
        <span aria-hidden="true">•</span>
        <a href="/terms">Terms of Service</a>
      </div>
    </div>
  );
}