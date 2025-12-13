import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/LoginPage';
import ChatPage from './pages/ChatPage';
import AboutYouPage from './pages/AboutYouPage';
import AuthCallback from './pages/AuthCallback';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ProtectedRoute from './components/common/ProtectedRoute';

// ✅ NEW: Import Halaman Akademik
import AcademicPage from './pages/AcademicPage';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/verify-email" element={<VerifyEmailPage />} />
          
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
          {/* :chatId harus sama dengan nama di useParams() ChatPage.jsx */}
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
  );
}

export default App;