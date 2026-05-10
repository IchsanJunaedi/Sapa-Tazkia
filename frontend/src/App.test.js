import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

// Mock all lazy-loaded pages to avoid loading full implementations
jest.mock('./pages/MarketingLandingPage', () => () => <div data-testid="marketing-page">Marketing</div>);
jest.mock('./pages/LandingPage', () => () => <div data-testid="landing-page">Landing</div>);
jest.mock('./pages/LoginPage', () => () => <div data-testid="login-page">Login</div>);
jest.mock('./pages/ChatPage', () => () => <div data-testid="chat-page">Chat</div>);
jest.mock('./pages/AboutYouPage', () => () => <div data-testid="about-you-page">AboutYou</div>);
jest.mock('./pages/AuthCallback', () => () => <div data-testid="auth-callback">Callback</div>);
jest.mock('./pages/VerifyEmailPage', () => () => <div data-testid="verify-email-page">Verify</div>);
jest.mock('./pages/AcademicPage', () => () => <div data-testid="academic-page">Academic</div>);
jest.mock('./pages/AdminDashboard', () => () => <div data-testid="admin-dashboard">Admin</div>);
jest.mock('./pages/AdminLogin', () => () => <div data-testid="admin-login">AdminLogin</div>);
jest.mock('./pages/HelpCenterPage', () => () => <div data-testid="help-page">Help</div>);
jest.mock('./pages/TermsPoliciesPage', () => () => <div data-testid="terms-page">Terms</div>);
jest.mock('./pages/ReportBugPage', () => () => <div data-testid="report-bug-page">Bug</div>);
jest.mock('./pages/TentangPage', () => () => <div data-testid="tentang-page">Tentang</div>);
jest.mock('./pages/DocsPage', () => () => <div data-testid="docs-page">Docs</div>);

// Mock contexts to avoid side effects
jest.mock('./context/AuthContext', () => ({
  AuthProvider: ({ children }) => <div data-testid="auth-provider">{children}</div>,
  useAuth: () => ({ user: null, loading: false }),
}));

jest.mock('./context/ThemeContext', () => ({
  ThemeProvider: ({ children }) => <div data-testid="theme-provider">{children}</div>,
}));

jest.mock('./context/NotificationContext', () => ({
  NotificationProvider: ({ children }) => <div data-testid="notification-provider">{children}</div>,
}));

// Mock ProtectedRoute to just render children (for testing route structure)
jest.mock('./components/common/ProtectedRoute', () => ({ children }) => <>{children}</>);
jest.mock('./components/common/ErrorBoundary', () => ({ children }) => <>{children}</>);
jest.mock('./components/common/LoadingFallback', () => () => <div>Loading...</div>);

describe('App', () => {
  beforeEach(() => {
    // Clear localStorage for admin route tests
    localStorage.clear();
  });

  it('renders without crashing', async () => {
    render(<App />);
    // The marketing page is the default route "/"
    expect(await screen.findByTestId('marketing-page')).toBeInTheDocument();
  });

  it('wraps content in ThemeProvider and AuthProvider', async () => {
    render(<App />);
    expect(await screen.findByTestId('theme-provider')).toBeInTheDocument();
    expect(screen.getByTestId('auth-provider')).toBeInTheDocument();
    expect(screen.getByTestId('notification-provider')).toBeInTheDocument();
  });

  it('renders marketing page at root path', async () => {
    render(<App />);
    expect(await screen.findByTestId('marketing-page')).toBeInTheDocument();
  });
});
