// backend/tests/unit/authService.full.test.js
//
// Unit tests for authService — fully mocks prisma + emailService + redisService.
// Avoid bcrypt import (heavy, slow). Use the actual authService module.

jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
    findMany: jest.fn(),
  },
  session: {
    deleteMany: jest.fn(),
    create: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendWelcomeEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
}));

const prisma = require('../../src/config/prismaClient');
const emailService = require('../../src/services/emailService');
const redisService = require('../../src/services/redisService');
const authService = require('../../src/services/authService');

beforeEach(() => {
  jest.clearAllMocks();
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('generateVerificationCode', () => {
  it('returns a 6-digit string', () => {
    const code = authService.generateVerificationCode();
    expect(code).toMatch(/^\d{6}$/);
  });
});

describe('generateToken / verifyToken', () => {
  it('round-trips a userId', () => {
    const token = authService.generateToken(42);
    const decoded = authService.verifyToken(token);
    expect(decoded.id).toBe(42);
  });

  it('returns null for invalid token', () => {
    expect(authService.verifyToken('invalid')).toBeNull();
  });
});

describe('generateRefreshToken / verifyRefreshToken', () => {
  it('round-trips with type=refresh', () => {
    const token = authService.generateRefreshToken(7);
    const decoded = authService.verifyRefreshToken(token);
    expect(decoded.id).toBe(7);
    expect(decoded.type).toBe('refresh');
  });

  it('returns null for invalid refresh token', () => {
    expect(authService.verifyRefreshToken('bogus')).toBeNull();
  });
});

describe('sendVerificationEmail', () => {
  it('calls emailService.sendEmail and returns true', async () => {
    const result = await authService.sendVerificationEmail('a@x.com', '123456');
    expect(result).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalled();
  });

  it('throws when emailService fails', async () => {
    emailService.sendEmail.mockRejectedValueOnce(new Error('smtp'));
    await expect(authService.sendVerificationEmail('a@x.com', '123456')).rejects.toThrow(
      'Gagal mengirim email verifikasi',
    );
  });
});

describe('verifyEmailCode (service)', () => {
  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(authService.verifyEmailCode('a@x.com', '123456')).rejects.toThrow(
      'User tidak ditemukan',
    );
  });

  it('returns success when already verified', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, isEmailVerified: true, isProfileComplete: true, fullName: 'A',
    });
    const result = await authService.verifyEmailCode('a@x.com', '123456');
    expect(result.success).toBe(true);
  });

  it('throws "kadaluarsa" when expired', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, isEmailVerified: false, verificationCode: '123456',
      verificationCodeExpires: new Date(Date.now() - 60000),
      verificationAttempts: 0,
    });
    await expect(authService.verifyEmailCode('a@x.com', '123456')).rejects.toThrow(
      'kadaluarsa',
    );
  });

  it('throws when code does not match', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, isEmailVerified: false, verificationCode: '111111',
      verificationCodeExpires: new Date(Date.now() + 60000),
      verificationAttempts: 0,
    });
    prisma.user.update.mockResolvedValueOnce({});
    await expect(authService.verifyEmailCode('a@x.com', '123456')).rejects.toThrow(
      'Kode verifikasi tidak valid',
    );
  });

  it('throws "Terlalu banyak" when attempts >= 5', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, isEmailVerified: false, verificationCode: '123456',
      verificationCodeExpires: new Date(Date.now() + 60000),
      verificationAttempts: 5,
    });
    await expect(authService.verifyEmailCode('a@x.com', '123456')).rejects.toThrow(
      'Terlalu banyak',
    );
  });

  it('verifies successfully + creates session', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, isEmailVerified: false, verificationCode: '123456',
      verificationCodeExpires: new Date(Date.now() + 60000),
      verificationAttempts: 0,
    });
    prisma.user.update.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', fullName: 'A', nim: 'n', status: 'active',
      authMethod: 'nim', userType: 'student', isProfileComplete: false, isEmailVerified: true,
    });
    prisma.session.create.mockResolvedValueOnce({});
    const result = await authService.verifyEmailCode('a@x.com', '123456');
    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
  });
});

