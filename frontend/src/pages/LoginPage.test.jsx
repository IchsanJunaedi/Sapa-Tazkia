import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from './LoginPage';
import { useAuth } from '../context/AuthContext';
import Swal from 'sweetalert2';

// Mock dependencies
jest.mock('../context/AuthContext');
jest.mock('sweetalert2', () => ({
  fire: jest.fn(),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ pathname: '/login', state: {} }),
}));

describe('LoginPage', () => {
  let mockLoginWithCredentials;
  let mockRegisterWithEmail;
  let mockVerifyEmailCode;
  let mockResendVerificationCode;
  let mockClearPendingVerification;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLoginWithCredentials = jest.fn();
    mockRegisterWithEmail = jest.fn();
    mockVerifyEmailCode = jest.fn();
    mockResendVerificationCode = jest.fn();
    mockClearPendingVerification = jest.fn();

    useAuth.mockReturnValue({
      loginWithCredentials: mockLoginWithCredentials,
      registerWithEmail: mockRegisterWithEmail,
      verifyEmailCode: mockVerifyEmailCode,
      resendVerificationCode: mockResendVerificationCode,
      clearPendingVerification: mockClearPendingVerification,
      pendingVerification: false,
      pendingEmail: null,
      isAuthenticated: false,
      loading: false,
      user: null,
    });

    // Mock window.location.href
    delete window.location;
    window.location = { href: '' };
  });

  test('redirects if already authenticated', () => {
    useAuth.mockReturnValue({
      isAuthenticated: true,
      loading: false,
      user: { userType: 'student' },
    });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/chat', { replace: true });
  });

  test('handles Google Login click', () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const googleButton = screen.getByText(/Lanjutkan dengan Google/i);
    fireEvent.click(googleButton);

    expect(window.location.href).toContain('/auth/google');
  });

  test('handles email login flow (requires verification)', async () => {
    mockRegisterWithEmail.mockResolvedValue({ requiresVerification: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(emailInput, { target: { value: 'test@student.tazkia.ac.id' } });
    
    const continueButton = screen.getByRole('button', { name: /^Lanjutkan$/i });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(mockRegisterWithEmail).toHaveBeenCalledWith('test@student.tazkia.ac.id');
    });

    expect(await screen.findByText(/Cek email kamu/i)).toBeInTheDocument();
  });

  test('handles NIM login flow (direct login)', async () => {
    mockLoginWithCredentials.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const nimInput = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(nimInput, { target: { value: '123456' } });
    
    const continueButton = screen.getByRole('button', { name: /^Lanjutkan$/i });
    fireEvent.click(continueButton);

    await waitFor(() => {
      expect(mockLoginWithCredentials).toHaveBeenCalledWith('123456', '123456');
    });

    expect(await screen.findByText(/Autentikasi berhasil/i)).toBeInTheDocument();
  });

  test('shows error for invalid email domain', async () => {
    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const emailInput = screen.getByPlaceholderText(/Email atau NIM/i);
    fireEvent.change(emailInput, { target: { value: 'test@gmail.com' } });
    
    const continueButton = screen.getByRole('button', { name: /^Lanjutkan$/i });
    fireEvent.click(continueButton);

    expect(await screen.findByText(/Silakan gunakan email Tazkia/i)).toBeInTheDocument();
  });

  test('handles verification code submission', async () => {
    mockRegisterWithEmail.mockResolvedValue({ requiresVerification: true });
    mockVerifyEmailCode.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    // Step 0
    fireEvent.change(screen.getByPlaceholderText(/Email atau NIM/i), { target: { value: 'test@tazkia.ac.id' } });
    fireEvent.click(screen.getByRole('button', { name: /^Lanjutkan$/i }));

    // Step 1
    const codeInput = await screen.findByPlaceholderText(/Masukkan kode 6 digit/i);
    fireEvent.change(codeInput, { target: { value: '123456' } });
    
    const verifyButton = screen.getByRole('button', { name: /Verifikasi/i });
    fireEvent.click(verifyButton);

    await waitFor(() => {
      expect(mockVerifyEmailCode).toHaveBeenCalledWith('test@tazkia.ac.id', '123456');
    });
  });

  test('handles resend code', async () => {
    useAuth.mockReturnValue({
      pendingVerification: true,
      pendingEmail: 'test@tazkia.ac.id',
      resendVerificationCode: mockResendVerificationCode,
      isAuthenticated: false,
      loading: false,
    });

    mockResendVerificationCode.mockResolvedValue({ success: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    const resendButton = await screen.findByText(/Kirim Ulang/i);
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(mockResendVerificationCode).toHaveBeenCalledWith('test@tazkia.ac.id');
    });

    expect(await screen.findByText(/Kode verifikasi telah dikirim ulang/i)).toBeInTheDocument();
  });

  test('handles "already registered" Swal', async () => {
    mockRegisterWithEmail.mockRejectedValue(new Error('Email already registered'));
    Swal.fire.mockResolvedValue({ isConfirmed: true });

    render(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>
    );

    fireEvent.change(screen.getByPlaceholderText(/Email atau NIM/i), { target: { value: 'test@tazkia.ac.id' } });
    fireEvent.click(screen.getByRole('button', { name: /^Lanjutkan$/i }));

    await waitFor(() => {
      expect(Swal.fire).toHaveBeenCalled();
    });
  });
});
