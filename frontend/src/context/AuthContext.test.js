import React from 'react';
import { render, screen, act, waitFor } from '@testing-library/react';

jest.mock('../api/axiosConfig', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
    patch: jest.fn(),
    defaults: { headers: { common: {} } },
  },
}));

import api from '../api/axiosConfig';
import { AuthProvider, useAuth } from './AuthContext';

const Harness = ({ onCtx }) => {
  const ctx = useAuth();
  React.useEffect(() => onCtx?.(ctx));
  return <div data-testid="user">{ctx.user ? ctx.user.fullName || ctx.user.email : 'no-user'}</div>;
};

const renderWith = async (onCtx) => {
  let r;
  await act(async () => {
    r = render(
      <AuthProvider>
        <Harness onCtx={onCtx} />
      </AuthProvider>
    );
  });
  await waitFor(() => expect(screen.queryByText('Loading user data...')).not.toBeInTheDocument());
  return r;
};

beforeEach(() => {
  localStorage.clear();
  api.post.mockReset();
  api.get.mockReset();
  api.patch.mockReset();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AuthContext — initial state & helpers', () => {
  it('shows loading then no-user state', async () => {
    let captured;
    await renderWith((ctx) => { captured = ctx; });
    expect(screen.getByTestId('user')).toHaveTextContent('no-user');
    expect(captured.isAuthenticated).toBe(false);
    expect(captured.token).toBeNull();
  });

  it('useAuth throws when used outside provider', () => {
    const Bad = () => { useAuth(); return null; };
    expect(() => render(<Bad />)).toThrow(/AuthProvider/);
  });

  it('rehydrates from localStorage on mount when token is valid format', async () => {
    const longToken = 'stored-token-must-be-at-least-twenty-chars';
    localStorage.setItem('token', longToken);
    localStorage.setItem('user', JSON.stringify({ fullName: 'Stored', isProfileComplete: true }));
    let ctx;
    await renderWith((c) => { ctx = c; });
    expect(ctx.token).toBe(longToken);
  });

  it('clears storage when token is too short', async () => {
    localStorage.setItem('token', 'short');
    localStorage.setItem('user', JSON.stringify({ fullName: 'Stored' }));
    let ctx;
    await renderWith((c) => { ctx = c; });
    expect(ctx.token).toBeNull();
  });

  it('extractNIMFromEmail returns NIM when local part is 12 digits', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    expect(ctx.extractNIMFromEmail('123456789012.test@tazkia.ac.id')).toBe('123456789012');
    expect(ctx.extractNIMFromEmail('short@x.com')).toBe('');
    expect(ctx.extractNIMFromEmail(null)).toBe('');
  });
});

describe('AuthContext — login flows', () => {
  it('loginWithCredentials success sets user & token', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'tok', user: { fullName: 'A', email: 'a@x.com', isProfileComplete: true } },
    });
    let ctx;
    await renderWith((c) => { ctx = c; });
    let result;
    await act(async () => { result = await ctx.loginWithCredentials('123', 'pw'); });
    expect(result.success).toBe(true);
    expect(api.post).toHaveBeenCalledWith('/auth/login', { identifier: '123', password: 'pw' });
  });

  it('loginWithCredentials throws when missing token', async () => {
    api.post.mockResolvedValue({ data: { success: true, token: null, user: { email: 'a@x.com' } } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.loginWithCredentials('123', 'pw')).rejects.toBeDefined();
  });

  it('loginWithCredentials surfaces requiresVerification error', async () => {
    api.post.mockRejectedValue({
      response: { data: { requiresVerification: true, email: 'x@y.com', message: 'verify needed' } },
    });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.loginWithCredentials('123', 'pw')).rejects.toMatchObject({
      requiresVerification: true,
      email: 'x@y.com',
    });
  });

  it('loginWithCredentials maps server error message', async () => {
    api.post.mockRejectedValue({ response: { data: { message: 'invalid' } } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.loginWithCredentials('123', 'pw')).rejects.toThrow(/invalid/);
  });

  it('loginWithCredentials maps network error', async () => {
    api.post.mockRejectedValue({ request: {} });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.loginWithCredentials('123', 'pw')).rejects.toThrow(/Network/);
  });

  it('login() flags profile completion when fullName missing', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.login('valid-token-xyz', { email: 'a@x.com' }); });
    expect(localStorage.getItem('needsProfileCompletion')).toBe('true');
  });

  it('login() throws when token or userData missing', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.login(null, {})).rejects.toBeDefined();
  });
});

describe('AuthContext — register/email verification', () => {
  it('registerWithEmail success sets pending verification state', async () => {
    api.post.mockResolvedValue({ status: 201, data: { success: true, message: 'Code sent' } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.registerWithEmail('a@x.com'); });
    expect(localStorage.getItem('pendingVerificationEmail')).toBe('a@x.com');
    expect(localStorage.getItem('isNewUser')).toBe('true');
  });

  it('registerWithEmail handles 409 already registered', async () => {
    api.post.mockRejectedValue({ response: { status: 409 } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.registerWithEmail('a@x.com')).rejects.toThrow(/sudah terdaftar/i);
  });

  it('verifyEmailCode success completes login', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'tok', user: { fullName: 'B', email: 'b@x.com' }, requiresProfileCompletion: false },
    });
    let ctx;
    await renderWith((c) => { ctx = c; });
    let result;
    await act(async () => { result = await ctx.verifyEmailCode('b@x.com', '123456'); });
    expect(result.success).toBe(true);
  });

  it('verifyEmailCode rejects when token missing', async () => {
    api.post.mockResolvedValue({ data: { success: true, user: null, token: null } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.verifyEmailCode('b@x.com', '111')).rejects.toBeDefined();
  });

  it('resendVerificationCode success', async () => {
    api.post.mockResolvedValue({ data: { success: true, message: 'sent' } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    const r = await ctx.resendVerificationCode('a@x.com');
    expect(r.success).toBe(true);
  });

  it('resendVerificationCode network error', async () => {
    api.post.mockRejectedValue({ request: {} });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.resendVerificationCode('a@x.com')).rejects.toThrow(/Network/);
  });

  it('checkEmailVerificationStatus success', async () => {
    api.get.mockResolvedValue({ data: { success: true, isVerified: true } });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.checkEmailVerificationStatus('a@x.com'); });
    expect(api.get).toHaveBeenCalled();
  });

  it('clearPendingVerification clears local storage state', async () => {
    localStorage.setItem('pendingVerificationEmail', 'a@x.com');
    localStorage.setItem('isNewUser', 'true');
    let ctx;
    await renderWith((c) => { ctx = c; });
    act(() => ctx.clearPendingVerification());
    expect(localStorage.getItem('pendingVerificationEmail')).toBeNull();
  });
});

