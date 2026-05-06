import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

jest.mock('react-router-dom', () => {
  const actual = jest.requireActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => global.__mockNavigate,
    useSearchParams: () => [new URLSearchParams(global.__currentSearch || '')],
  };
});

jest.mock('../context/AuthContext', () => ({
  useAuth: () => global.__mockAuth,
}));

const mockNavigate = jest.fn();
const mockLogin = jest.fn();

import AuthCallback from './AuthCallback';

const renderWithSearch = (search, auth = {}) => {
  global.__currentSearch = search;
  global.__mockNavigate = mockNavigate;
  global.__mockAuth = { login: mockLogin, isAuthenticated: false, loading: false, user: null, ...auth };
  return render(<MemoryRouter><AuthCallback /></MemoryRouter>);
};

beforeEach(() => {
  jest.useFakeTimers();
  mockNavigate.mockReset();
  mockLogin.mockReset();
  localStorage.clear();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('AuthCallback', () => {
  it('returns early while AuthContext is loading', () => {
    renderWithSearch('?success=true&token=abcdef&user=%7B%22email%22%3A%22a@x.com%22%7D', { loading: true });
    expect(screen.getAllByText(/Processing authentication/i).length).toBeGreaterThan(0);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('redirects authenticated regular user to /', () => {
    renderWithSearch('', { isAuthenticated: true, user: { userType: 'student' } });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('redirects authenticated admin to /admin/dashboard', () => {
    renderWithSearch('', { isAuthenticated: true, user: { userType: 'admin' } });
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true });
  });

  it('shows failure when success param is not true', async () => {
    renderWithSearch('?success=false');
    await waitFor(() => expect(screen.getAllByText(/Authentication failed/i).length).toBeGreaterThan(0));
    act(() => { jest.advanceTimersByTime(2100); });
    expect(mockNavigate).toHaveBeenCalledWith('/', expect.objectContaining({ replace: true }));
  });

  it('shows missing data error when token absent', async () => {
    renderWithSearch('?success=true');
    expect(await screen.findByText(/Missing authentication data/i)).toBeInTheDocument();
  });

  it('redirects to /verify-email when requiresVerification', async () => {
    const userParam = encodeURIComponent(JSON.stringify({ email: 'a@x.com', isEmailVerified: false }));
    renderWithSearch(`?success=true&token=abcdefghij&user=${userParam}&requires_verification=true`);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/verify-email', expect.any(Object)));
    expect(localStorage.getItem('pendingVerificationEmail')).toBe('a@x.com');
  });

  it('logs in and redirects to / for verified normal user with complete profile', async () => {
    mockLogin.mockResolvedValue({ success: true, needsProfileCompletion: false });
    const user = { email: 'a@x.com', isEmailVerified: true, isProfileComplete: true, userType: 'student' };
    const userParam = encodeURIComponent(JSON.stringify(user));
    renderWithSearch(`?success=true&token=abcdefghij&user=${userParam}`);
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true }));
  });

  it('redirects admin to dashboard after login', async () => {
    mockLogin.mockResolvedValue({ success: true, needsProfileCompletion: false });
    const user = { email: 'admin@x.com', isEmailVerified: true, isProfileComplete: true, userType: 'admin' };
    const userParam = encodeURIComponent(JSON.stringify(user));
    renderWithSearch(`?success=true&token=abcdefghij&user=${userParam}`);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true }));
  });

  it('redirects new user needing profile completion to /about-you', async () => {
    mockLogin.mockResolvedValue({ success: true, needsProfileCompletion: true });
    const user = { email: 'a@x.com', isEmailVerified: true, isProfileComplete: false };
    const userParam = encodeURIComponent(JSON.stringify(user));
    renderWithSearch(`?success=true&token=abcdefghij&user=${userParam}`);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/about-you', expect.any(Object)));
  });

  it('shows error when user JSON is malformed', async () => {
    renderWithSearch('?success=true&token=abcdefghij&user=%7Bnot-json');
    expect(await screen.findByText(/Invalid user data/i)).toBeInTheDocument();
  });
});
