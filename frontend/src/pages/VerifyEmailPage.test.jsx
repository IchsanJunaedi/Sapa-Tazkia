import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerifyEmailPage from './VerifyEmailPage';
import api from '../api/axiosConfig';
import { useAuth } from '../context/AuthContext';

// Mock dependencies
jest.mock('../api/axiosConfig');
jest.mock('../context/AuthContext');

const mockNavigate = jest.fn();
let mockLocationState = { email: 'test@example.com' };

jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
  useLocation: () => ({ state: mockLocationState }),
}));

describe('VerifyEmailPage', () => {
  let mockLogin;

  beforeEach(() => {
    jest.clearAllMocks();
    mockLocationState = { email: 'test@example.com' };
    mockLogin = jest.fn();
    useAuth.mockReturnValue({
      login: mockLogin,
    });
    
    // Mock localStorage
    const localStorageMock = (function() {
      let store = {};
      return {
        getItem: jest.fn(key => store[key] || null),
        setItem: jest.fn((key, value) => { store[key] = value.toString(); }),
        removeItem: jest.fn(key => { delete store[key]; }),
        clear: jest.fn(() => { store = {}; })
      };
    })();
    Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });
  });

  test('redirects to login if no email is provided', () => {
    mockLocationState = {};
    window.localStorage.getItem.mockReturnValue(null);

    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.any(Object));
  });

  test('renders email from location state', () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    expect(screen.getByText(/test@example.com/i)).toBeInTheDocument();
  });

  test('handles numeric input and auto-focus', () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    
    fireEvent.change(inputs[0], { target: { value: '1' } });
    expect(inputs[0].value).toBe('1');
    fireEvent.change(inputs[1], { target: { value: '2' } });
    expect(inputs[1].value).toBe('2');
  });

  test('handles paste of 6-digit code', async () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    
    const pasteData = {
      clipboardData: {
        getData: () => '123456',
      },
      preventDefault: jest.fn(),
    };

    fireEvent.paste(inputs[0], pasteData);

    await waitFor(() => {
      expect(inputs[0].value).toBe('1');
      expect(inputs[5].value).toBe('6');
    });
  });

  test('handles successful verification and redirects to AboutYou', async () => {
    api.post.mockResolvedValue({
      data: {
        success: true,
        token: 'fake-token',
        user: { id: 1, email: 'test@example.com', isProfileComplete: false },
        requiresProfileCompletion: true,
      },
    });

    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 5; i++) {
      fireEvent.change(inputs[i], { target: { value: String(i + 1) } });
    }
    fireEvent.change(inputs[5], { target: { value: '6' } });

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/verify-email', expect.any(Object));
    });

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalled();
    }, { timeout: 3000 });

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/about-you', expect.any(Object));
    }, { timeout: 3000 });
  });

  test('shows error message on failed verification', async () => {
    api.post.mockRejectedValue({
      response: {
        data: { message: 'Kode tidak valid' },
      },
    });

    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const inputs = screen.getAllByRole('textbox');
    for (let i = 0; i < 6; i++) {
      fireEvent.change(inputs[i], { target: { value: '1' } });
    }

    expect(await screen.findByText(/Kode tidak valid/i)).toBeInTheDocument();
  });

  test('handles resend code', async () => {
    api.post.mockResolvedValue({
      data: { success: true },
    });

    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const resendButton = screen.getByRole('button', { name: /Kirim Ulang/i });
    fireEvent.click(resendButton);

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/resend-verification', {
        email: 'test@example.com',
      });
    });

    expect(await screen.findByText(/Kode verifikasi baru telah dikirim/i)).toBeInTheDocument();
  });

  test('handles back button', () => {
    render(
      <MemoryRouter>
        <VerifyEmailPage />
      </MemoryRouter>
    );

    const backButton = screen.getByRole('button', { name: /Kembali/i });
    fireEvent.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith('/login', expect.any(Object));
  });
});
