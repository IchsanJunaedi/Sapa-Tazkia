import { describe, test, expect, beforeEach, jest } from '@jest/globals';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LandingPage from './LandingPage';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

// Mock framer-motion
jest.mock('framer-motion', () => ({
  motion: {
    div: ({ children, className, onClick, ...props }) => <div className={className} onClick={onClick} {...props}>{children}</div>,
    h1: ({ children, className, ...props }) => <h1 className={className} {...props}>{children}</h1>,
    p: ({ children, className, ...props }) => <p className={className} {...props}>{children}</p>,
    button: ({ children, className, onClick, ...props }) => <button className={className} onClick={onClick} {...props}>{children}</button>,
    span: ({ children, className, ...props }) => <span className={className} {...props}>{children}</span>,
  },
  AnimatePresence: ({ children }) => <>{children}</>,
}));

// Mock components
jest.mock('../components/common/NotificationDropdown', () => () => <div data-testid="notification-dropdown" />);
jest.mock('../components/common/RateLimitStatus', () => () => <div data-testid="rate-limit-status" />);
jest.mock('../components/chat/SuggestedPromptCards', () => () => <div data-testid="suggested-prompts" />);
// SideBar is external
jest.mock('../components/layout/SideBar', () => ({ onLogin, onNewChat }) => (
  <div data-testid="sidebar">
    <button onClick={onLogin}>LOG IN SIDEBAR</button>
    <button onClick={onNewChat}>New chat</button>
  </div>
));

// Mock dependencies
jest.mock('../api/axiosConfig');
jest.mock('../context/AuthContext');
jest.mock('sweetalert2', () => ({
  fire: jest.fn(),
}));

const mockNavigate = jest.fn();

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/', search: '', state: {} }),
  useSearchParams: jest.fn(),
}));

// Mock window
const originalLocation = window.location;
delete window.location;
window.location = { ...originalLocation, search: '', href: '', history: { replaceState: jest.fn() } };
window.history.replaceState = jest.fn();
Object.defineProperty(window, 'innerWidth', { writable: true, configurable: true, value: 1024 });

