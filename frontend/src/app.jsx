import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import LandingPage from './LandingPage';
import ChatPage from './ChatPage';

/**
 * Komponen ini membungkus <ChatPage> untuk memeriksanya.
 * Dalam kasus ini, kita mengizinkan semua orang (guest dan user)
 * untuk mengakses /chat.
 * * Jika Anda ingin MEWAJIBKAN login untuk /chat, ubah ini:
 * const { user } = useAuth();
 * if (!user) {
 * return <Navigate to="/" replace />;
 * }
 * return <ChatPage />;
 */
const ChatRoute = () => {
  // Saat ini, kita mengizinkan siapa saja ke /chat
  return <ChatPage />;
};

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/chat" element={<ChatRoute />} />
          {/* Redirect semua rute lain ke landing page */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;