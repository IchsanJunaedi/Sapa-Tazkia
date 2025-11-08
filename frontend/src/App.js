import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';

// 1. IMPORT AuthProvider-NYA
import { AuthProvider } from './context/AuthContext'; // Pastikan path ini benar!

import LandingPage from './pages/LandingPage';
import ChatPage from './pages/ChatPage';
import LoginPage from './pages/LoginPage';

function App() {
  return (
    <Router>
      {/* 2. BUNGKUS SEMUA <Routes> DENGAN <AuthProvider> */}
      <AuthProvider>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;