import React, { useState, useContext, createContext, useEffect } from 'react';
import {
  BrowserRouter,
  Routes,
  Route,
  useSearchParams,
  useNavigate
} from 'react-router-dom';

import ChatPage from './pages/ChatPage';
import LandingPage from './pages/LandingPage';
import MarketingLandingPage from './pages/MarketingLandingPage';
import LoginPage from './pages/LoginPage';
import api, { setAuthHeaders, clearAuthHeaders } from './api/axiosConfig';

// --- AuthContext ---
const AuthContext = createContext(null);

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    const checkLoggedInUser = async () => {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          setAuthHeaders(token);
          const response = await api.get('/auth/me');
          setUser(response.data.user);
          setIsAuthenticated(true);
        } catch (error) {
          console.error("Token invalid, logging out");
          logout();
        }
      }
      setLoading(false);
    };
    checkLoggedInUser();
  }, []);

  const login = async (nimOrToken, passwordOrUser) => {
    setLoading(true);
    try {
      let token;
      let userData;

      if (typeof passwordOrUser === 'string') {
        const response = await api.post('/auth/login', { nim: nimOrToken, password: passwordOrUser });
        token = response.data.token;
        userData = response.data.user;
      } else {
        token = nimOrToken;
        userData = passwordOrUser;
        if (!userData) {
          setAuthHeaders(token);
          const response = await api.get('/auth/me');
          userData = response.data.user;
        }
      }

      localStorage.setItem('token', token);
      setAuthHeaders(token);
      setUser(userData);
      setIsAuthenticated(true);
      return true;

    } catch (error) {
      console.error("Login failed:", error.response?.data?.message || error.message);
      logout();
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      const token = response.data.token;
      const userDataFromResponse = response.data.user;
      localStorage.setItem('token', token);
      api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      setUser(userDataFromResponse);
      setIsAuthenticated(true);
      return true;
    } catch (error) {
      console.error("Register failed:", error);
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    setIsAuthenticated(false);
    clearAuthHeaders();
    window.location.href = '/';
  };

  const value = { user, loading, isAuthenticated, login, register, logout };

  return (
    <AuthContext.Provider value={value}>
      {loading ? (
        <div className="min-h-screen flex items-center justify-center">
          <p>Loading user...</p>
        </div>
      ) : children}
    </AuthContext.Provider>
  );
};

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};

// --- GoogleIcon ---
const GoogleIcon = () => (
  <svg className="w-5 h-5" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
    <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 126 23.4 172.9 61.9l-62.2 62.2C338.5 109.4 300.9 96 248 96c-106.1 0-192 85.9-192 192s85.9 192 192 192c100.9 0 181.1-73.6 188.7-169.1H248v-81.6h239.2c2.7 13.2 4.8 27.2 4.8 42.6z" />
  </svg>
);

// --- AuthCallback ---
const AuthCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [error, setError] = useState(null);

  useEffect(() => {
    const token = searchParams.get('token');
    const userParam = searchParams.get('user');
    const processLogin = async () => {
      if (token) {
        try {
          const userObject = userParam ? JSON.parse(decodeURIComponent(userParam)) : null;
          await login(token, userObject);
          navigate('/chat');
        } catch (err) {
          console.error("Callback failed:", err);
          setError("Login Google gagal. Silakan coba lagi.");
          setTimeout(() => navigate('/'), 3000);
        }
      } else {
        setError("Token tidak ditemukan di callback URL.");
        setTimeout(() => navigate('/'), 3000);
      }
    };
    processLogin();
  }, [login, navigate, searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      {error ? <p className="text-red-500">{error}</p> : <p>Memproses login Anda...</p>}
    </div>
  );
};

// LoginPage legacy removed, using pages/LoginPage.jsx instead

// --- Main App ---
export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ✅ Marketing Landing Page */}
          <Route path="/" element={<MarketingLandingPage />} />

          {/* ✅ Chat Interface (existing LandingPage) */}
          <Route path="/chat" element={<LandingPage />} />

          {/* ✅ Standalone Login */}
          <Route path="/login" element={<LoginPage />} />

          {/* Auth Callback (Google OAuth) */}
          <Route path="/auth/callback" element={<AuthCallback />} />

          {/* Fallback */}
          <Route path="*" element={<MarketingLandingPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}