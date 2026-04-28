// backend/tests/unit/authController.unit.test.js
//
// Unit tests for authController — fully mocks dependent services.

jest.mock('../../src/services/authService', () => ({
  passport: { authenticate: jest.fn(() => (req, res, next) => next()) },
  generateToken: jest.fn(() => 'token123'),
  generateRefreshToken: jest.fn(() => 'refresh123'),
  verifyToken: jest.fn(),
  verifyRefreshToken: jest.fn(),
  verifySession: jest.fn(),
  verifyEmailCode: jest.fn(),
  resendVerificationCode: jest.fn(),
  register: jest.fn(),
  registerWithEmail: jest.fn(),
  login: jest.fn(),
  logout: jest.fn(),
  logoutAllUserSessions: jest.fn().mockResolvedValue(),
  createSession: jest.fn().mockResolvedValue(),
  getUserById: jest.fn(),
  updateUserVerification: jest.fn(),
  updateUserProfile: jest.fn(),
  checkNIMAvailability: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  changePassword: jest.fn(),
  issueSessionToken: jest.fn(),
}));

jest.mock('../../src/services/academicService', () => ({
  validateStudent: jest.fn(),
}));

jest.mock('../../src/services/emailService', () => ({
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/ragService', () => ({
  answerQuestion: jest.fn(),
}));

jest.mock('../../src/services/openaiService', () => ({
  generateAIResponse: jest.fn(),
  testOpenAIConnection: jest.fn(),
  generateTitle: jest.fn(),
  isGreeting: jest.fn(),
}));

jest.mock('../../src/config/prismaClient', () => ({
  user: { findUnique: jest.fn() },
}));

const authService = require('../../src/services/authService');
const academicService = require('../../src/services/academicService');
const emailService = require('../../src/services/emailService');
const prisma = require('../../src/config/prismaClient');
const ctrl = require('../../src/controllers/authController');

const buildRes = () => {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.redirect = jest.fn(() => res);
  return res;
};

beforeEach(() => jest.clearAllMocks());