describe('LandingPage', () => {
  let mockLogout;
  let mockHandleGoogleAuthCallback;
  let mockNeedsProfileCompletion;

  beforeEach(() => {
    jest.clearAllMocks();
    window.location.search = '';
    
    mockLogout = jest.fn();
    mockHandleGoogleAuthCallback = jest.fn();
    mockNeedsProfileCompletion = jest.fn().mockReturnValue(false);
    
    useAuth.mockReturnValue({
      user: null,
      logout: mockLogout,
      loading: false,
      isAuthenticated: false,
      handleGoogleAuthCallback: mockHandleGoogleAuthCallback,
      needsProfileCompletion: mockNeedsProfileCompletion,
      pendingVerification: false,
      pendingEmail: null,
    });

    api.get.mockResolvedValue({ data: { conversations: [] } });
    Swal.fire.mockReturnValue(Promise.resolve({ isConfirmed: true }));
    
    window.IntersectionObserver = jest.fn().mockImplementation(() => ({
      observe: () => null,
      unobserve: () => null,
      disconnect: () => null,
    }));

    const { useSearchParams } = require('react-router-dom');
    useSearchParams.mockReturnValue([new URLSearchParams(''), jest.fn()]);
  });

  test('renders correctly for non-authenticated user', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // Look for Sapa Tazkia (logo alt text)
    expect(await screen.findByAltText(/Sapa Tazkia Logo/i)).toBeInTheDocument();
    
    // Look for any of the possible guest greetings using regex
    const guestGreetingsRegex = /Selamat datang|Di mana sebaiknya|mari kita mulai|Senang Anda berkunjung|Kami siap membantu/i;
    expect(screen.getByText(guestGreetingsRegex)).toBeInTheDocument();
  });

  test('opens auth modal when SIGN IN is clicked', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // Header sign in button
    const signInButton = await screen.findByRole('button', { name: /^SIGN IN$/i });
    fireEvent.click(signInButton);

    // AuthModal is internal, look for its content
    expect(await screen.findByText(/Log in or sign up/i)).toBeInTheDocument();
  });

  test('handles successful Google Auth callback', async () => {
    window.location.search = '?token=fake-token&user={"id":1}&success=true';
    mockHandleGoogleAuthCallback.mockResolvedValue({ success: true });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockHandleGoogleAuthCallback).toHaveBeenCalled();
    });
  });

  test('shows error when Google Auth fails with invalid domain', async () => {
    window.location.search = '?auth_error=invalid_domain&email=test@gmail.com';

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalled();
    });
  });

  test('renders user specific content when authenticated', async () => {
    useAuth.mockReturnValue({
      user: { id: 1, fullName: 'John Doe', isProfileComplete: true },
      isAuthenticated: true,
      loading: false,
      needsProfileCompletion: mockNeedsProfileCompletion,
    });
    api.get.mockResolvedValue({ data: { conversations: [{ id: 1, title: 'Test Chat' }] } });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // The greeting should now contain John
    await waitFor(() => {
      expect(screen.getByText(/John/i)).toBeInTheDocument();
    });
  });

  test('redirects to profile completion if needed', async () => {
    mockNeedsProfileCompletion.mockReturnValue(true);
    useAuth.mockReturnValue({
      user: { id: 1, isProfileComplete: false },
      isAuthenticated: true,
      loading: false,
      needsProfileCompletion: mockNeedsProfileCompletion,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalled();
    });
  });

  test('handles message input and send', async () => {
    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    const input = screen.getByPlaceholderText(/Message Sapa Tazkia/i);
    fireEvent.change(input, { target: { value: 'Hello AI' } });
    
    const sendButton = screen.getByLabelText(/Send Message/i);
    fireEvent.click(sendButton);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/chat/new', expect.objectContaining({
        state: expect.objectContaining({ initialMessage: 'Hello AI' })
      }));
    });
  });

  test('handles AuthModal registration with verification', async () => {
    const mockRegisterWithEmail = jest.fn().mockResolvedValue({ requiresVerification: true });
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      registerWithEmail: mockRegisterWithEmail,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /^SIGN IN$/i }));

    const input = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(input, { target: { value: 'test@student.tazkia.ac.id' } });
    
    // Use getByText with selector to be more specific or find the one inside the form
    const continueButton = screen.getByText('Lanjutkan', { selector: 'button' });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(mockRegisterWithEmail).toHaveBeenCalledWith('test@student.tazkia.ac.id');
    });

    // Should move to verification step
    expect(await screen.findByText(/Cek email kamu/i)).toBeInTheDocument();
  });

  test('handles VerificationForm submission', async () => {
    const mockVerifyEmailCode = jest.fn().mockResolvedValue({ success: true });
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      pendingVerification: true,
      pendingEmail: 'test@student.tazkia.ac.id',
      verifyEmailCode: mockVerifyEmailCode,
      clearPendingVerification: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    // Modal should auto-open for pending verification
    const otpInput = await screen.findByPlaceholderText(/Masukkan kode 6 digit/i);
    fireEvent.change(otpInput, { target: { value: '123456' } });
    
    const verifyButton = screen.getByText('Verifikasi', { selector: 'button' });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith('test@student.tazkia.ac.id', '123456');
    });
  });

  test('handles resending verification code', async () => {
    const mockResendVerificationCode = jest.fn().mockResolvedValue({ success: true });
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      pendingVerification: true,
      pendingEmail: 'test@student.tazkia.ac.id',
      resendVerificationCode: mockResendVerificationCode,
      clearPendingVerification: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    const resendButton = await screen.findByRole('button', { name: /Kirim Ulang/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockResendVerificationCode).toHaveBeenCalledWith('test@student.tazkia.ac.id');
    });
    
    expect(await screen.findByText(/Kode verifikasi telah dikirim ulang!/i)).toBeInTheDocument();
  });

  test('shows SweetAlert when email is already registered', async () => {
    const mockRegisterWithEmail = jest.fn().mockRejectedValue(new Error('Email already registered'));
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      registerWithEmail: mockRegisterWithEmail,
      clearPendingVerification: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /^SIGN IN$/i }));

    const input = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(input, { target: { value: 'test@student.tazkia.ac.id' } });
    
    const continueButton = screen.getByText('Lanjutkan', { selector: 'button' });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalledWith(expect.objectContaining({
        title: expect.stringMatching(/Email Sudah Terdaftar!/i),
      }));
    });
  });

  test('redirects admin to dashboard', async () => {
    useAuth.mockReturnValue({
      user: { id: 1, userType: 'admin' },
      isAuthenticated: true,
      loading: false,
      needsProfileCompletion: () => false,
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true });
    });
  });


  test('VerificationForm handles resend', async () => {
    const mockResend = jest.fn().mockResolvedValue({ success: true });
    useAuth.mockReturnValue({
      user: null,
      isAuthenticated: false,
      loading: false,
      registerWithEmail: jest.fn().mockResolvedValue({ requiresVerification: true }),
      resendVerificationCode: mockResend,
      clearPendingVerification: jest.fn(),
    });

    render(
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: /^SIGN IN$/i }));

    const input = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(input, { target: { value: 'test@student.tazkia.ac.id' } });
    fireEvent.click(screen.getByText('Lanjutkan', { selector: 'button' }));

    // Wait for step 1 (verification)
    const resendBtn = await screen.findByRole('button', { name: /Kirim Ulang/i });
    fireEvent.click(resendBtn);
    
    await waitFor(() => {
      expect(mockResend).toHaveBeenCalled();
    });
  });

});
