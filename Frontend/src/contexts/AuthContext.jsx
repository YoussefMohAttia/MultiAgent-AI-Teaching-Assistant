import { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // On mount: restore token from localStorage (handles page refresh)
  useEffect(() => {
    const token = localStorage.getItem('jwt_token');
    if (token) {
      fetchMe(token);
    } else {
      setLoading(false);
    }
  }, []);

  async function fetchMe(token) {
    try {
      const res = await axios.get('/api/me', {
        headers: { Authorization: `Bearer ${token}` },
      });
      setUser({ ...res.data, token });
    } catch {
      // Token invalid or expired — clear it and treat as logged out
      localStorage.removeItem('jwt_token');
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  function login(token) {
    localStorage.setItem('jwt_token', token);
    setLoading(true);
    fetchMe(token);
  }

  function logout() {
    localStorage.removeItem('jwt_token');
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}