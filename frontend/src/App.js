import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { NotificationProvider } from './context/NotificationContext';
import ErrorBoundary from './components/common/ErrorBoundary';
import LoadingFallback from './components/common/LoadingFallback';
import ProtectedRoute from './components/common/ProtectedRoute';

// ─── Lazy-loaded Pages (Code Splitting) ──────────────────────────────────────
// Each page is loaded on-demand, drastically reducing initial bundle size.
const LandingPage = lazy(() => import('./pages/LandingPage'));
const MarketingLandingPage = lazy(() => import('./pages/MarketingLandingPage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const ChatPage = lazy(() => import('./pages/ChatPage'));
const AboutYouPage = lazy(() => import('./pages/AboutYouPage'));
const AuthCallback = lazy(() => import('./pages/AuthCallback'));
const VerifyEmailPage = lazy(() => import('./pages/VerifyEmailPage'));
const AcademicPage = lazy(() => import('./pages/AcademicPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminLogin = lazy(() => import('./pages/AdminLogin'));
const HelpCenterPage = lazy(() => import('./pages/HelpCenterPage'));
const TermsPoliciesPage = lazy(() => import('./pages/TermsPoliciesPage'));
const ReportBugPage = lazy(() => import('./pages/ReportBugPage'));
const TentangPage = lazy(() => import('./pages/TentangPage'));
const DocsPage = lazy(() => import('./pages/DocsPage'));

// ─── Admin Login Redirect Guard ──────────────────────────────────────────────
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
    <ErrorBoundary>
      <ThemeProvider>
        <Router>
          <AuthProvider>
            <NotificationProvider>
              <Suspense fallback={<LoadingFallback />}>
                <Routes>
                  {/* Marketing Landing Page — public homepage */}
                  <Route path="/" element={<MarketingLandingPage />} />

                  {/* Chat Interface (LandingPage) — handles its own auth modal */}
                  <Route path="/chat" element={<LandingPage />} />

                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/auth/callback" element={<AuthCallback />} />
                  <Route path="/verify-email" element={<VerifyEmailPage />} />

                  {/* Static Info Pages (public) */}
                  <Route path="/help" element={<HelpCenterPage />} />
                  <Route path="/terms" element={<TermsPoliciesPage />} />
                  <Route path="/tentang" element={<TentangPage />} />
                  <Route path="/docs" element={<DocsPage />} />

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

                  {/* Route untuk Halaman Akademik (Nilai & PDF) */}
                  <Route
                    path="/academic"
                    element={
                      <ProtectedRoute>
                        <AcademicPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Route untuk Admin Dashboard */}
                  <Route
                    path="/admin/dashboard"
                    element={
                      <ProtectedRoute adminOnly={true}>
                        <AdminDashboard />
                      </ProtectedRoute>
                    }
                  />

                  {/* Report a Bug (protected) */}
                  <Route
                    path="/report-bug"
                    element={
                      <ProtectedRoute>
                        <ReportBugPage />
                      </ProtectedRoute>
                    }
                  />

                  {/* Direct chat session (deeplink by chatId) */}
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
              </Suspense>
            </NotificationProvider>
          </AuthProvider>
        </Router>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;