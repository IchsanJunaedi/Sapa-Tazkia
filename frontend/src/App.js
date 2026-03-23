import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AboutYouPage from './pages/AboutYouPage';
import AuthCallback from './pages/AuthCallback';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProtectedRoute from './components/common/ProtectedRoute';

// ✅ NEW: Import Halaman Akademik
import AcademicPage from './pages/AcademicPage';

// ✅ NEW: Import Halaman Admin
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';

// ✅ NEW: Import Info Pages
import HelpCenterPage from './pages/HelpCenterPage';
import TermsPoliciesPage from './pages/TermsPoliciesPage';
import ReportBugPage from './pages/ReportBugPage';
import TentangPage from './pages/TentangPage';

// ✅ NEW: Custom Wrapper for Admin Login Redirect
const AdminLoginRoute = ({ children }) => {
  const storedUser = localStorage.getItem('user');
  const storedToken = localStorage.getItem('token');

  if (storedUser && storedToken) {
    try {
      const userData = JSON.parse(storedUser);
      if (userData.userType === 'admin') {
        return <Navigate to="/admin/dashboard" replace />;
      }
    } catch (e) { }
  }
  return children;
};

function App() {
  return (
    <ThemeProvider>
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />

          {/* ✅ NEW: Static Info Pages (public) */}
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/terms" element={<TermsPoliciesPage />} />
          <Route path="/tentang" element={<TentangPage />} />

          {/* Public Admin Routes */}
          <Route path="/admin/login" element={
            <AdminLoginRoute>
              <AdminLogin />
            </AdminLoginRoute>
          } />
          <Route path="/admin" element={
            <AdminLoginRoute>
              <Navigate to="/admin/login" replace />
            </AdminLoginRoute>
          } />

          {/* Protected Routes */}
          <Route
            path="/about-you"
            element={
              <ProtectedRoute>
                <AboutYouPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW: Route untuk Halaman Akademik (Nilai & PDF) */}
          <Route
            path="/academic"
            element={
              <ProtectedRoute>
                <AcademicPage />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW: Route untuk Admin Dashboard */}
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute adminOnly={true}>
                <AdminDashboard />
              </ProtectedRoute>
            }
          />

          {/* ✅ NEW: Report a Bug (protected) */}
          <Route
            path="/report-bug"
            element={
              <ProtectedRoute>
                <ReportBugPage />
              </ProtectedRoute>
            }
          />

          {/* Route untuk ChatPage */}

          {/* 1. Route untuk New Chat (Chat Baru) */}
          <Route
            path="/chat"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* 2. Route untuk History Chat (Agar bisa refresh) */}
          <Route
            path="/chat/:chatId"
            element={
              <ProtectedRoute>
                <ChatPage />
              </ProtectedRoute>
            }
          />

          {/* Fallback route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
    </ThemeProvider>
  );
}

export default App;