// =============================================================================
describe('healthCheck', () => {
  it('returns ok status', () => {
    const res = buildRes();
    ctrl.healthCheck({}, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });
});

describe('checkAuth', () => {
  it('uses isAuthenticated when present', () => {
    const res = buildRes();
    ctrl.checkAuth({ isAuthenticated: () => true, user: { id: 1 } }, res);
    expect(res.json).toHaveBeenCalledWith({ authenticated: true, user: { id: 1 } });
  });

  it('returns false when no isAuthenticated', () => {
    const res = buildRes();
    ctrl.checkAuth({}, res);
    expect(res.json).toHaveBeenCalledWith({ authenticated: false, user: null });
  });
});

// =============================================================================
describe('verifyEmailCode', () => {
  it('returns 400 when fields missing', async () => {
    const res = buildRes();
    await ctrl.verifyEmailCode({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when code is not 6 digits', async () => {
    const res = buildRes();
    await ctrl.verifyEmailCode({ body: { email: 'a@x.com', code: 'abcdef' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 + user on success', async () => {
    authService.verifyEmailCode.mockResolvedValueOnce({
      success: true, message: 'ok', token: 't', user: { id: 1, isProfileComplete: false },
    });
    const res = buildRes();
    await ctrl.verifyEmailCode({ body: { email: 'a@x.com', code: '123456' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
    expect(emailService.sendWelcomeEmail).toHaveBeenCalled();
  });

  it('returns 400 when service returns success=false', async () => {
    authService.verifyEmailCode.mockResolvedValueOnce({ success: false, message: 'invalid' });
    const res = buildRes();
    await ctrl.verifyEmailCode({ body: { email: 'a@x.com', code: '123456' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 429 when service throws "Terlalu banyak"', async () => {
    authService.verifyEmailCode.mockRejectedValueOnce(new Error('Terlalu banyak percobaan'));
    const res = buildRes();
    await ctrl.verifyEmailCode({ body: { email: 'a@x.com', code: '123456' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });
});

// =============================================================================
describe('resendVerificationCode', () => {
  it('returns 400 when email missing', async () => {
    const res = buildRes();
    await ctrl.resendVerificationCode({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 on success', async () => {
    authService.resendVerificationCode.mockResolvedValueOnce({ success: true, message: 'sent' });
    const res = buildRes();
    await ctrl.resendVerificationCode({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 400 when service throws "Email sudah terverifikasi"', async () => {
    authService.resendVerificationCode.mockRejectedValueOnce(new Error('Email sudah terverifikasi'));
    const res = buildRes();
    await ctrl.resendVerificationCode({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on generic error', async () => {
    authService.resendVerificationCode.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.resendVerificationCode({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('checkEmailVerification', () => {
  it('returns 400 when no email', async () => {
    const res = buildRes();
    await ctrl.checkEmailVerification({ params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 404 when user not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.checkEmailVerification({ params: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it('returns 200 + verification status', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', isEmailVerified: false, status: 'active',
      verificationCodeExpires: new Date(Date.now() + 60000),
    });
    const res = buildRes();
    await ctrl.checkEmailVerification({ params: { email: 'a@x.com' } }, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ hasActiveVerification: true }),
      }),
    );
  });

  it('returns 500 on prisma error', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.checkEmailVerification({ params: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('register', () => {
  it('returns 400 when fields missing', async () => {
    const res = buildRes();
    await ctrl.register({ body: { email: 'a' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 201 with requiresVerification', async () => {
    authService.register.mockResolvedValueOnce({
      success: true, requiresVerification: true, message: 'ok', data: { email: 'a@x.com' },
    });
    const res = buildRes();
    await ctrl.register({ body: { fullName: 'a', nim: 'b', email: 'c', password: 'd' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 201 without requiresVerification', async () => {
    authService.register.mockResolvedValueOnce({ success: true, token: 't' });
    const res = buildRes();
    await ctrl.register({ body: { fullName: 'a', nim: 'b', email: 'c', password: 'd' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when service returns success=false', async () => {
    authService.register.mockResolvedValueOnce({ success: false });
    const res = buildRes();
    await ctrl.register({ body: { fullName: 'a', nim: 'b', email: 'c', password: 'd' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on service error', async () => {
    authService.register.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.register({ body: { fullName: 'a', nim: 'b', email: 'c', password: 'd' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('registerWithEmail', () => {
  it('returns 400 when email missing', async () => {
    const res = buildRes();
    await ctrl.registerWithEmail({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 400 when email format invalid', async () => {
    const res = buildRes();
    await ctrl.registerWithEmail({ body: { email: 'not-email' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 201 on success', async () => {
    authService.registerWithEmail.mockResolvedValueOnce({
      success: true, message: 'ok', data: { email: 'a@x.com' },
    });
    const res = buildRes();
    await ctrl.registerWithEmail({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it('returns 400 when service returns success=false', async () => {
    authService.registerWithEmail.mockResolvedValueOnce({ success: false, message: 'no' });
    const res = buildRes();
    await ctrl.registerWithEmail({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 409 when email already registered', async () => {
    authService.registerWithEmail.mockRejectedValueOnce(new Error('Email already registered'));
    const res = buildRes();
    await ctrl.registerWithEmail({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(409);
  });
});

// =============================================================================
describe('login', () => {
  it('returns 400 when fields missing', async () => {
    const res = buildRes();
    await ctrl.login({ body: {}, get: () => 'agent', ip: '1.1.1.1' }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with token on success', async () => {
    authService.login.mockResolvedValueOnce({
      success: true,
      message: 'ok',
      token: 't',
      user: {
        id: 1, nim: 'n', email: 'a@x.com', fullName: 'A', status: 'active',
        authMethod: 'nim', userType: 'user', isProfileComplete: true, isEmailVerified: true,
      },
    });
    const res = buildRes();
    await ctrl.login(
      { body: { identifier: 'n', password: 'p' }, get: () => 'agent', ip: '1.1.1.1', login: jest.fn((u, cb) => cb(null)) },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it('returns 403 when requiresVerification', async () => {
    authService.login.mockResolvedValueOnce({
      success: false, requiresVerification: true, email: 'a@x.com', message: 'verify',
    });
    const res = buildRes();
    await ctrl.login(
      { body: { identifier: 'n', password: 'p' }, get: () => 'agent', ip: '1.1.1.1' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it('returns 401 on generic failure', async () => {
    authService.login.mockResolvedValueOnce({ success: false, message: 'wrong' });
    const res = buildRes();
    await ctrl.login(
      { body: { identifier: 'n', password: 'p' }, get: () => 'agent', ip: '1.1.1.1' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 on service error', async () => {
    authService.login.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.login(
      { body: { identifier: 'n', password: 'p' }, get: () => 'agent', ip: '1.1.1.1' },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('verify', () => {
  it('returns 401 when no token', async () => {
    const res = buildRes();
    await ctrl.verify({ headers: {} }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 200 when valid', async () => {
    authService.verifySession.mockResolvedValueOnce({
      valid: true,
      user: { id: 1, nim: 'n', email: 'a@x.com', fullName: 'A', status: 'a', authMethod: 'm', userType: 'u', isProfileComplete: true, isEmailVerified: true },
    });
    const res = buildRes();
    await ctrl.verify({ headers: { authorization: 'Bearer t' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 401 when invalid', async () => {
    authService.verifySession.mockResolvedValueOnce({ valid: false, message: 'expired' });
    const res = buildRes();
    await ctrl.verify({ headers: { authorization: 'Bearer t' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 500 on service error', async () => {
    authService.verifySession.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.verify({ headers: { authorization: 'Bearer t' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('verifyStudent', () => {
  it('returns 400 when fields missing', async () => {
    const res = buildRes();
    await ctrl.verifyStudent({ body: {}, user: { id: 1 } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns success on valid student', async () => {
    academicService.validateStudent.mockResolvedValueOnce({
      valid: true, data: { nim: 'n', fullName: 'A' }, message: 'ok',
    });
    authService.updateUserVerification.mockResolvedValueOnce();
    const res = buildRes();
    await ctrl.verifyStudent(
      { body: { nim: 'n', fullName: 'A', birthDate: '2000-01-01' }, user: { id: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 400 when invalid student', async () => {
    academicService.validateStudent.mockResolvedValueOnce({ valid: false, message: 'not found' });
    const res = buildRes();
    await ctrl.verifyStudent(
      { body: { nim: 'n', fullName: 'A', birthDate: '2000-01-01' }, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 500 on service error', async () => {
    academicService.validateStudent.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.verifyStudent(
      { body: { nim: 'n', fullName: 'A', birthDate: '2000-01-01' }, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('updateVerification + updateProfile', () => {
  it('updateVerification returns 200', async () => {
    authService.updateUserVerification.mockResolvedValueOnce();
    const res = buildRes();
    await ctrl.updateVerification(
      { body: { nim: 'n', fullName: 'a' }, user: { id: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('updateVerification returns 500 on error', async () => {
    authService.updateUserVerification.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.updateVerification(
      { body: { nim: 'n', fullName: 'a' }, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('updateProfile returns 200', async () => {
    authService.updateUserProfile.mockResolvedValueOnce();
    const res = buildRes();
    await ctrl.updateProfile(
      { body: { email: 'a', nim: 'n', fullName: 'a' }, user: { id: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('updateProfile returns 500 on error', async () => {
    authService.updateUserProfile.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.updateProfile(
      { body: { email: 'a' }, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('checkNIM', () => {
  it('returns 400 when nim missing', async () => {
    const res = buildRes();
    await ctrl.checkNIM({ params: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 with availability', async () => {
    authService.checkNIMAvailability.mockResolvedValueOnce({ available: true, message: 'ok' });
    const res = buildRes();
    await ctrl.checkNIM({ params: { nim: '123' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on service error', async () => {
    authService.checkNIMAvailability.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.checkNIM({ params: { nim: '123' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('refreshToken', () => {
  it('returns 400 when refreshToken missing', async () => {
    const res = buildRes();
    await ctrl.refreshToken({ body: {} }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 401 when refresh token invalid', async () => {
    authService.verifyRefreshToken.mockReturnValueOnce(null);
    const res = buildRes();
    await ctrl.refreshToken({ body: { refreshToken: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when wrong type', async () => {
    authService.verifyRefreshToken.mockReturnValueOnce({ id: 1, type: 'access' });
    const res = buildRes();
    await ctrl.refreshToken({ body: { refreshToken: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 401 when user not found', async () => {
    authService.verifyRefreshToken.mockReturnValueOnce({ id: 1, type: 'refresh' });
    authService.getUserById.mockResolvedValueOnce(null);
    const res = buildRes();
    await ctrl.refreshToken({ body: { refreshToken: 'x' } }, res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('returns 200 with new token', async () => {
    authService.verifyRefreshToken.mockReturnValueOnce({ id: 1, type: 'refresh' });
    authService.getUserById.mockResolvedValueOnce({ id: 1 });
    const res = buildRes();
    await ctrl.refreshToken({ body: { refreshToken: 'x' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, token: 'token123' }));
  });
});

// =============================================================================
describe('forgotPassword', () => {
  it('returns 200 silently on success', async () => {
    authService.forgotPassword.mockResolvedValueOnce();
    const res = buildRes();
    await ctrl.forgotPassword({ body: { email: 'a@x.com' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 429 when service throws "Terlalu banyak"', async () => {
    authService.forgotPassword.mockRejectedValueOnce(new Error('Terlalu banyak'));
    const res = buildRes();
    await ctrl.forgotPassword({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(429);
  });

  it('returns 500 on generic error', async () => {
    authService.forgotPassword.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.forgotPassword({ body: { email: 'a@x.com' } }, res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

// =============================================================================
describe('resetPassword + changePassword', () => {
  it('resetPassword returns 200 on success', async () => {
    authService.resetPassword.mockResolvedValueOnce({ success: true });
    const res = buildRes();
    await ctrl.resetPassword({ body: { token: 't', newPassword: 'p' } }, res);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('resetPassword returns 400 on error', async () => {
    authService.resetPassword.mockRejectedValueOnce(new Error('Token tidak valid'));
    const res = buildRes();
    await ctrl.resetPassword({ body: { token: 't', newPassword: 'p' } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('changePassword returns 200 on success', async () => {
    authService.changePassword.mockResolvedValueOnce({ success: true });
    const res = buildRes();
    await ctrl.changePassword(
      { body: { currentPassword: 'a', newPassword: 'b' }, user: { id: 1 } },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('changePassword returns 400 on validation error', async () => {
    authService.changePassword.mockRejectedValueOnce(new Error('Password lama tidak benar'));
    const res = buildRes();
    await ctrl.changePassword(
      { body: { currentPassword: 'a', newPassword: 'b' }, user: { id: 1 } },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });
});

// =============================================================================
describe('googleAuth + googleCallback', () => {
  it('googleAuth invokes passport authenticate', () => {
    const res = buildRes();
    const next = jest.fn();
    ctrl.googleAuth({}, res, next);
    expect(authService.passport.authenticate).toHaveBeenCalledWith('google', expect.any(Object));
  });

  it('googleCallback invokes passport authenticate', () => {
    const res = buildRes();
    const next = jest.fn();
    ctrl.googleCallback({}, res, next);
    expect(authService.passport.authenticate).toHaveBeenCalled();
  });
});

// =============================================================================
describe('googleCallbackSuccess', () => {
  beforeEach(() => {
    process.env.FRONTEND_URL = 'http://localhost:3000';
  });

  it('redirects to login when no req.user', async () => {
    const res = buildRes();
    await ctrl.googleCallbackSuccess({}, res);
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=no_user_session'));
  });

  it('redirects with auth_error when domain invalid', async () => {
    const res = buildRes();
    await ctrl.googleCallbackSuccess(
      {
        user: { email: 'a@gmail.com' },
        ip: '1.1.1.1',
        get: () => 'ua',
      },
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('auth_error=invalid_domain'));
  });

  it('redirects with token on success (valid domain)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 5, isEmailVerified: true, isProfileComplete: true,
      createdAt: new Date(Date.now() - 600000), authMethod: 'google',
    });
    const res = buildRes();
    await ctrl.googleCallbackSuccess(
      {
        user: { id: 5, email: 'a@tazkia.ac.id', nim: 'n', fullName: 'A', status: 'a', authMethod: 'google', userType: 'u', isProfileComplete: true, isEmailVerified: true },
        ip: '1.1.1.1',
        get: () => 'ua',
      },
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('/auth/callback?token='));
  });

  it('redirects to server_error on exception', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.googleCallbackSuccess(
      {
        user: { id: 5, email: 'a@tazkia.ac.id' },
        ip: '1.1.1.1',
        get: () => 'ua',
      },
      res,
    );
    expect(res.redirect).toHaveBeenCalledWith(expect.stringContaining('error=server_error'));
  });
});

// =============================================================================
describe('logout', () => {
  it('returns 400 when no token', async () => {
    const res = buildRes();
    await ctrl.logout({ headers: {}, logout: jest.fn(cb => cb()), session: { destroy: jest.fn() } }, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it('returns 200 on success', async () => {
    authService.logout.mockResolvedValueOnce({ success: true, message: 'ok' });
    const res = buildRes();
    await ctrl.logout(
      {
        headers: { authorization: 'Bearer t' },
        logout: jest.fn((cb) => cb()),
        session: { destroy: jest.fn((cb) => cb()) },
      },
      res,
    );
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true }));
  });

  it('returns 500 on error', async () => {
    authService.logout.mockRejectedValueOnce(new Error('boom'));
    const res = buildRes();
    await ctrl.logout(
      {
        headers: { authorization: 'Bearer t' },
        logout: jest.fn((cb) => cb()),
        session: { destroy: jest.fn((cb) => cb()) },
      },
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
