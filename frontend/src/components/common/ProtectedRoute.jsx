import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const ProtectedRoute = ({ children, adminOnly = false }) => {
  const { isAuthenticated, loading, user } = useAuth();
  const location = useLocation();

  if (process.env.NODE_ENV === 'development') {
    console.log('🔐 [PROTECTED ROUTE] Auth check:', {
      isAuthenticated,
      loading,
      currentPath: location.pathname,
      locationState: location.state,
      locationSearch: location.search
    });
  }

  // ✅ CEK URL PARAMETERS untuk guest mode
  const guestFromUrl = new URLSearchParams(location.search).get('guest') === 'true';
  const isGuestMode = location.state?.isGuest || guestFromUrl;

  // ✅ CEK PERSISTENT GUEST SESSION
  const hasGuestSession = localStorage.getItem('guestSessionId') || sessionStorage.getItem('guestSessionId');

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mb-4 mx-auto">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-orange-500 animate-pulse">
              <path d="M4 14s1.5-1 4-1 4 1 4 1v3H4z" />
              <path d="M18 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
              <path d="M10 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4z" />
            </svg>
          </div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // ✅ IZINKAN AKSES JIKA: Authenticated ATAU Guest Mode ATAU Ada Guest Session
  if (!isAuthenticated && !isGuestMode && !hasGuestSession) {
    return <Navigate to="/" replace />;
  }

  // ✅ JIKA ROUTE INI KHUSUS ADMIN
  if (adminOnly) {
    if (!isAuthenticated || !user || user.userType !== 'admin') {
      return <Navigate to="/" replace />;
    }
  } else {
    // ✅ JIKA ROUTE BUKAN KHUSUS ADMIN MELAINKAN HALAMAN CHAT USER
    // Tolak Admin masuk ke halaman mahasiswa/user biasa
    if (isAuthenticated && user && user.userType === 'admin') {
      return <Navigate to="/admin/dashboard" replace />;
    }
  }

  return children;
};

export default ProtectedRoute;