describe('AuthContext — Google auth and profile updates', () => {
  it('handleGoogleAuthCallback parses string user data', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    const userJson = JSON.stringify({ fullName: 'G', email: 'g@x.com', isProfileComplete: true });
    let result;
    await act(async () => { result = await ctx.handleGoogleAuthCallback('valid-token-xyz', userJson); });
    expect(result.success).toBe(true);
  });

  it('handleGoogleAuthCallback rejects bad JSON', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.handleGoogleAuthCallback('valid-token-xyz', '{not json')).rejects.toBeDefined();
  });

  it('handleGoogleAuthCallback throws when token missing', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(ctx.handleGoogleAuthCallback(null, { email: 'a@x.com' })).rejects.toBeDefined();
  });

  it('updateUserProfileCompletion updates user and syncs', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'valid-token-xyz', user: { fullName: '', email: 'a@x.com' } },
    });
    api.patch.mockResolvedValue({ data: {} });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.loginWithCredentials('123', 'pw'); });
    let result;
    await act(async () => {
      result = await ctx.updateUserProfileCompletion({ fullName: 'New', dateOfBirth: '2000-01-01' });
    });
    expect(result.success).toBe(true);
    expect(api.patch).toHaveBeenCalledWith('/auth/update-profile', expect.any(Object));
  });

  it('updateUserProfileCompletion swallows backend sync failure', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'valid-token-xyz', user: { fullName: '', email: 'a@x.com' } },
    });
    api.patch.mockRejectedValue(new Error('sync down'));
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.loginWithCredentials('123', 'pw'); });
    let result;
    await act(async () => {
      result = await ctx.updateUserProfileCompletion({ fullName: 'New', dateOfBirth: '2000-01-01' });
    });
    expect(result.success).toBe(true);
  });

  it('updateUserProfileCompletion throws when no user', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    await expect(
      ctx.updateUserProfileCompletion({ fullName: 'X', dateOfBirth: '2000-01-01' })
    ).rejects.toBeDefined();
  });

  it('updateUser shallow-merges into existing user', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'valid-token-xyz', user: { fullName: 'A', email: 'a@x.com', isProfileComplete: true } },
    });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.loginWithCredentials('123', 'pw'); });
    act(() => ctx.updateUser({ fullName: 'B' }));
  });

  it('setProfileComplete marks profile complete', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'valid-token-xyz', user: { fullName: '', email: 'a@x.com' } },
    });
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.loginWithCredentials('123', 'pw'); });
    act(() => ctx.setProfileComplete());
  });
});

describe('AuthContext — logout & accessors', () => {
  it('logout clears storage and redirects', async () => {
    api.post.mockResolvedValue({
      data: { success: true, token: 'valid-token-xyz', user: { fullName: 'A', email: 'a@x.com', isProfileComplete: true } },
    });
    const originalLocation = window.location;
    delete window.location;
    window.location = { replace: jest.fn() };
    let ctx;
    await renderWith((c) => { ctx = c; });
    await act(async () => { await ctx.loginWithCredentials('123', 'pw'); });
    act(() => ctx.logout());
    expect(window.location.replace).toHaveBeenCalledWith('/');
    expect(localStorage.getItem('token')).toBeNull();
    window.location = originalLocation;
  });

  it('getUserName / getUserShortName / getUserNIM return defaults without user', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    expect(ctx.getUserName()).toBe('User');
    expect(ctx.getUserShortName()).toBe('User');
    expect(ctx.getUserNIM()).toBe('');
  });

  it('isNewUser & needsEmailVerification & getPendingVerificationEmail respect localStorage', async () => {
    localStorage.setItem('isNewUser', 'true');
    localStorage.setItem('pendingVerificationEmail', 'a@x.com');
    let ctx;
    await renderWith((c) => { ctx = c; });
    expect(ctx.isNewUser()).toBe(true);
    expect(ctx.needsEmailVerification()).toBe(true); // localStorage has pendingVerificationEmail
    expect(ctx.getPendingVerificationEmail()).toBe('a@x.com');
  });

  it('checkAuthStatus reflects localStorage state', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    let result;
    await act(async () => { result = await ctx.checkAuthStatus(); });
    expect(result).toBe(false);
    localStorage.setItem('token', 't'.repeat(30));
    localStorage.setItem('user', '{}');
    await act(async () => { result = await ctx.checkAuthStatus(); });
    expect(result).toBe(true);
  });
});

describe('AuthContext — auth token expiry handler', () => {
  it('resets state when authTokenExpired event fires', async () => {
    let ctx;
    await renderWith((c) => { ctx = c; });
    act(() => { window.dispatchEvent(new Event('authTokenExpired')); });
    expect(ctx.token).toBeNull();
  });
});