describe('resendVerificationCode (service)', () => {
  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(authService.resendVerificationCode('a@x.com')).rejects.toThrow(
      'User tidak ditemukan',
    );
  });

  it('throws when already verified', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ isEmailVerified: true });
    await expect(authService.resendVerificationCode('a@x.com')).rejects.toThrow(
      'Email sudah terverifikasi',
    );
  });

  it('updates user and sends email', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ isEmailVerified: false });
    prisma.user.update.mockResolvedValueOnce({});
    const result = await authService.resendVerificationCode('a@x.com');
    expect(result.success).toBe(true);
    expect(emailService.sendEmail).toHaveBeenCalled();
  });
});

describe('checkNIMAvailability', () => {
  it('returns available=true when NIM not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await authService.checkNIMAvailability('123');
    expect(result.available).toBe(true);
  });

  it('returns available=false when NIM exists', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 });
    const result = await authService.checkNIMAvailability('123');
    expect(result.available).toBe(false);
  });
});

describe('register (service)', () => {
  it('returns failure when fields missing', async () => {
    const result = await authService.register({});
    expect(result.success).toBe(false);
  });

  it('returns failure when fullName too short', async () => {
    const result = await authService.register({
      fullName: 'A', nim: '123', email: 'a@x.com', password: 'pw1234',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when nim too short', async () => {
    const result = await authService.register({
      fullName: 'Alice', nim: '1', email: 'a@x.com', password: 'pw1234',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when password too short', async () => {
    const result = await authService.register({
      fullName: 'Alice', nim: '1234567', email: 'a@x.com', password: '1',
    });
    expect(result.success).toBe(false);
  });

  it('returns failure when email exists', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 });
    const result = await authService.register({
      fullName: 'Alice', nim: '1234567', email: 'a@x.com', password: 'pw1234',
    });
    expect(result.success).toBe(false);
    expect(result.message).toContain('email');
  });

  it('returns failure when nim exists', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 2 });
    const result = await authService.register({
      fullName: 'Alice', nim: '1234567', email: 'a@x.com', password: 'pw1234',
    });
    expect(result.success).toBe(false);
  });

  it('creates user successfully', async () => {
    prisma.user.findUnique
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);
    prisma.user.create.mockResolvedValueOnce({ id: 1, email: 'a@x.com', nim: '123' });
    const result = await authService.register({
      fullName: 'Alice', nim: '1234567', email: 'a@x.com', password: 'pw1234',
    });
    expect(result.success).toBe(true);
    expect(result.requiresVerification).toBe(true);
  }, 15000);
});

describe('login (service)', () => {
  it('returns failure when fields missing', async () => {
    const result = await authService.login('', '');
    expect(result.success).toBe(false);
  });

  it('returns failure when user not found (email)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await authService.login('a@x.com', 'pw');
    expect(result.success).toBe(false);
  });

  it('returns failure when user not found (NIM)', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const result = await authService.login('123', 'pw');
    expect(result.success).toBe(false);
  });

  it('returns requiresVerification when status=pending', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', status: 'pending',
    });
    const result = await authService.login('a@x.com', 'pw');
    expect(result.requiresVerification).toBe(true);
  });

  it('returns failure when status=disabled', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', status: 'disabled',
    });
    const result = await authService.login('a@x.com', 'pw');
    expect(result.success).toBe(false);
  });

  it('skipPassword path returns success token', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', status: 'active', fullName: 'A', nim: 'n',
      authMethod: 'nim', userType: 'admin', isProfileComplete: true, isEmailVerified: true,
    });
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.session.create.mockResolvedValueOnce({});
    const result = await authService.login('a@x.com', null, '1.1.1.1', 'ua', true);
    expect(result.success).toBe(true);
    expect(result.token).toBeTruthy();
  });

  it('email-only user authenticated with NIM as password', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', status: 'active', fullName: 'A', nim: 'n',
      authMethod: 'nim', userType: 'student', passwordHash: null,
      isProfileComplete: true, isEmailVerified: true,
    });
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.session.create.mockResolvedValueOnce({});
    const result = await authService.login('a@x.com', 'n', '1.1.1.1', 'ua');
    expect(result.success).toBe(true);
  });

  it('email-only user wrong password returns failure', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 1, email: 'a@x.com', status: 'active', nim: 'n', passwordHash: null,
    });
    const result = await authService.login('a@x.com', 'wrongpw', '1.1.1.1', 'ua');
    expect(result.success).toBe(false);
  });
});

