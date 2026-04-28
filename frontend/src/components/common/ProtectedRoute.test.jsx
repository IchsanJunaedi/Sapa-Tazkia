// frontend/src/components/common/ProtectedRoute.test.jsx

import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';

// Mock AuthContext
const mockUseAuth = jest.fn();
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => mockUseAuth(),
}));

const renderWithRouter = (initialEntry, { adminOnly = false } = {}) => {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/chat"
          element={
            <ProtectedRoute adminOnly={adminOnly}>
              <div>Protected Content</div>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute adminOnly={true}>
              <div>Admin Dashboard</div>
            </ProtectedRoute>
          }
        />
        <Route path="/" element={<div>Landing Page</div>} />
      </Routes>
    </MemoryRouter>,
  );
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    sessionStorage.clear();
  });

  it('shows loading UI when loading=true', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: true, user: null });
    renderWithRouter('/chat');
    expect(screen.getByText('Loading...')).toBeInTheDocument();
  });

  it('redirects to / when unauthenticated + no guest mode', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false, user: null });
    renderWithRouter('/chat');
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  it('allows access when authenticated (non-admin)', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true, loading: false,
      user: { id: 1, userType: 'student' },
    });
    renderWithRouter('/chat');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows access via guest URL param', () => {
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false, user: null });
    renderWithRouter('/chat?guest=true');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('allows access via persistent guest session in localStorage', () => {
    localStorage.setItem('guestSessionId', 'abc-123');
    mockUseAuth.mockReturnValue({ isAuthenticated: false, loading: false, user: null });
    renderWithRouter('/chat');
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('blocks non-admin from adminOnly route', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true, loading: false,
      user: { id: 1, userType: 'student' },
    });
    renderWithRouter('/admin/dashboard', { adminOnly: true });
    expect(screen.getByText('Landing Page')).toBeInTheDocument();
  });

  it('allows admin to access adminOnly route', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true, loading: false,
      user: { id: 1, userType: 'admin' },
    });
    renderWithRouter('/admin/dashboard', { adminOnly: true });
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });

  it('redirects admin away from non-admin route', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true, loading: false,
      user: { id: 1, userType: 'admin' },
    });
    renderWithRouter('/chat');
    // Admin should be redirected to /admin/dashboard (adminOnly view)
    expect(screen.getByText('Admin Dashboard')).toBeInTheDocument();
  });
});
