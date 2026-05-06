import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import axios from 'axios';

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: () => mockNavigate,
}));

const mockLogin = jest.fn();
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

import AdminLogin from './AdminLogin';

const renderPage = () => render(<MemoryRouter><AdminLogin /></MemoryRouter>);

const setEmail = (v) => fireEvent.change(screen.getByPlaceholderText(/sapa@stmik/i), { target: { value: v } });
const setPwd = (v) => fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: v } });
const submitCreds = () => fireEvent.click(screen.getByRole('button', { name: /Masuk ke Dashboard/i }));

beforeEach(() => {
  axios.post.mockReset();
  mockNavigate.mockReset();
  mockLogin.mockReset();
  localStorage.clear();
});

afterEach(() => jest.clearAllMocks());

describe('AdminLogin', () => {
  it('renders credentials step initially', () => {
    renderPage();
    expect(screen.getByPlaceholderText(/sapa@stmik/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('••••••••')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Masuk ke Dashboard/i })).toBeInTheDocument();
  });

  it('redirects to dashboard if admin user already in storage', () => {
    localStorage.setItem('user', JSON.stringify({ userType: 'admin' }));
    renderPage();
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true });
  });

  it('handles invalid JSON in localStorage gracefully', () => {
    localStorage.setItem('user', 'not-json');
    renderPage();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('toggles password visibility', () => {
    renderPage();
    const pwd = screen.getByPlaceholderText('••••••••');
    expect(pwd).toHaveAttribute('type', 'password');
    fireEvent.click(pwd.parentElement.querySelector('button'));
    expect(pwd).toHaveAttribute('type', 'text');
  });

  it('logs in admin user when credentials valid', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, token: 'tok', user: { userType: 'admin' } },
    });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('tok', { userType: 'admin' }));
    expect(mockNavigate).toHaveBeenCalledWith('/admin/dashboard', { replace: true });
  });

  it('rejects non-admin login', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, token: 'tok', user: { userType: 'student' } },
    });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    expect(await screen.findByText(/Akses ditolak/i)).toBeInTheDocument();
  });

  it('switches to TOTP step when 2FA required', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, requiresTwoFactor: true, tempToken: 'tt' },
    });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    expect(await screen.findByText(/Verifikasi 2 Langkah/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/123456/)).toBeInTheDocument();
  });

  it('shows error when TOTP code is incomplete', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, requiresTwoFactor: true, tempToken: 'tt' },
    });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    await screen.findByPlaceholderText(/123456/);
    fireEvent.change(screen.getByPlaceholderText(/123456/), { target: { value: '123' } });
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi/i }));
    expect(await screen.findByText(/Masukkan kode 6 digit dari aplikasi authenticator/)).toBeInTheDocument();
  });

  it('verifies TOTP successfully and logs in', async () => {
    axios.post
      .mockResolvedValueOnce({ data: { success: true, requiresTwoFactor: true, tempToken: 'tt' } })
      .mockResolvedValueOnce({ data: { success: true, token: 'tok', user: { userType: 'admin' } } });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    await screen.findByPlaceholderText(/123456/);
    fireEvent.change(screen.getByPlaceholderText(/123456/), { target: { value: '123456' } });
    fireEvent.click(screen.getByRole('button', { name: /Verifikasi/i }));
    await waitFor(() => expect(mockLogin).toHaveBeenCalled());
  });

  it('returns to credentials from TOTP step', async () => {
    axios.post.mockResolvedValue({
      data: { success: true, requiresTwoFactor: true, tempToken: 'tt' },
    });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    await screen.findByPlaceholderText(/123456/);
    fireEvent.click(screen.getByText(/Kembali ke login/i));
    expect(screen.getByPlaceholderText(/sapa@stmik/i)).toBeInTheDocument();
  });

  it('shows API error message on failure', async () => {
    axios.post.mockRejectedValue({ response: { data: { message: 'Invalid creds' } } });
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    expect(await screen.findByText(/Invalid creds/i)).toBeInTheDocument();
  });

  it('shows generic error when no response', async () => {
    axios.post.mockRejectedValue(new Error('net'));
    renderPage();
    setEmail('a@x.com');
    setPwd('pw');
    submitCreds();
    expect(await screen.findByText(/Terjadi kesalahan/i)).toBeInTheDocument();
  });
});