describe('logout (service)', () => {
  it('deletes sessions for given token', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 1 });
    const result = await authService.logout('abc');
    expect(result.success).toBe(true);
  });

  it('returns failure on db error', async () => {
    prisma.session.deleteMany.mockRejectedValueOnce(new Error('boom'));
    const result = await authService.logout('abc');
    expect(result.success).toBe(false);
  });
});

describe('getUserById', () => {
  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, email: 'a@x.com' });
    const u = await authService.getUserById(1);
    expect(u.id).toBe(1);
  });

  it('returns null on error', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('boom'));
    const u = await authService.getUserById(1);
    expect(u).toBeNull();
  });
});

describe('createSession + logoutAllUserSessions + verifySession', () => {
  it('createSession invokes prisma.session.create', async () => {
    prisma.session.create.mockResolvedValueOnce({});
    await authService.createSession(1, 'tok', '1.1.1.1', 'ua');
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it('logoutAllUserSessions deletes for userId', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    await authService.logoutAllUserSessions(5);
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });

  it('verifySession returns invalid for missing token', async () => {
    const result = await authService.verifySession('invalid-token');
    expect(result.valid).toBe(false);
  });
});

describe('forgotPassword', () => {
  it('returns success silently when user not found', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    const result = await authService.forgotPassword({ email: 'a@x.com' });
    expect(result.success).toBe(true);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns success silently when user has no email', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: null });
    const result = await authService.forgotPassword({ nim: '123' });
    expect(result.success).toBe(true);
  });

  it('throws when rate limit exceeded', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 'a@x.com' });
    redisService.incr.mockResolvedValueOnce(4);
    await expect(authService.forgotPassword({ email: 'a@x.com' })).rejects.toThrow(
      'Terlalu banyak',
    );
  });

  it('sends email on first request', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 'a@x.com' });
    redisService.incr.mockResolvedValueOnce(1);
    redisService.expire.mockResolvedValueOnce(true);
    redisService.set.mockResolvedValueOnce(true);
    const result = await authService.forgotPassword({ email: 'a@x.com' });
    expect(result.success).toBe(true);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalled();
  });
});

describe('resetPassword', () => {
  it('throws when token invalid', async () => {
    redisService.get.mockResolvedValueOnce(null);
    await expect(authService.resetPassword({ token: 'x', newPassword: 'y' })).rejects.toThrow(
      'tidak valid',
    );
  });

  it('updates password successfully', async () => {
    redisService.get.mockResolvedValueOnce('1');
    prisma.user.update.mockResolvedValueOnce({});
    redisService.del.mockResolvedValueOnce(true);
    const result = await authService.resetPassword({ token: 'x', newPassword: 'newpw' });
    expect(result.success).toBe(true);
  }, 15000);
});

describe('updateUserVerification + updateUserProfile', () => {
  it('updateUserVerification calls prisma.user.update', async () => {
    prisma.user.update.mockResolvedValueOnce({});
    await authService.updateUserVerification(1, { nim: 'n', fullName: 'a' });
    expect(prisma.user.update).toHaveBeenCalled();
  });

  it('updateUserProfile calls prisma.user.update', async () => {
    prisma.user.update.mockResolvedValueOnce({});
    await authService.updateUserProfile(1, { email: 'a', nim: 'n', fullName: 'A' });
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

describe('issueSessionToken', () => {
  it('logs out previous + creates new session', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.session.create.mockResolvedValueOnce({});
    const token = await authService.issueSessionToken(1, '1.1.1.1', 'ua');
    expect(token).toBeTruthy();
    expect(prisma.session.deleteMany).toHaveBeenCalled();
  });
});
