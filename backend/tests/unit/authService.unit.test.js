// backend/tests/unit/authService.unit.test.js
//
// Unit tests for authService — fully mocks prisma + bcrypt + jwt + redis + email.
// Targets pure-ish logic: token generation, password change validation, forgot/reset
// password flow, getUserById, checkNIMAvailability, generateUniqueNIM, logout.

jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  },
  session: {
    create: jest.fn(),
    deleteMany: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
  },
}));

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
}));

const prisma = require('../../src/config/prismaClient');
const emailService = require('../../src/services/emailService');
const redisService = require('../../src/services/redisService');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'a'.repeat(40);
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'b'.repeat(40);

const authService = require('../../src/services/authService');

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe('authService.generateToken / verifyToken / generateRefreshToken', () => {
  it('generateToken signs and verifyToken decodes', () => {
    const token = authService.generateToken(42);
    expect(typeof token).toBe('string');
    const decoded = authService.verifyToken(token);
    expect(decoded.id).toBe(42);
    expect(decoded.type).toBe('access');
  });

  it('verifyToken returns null on invalid token', () => {
    expect(authService.verifyToken('not-a-jwt')).toBeNull();
  });

  it('generateRefreshToken produces a token with type=refresh', () => {
    const t = authService.generateRefreshToken(99);
    const decoded = jwt.verify(t, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
    expect(decoded.type).toBe('refresh');
    expect(decoded.id).toBe(99);
  });

  it('verifyRefreshToken returns null for tampered token', () => {
    expect(authService.verifyRefreshToken('xx.yy.zz')).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('authService.changePassword', () => {
  it('throws when user not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(
      authService.changePassword({ userId: 1, currentPassword: 'old', newPassword: 'new' }),
    ).rejects.toThrow(/tidak ditemukan/);
  });

  it('throws when current password mismatch', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, passwordHash: await bcrypt.hash('real', 4) });
    await expect(
      authService.changePassword({ userId: 1, currentPassword: 'wrong', newPassword: 'new' }),
    ).rejects.toThrow(/tidak sesuai/);
  });

  it('throws when newPassword === oldPassword', async () => {
    const hash = await bcrypt.hash('same', 4);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, passwordHash: hash });
    await expect(
      authService.changePassword({ userId: 1, currentPassword: 'same', newPassword: 'same' }),
    ).rejects.toThrow(/tidak boleh sama/);
  });

  it('updates user with new hash on success', async () => {
    const hash = await bcrypt.hash('oldpass', 4);
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1, passwordHash: hash });
    prisma.user.update.mockResolvedValueOnce({ id: 1 });
    const r = await authService.changePassword({ userId: 1, currentPassword: 'oldpass', newPassword: 'newpass' });
    expect(r.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe('authService.checkNIMAvailability', () => {
  it('returns available=true when no user exists', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    const r = await authService.checkNIMAvailability('2021999999');
    expect(r.available).toBe(true);
  });

  it('returns available=false when NIM taken', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 1 });
    const r = await authService.checkNIMAvailability('2021000001');
    expect(r.available).toBe(false);
  });

  it('returns available=false on error', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('db down'));
    const r = await authService.checkNIMAvailability('xxx');
    expect(r.available).toBe(false);
  });
});

// ---------------------------------------------------------------------------

describe('authService.getUserById', () => {
  it('returns user when found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({ id: 7, email: 'a@b.com' });
    const u = await authService.getUserById(7);
    expect(u.email).toBe('a@b.com');
  });

  it('returns null when not found', async () => {
    prisma.user.findUnique.mockResolvedValueOnce(null);
    expect(await authService.getUserById(99)).toBeNull();
  });

  it('returns null on error (logs but does not throw)', async () => {
    prisma.user.findUnique.mockRejectedValueOnce(new Error('boom'));
    expect(await authService.getUserById(1)).toBeNull();
  });
});

// ---------------------------------------------------------------------------

describe('authService.logout', () => {
  it('returns success when deleteMany works', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 1 });
    const r = await authService.logout('tok');
    expect(r.success).toBe(true);
  });

  it('returns failure object when DB throws', async () => {
    prisma.session.deleteMany.mockRejectedValueOnce(new Error('down'));
    const r = await authService.logout('tok');
    expect(r.success).toBe(false);
  });
});

describe('authService.logoutAllUserSessions', () => {
  it('returns true on success', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 3 });
    expect(await authService.logoutAllUserSessions(1)).toBe(true);
  });

  it('throws when DB fails', async () => {
    prisma.session.deleteMany.mockRejectedValueOnce(new Error('x'));
    await expect(authService.logoutAllUserSessions(1)).rejects.toThrow();
  });
});

// ---------------------------------------------------------------------------

describe('authService.forgotPassword', () => {
  it('returns success silently when user not found (no email leak)', async () => {
    prisma.user.findFirst.mockResolvedValueOnce(null);
    const r = await authService.forgotPassword({ email: 'nope@x.com' });
    expect(r.success).toBe(true);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('returns success silently when user has no email', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: null });
    const r = await authService.forgotPassword({ email: 'x@y.com' });
    expect(r.success).toBe(true);
    expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('sends reset email when user found and not rate-limited', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 'a@b.com' });
    redisService.incr.mockResolvedValueOnce(1);
    redisService.expire.mockResolvedValueOnce(true);
    redisService.set.mockResolvedValueOnce(true);
    const r = await authService.forgotPassword({ email: 'a@b.com' });
    expect(r.success).toBe(true);
    expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
      'a@b.com',
      expect.stringContaining('reset-password?token='),
    );
  });

  it('throws on rate limit exceeded', async () => {
    prisma.user.findFirst.mockResolvedValueOnce({ id: 1, email: 'a@b.com' });
    redisService.incr.mockResolvedValueOnce(4);
    await expect(authService.forgotPassword({ email: 'a@b.com' })).rejects.toThrow(/Terlalu banyak/);
  });
});

// ---------------------------------------------------------------------------

describe('authService.resetPassword', () => {
  it('throws when token not in Redis', async () => {
    redisService.get.mockResolvedValueOnce(null);
    await expect(authService.resetPassword({ token: 'bad', newPassword: 'x' })).rejects.toThrow(/tidak valid/);
  });

  it('hashes + updates user when token valid', async () => {
    redisService.get.mockResolvedValueOnce('42');
    redisService.del.mockResolvedValueOnce(true);
    prisma.user.update.mockResolvedValueOnce({ id: 42 });
    const r = await authService.resetPassword({ token: 'good', newPassword: 'newpass' });
    expect(r.success).toBe(true);
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({ passwordHash: expect.any(String) }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------

describe('authService.createSession', () => {
  it('cleans expired + creates new', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.session.create.mockResolvedValueOnce({ id: 1 });
    const s = await authService.createSession(7, 'tok', '1.1.1.1', 'UA');
    expect(s.id).toBe(1);
    expect(prisma.session.create).toHaveBeenCalled();
  });

  it('throws when create fails', async () => {
    prisma.session.deleteMany.mockResolvedValueOnce({ count: 0 });
    prisma.session.create.mockRejectedValueOnce(new Error('boom'));
    await expect(authService.createSession(7, 'tok')).rejects.toThrow();
  });
});

describe('authService.verifySession', () => {
  it('returns invalid for malformed JWT', async () => {
    const r = await authService.verifySession('not.a.jwt');
    expect(r.valid).toBe(false);
  });

  it('returns invalid when no session row', async () => {
    const goodTok = authService.generateToken(42);
    prisma.session.findFirst.mockResolvedValueOnce(null);
    const r = await authService.verifySession(goodTok);
    expect(r.valid).toBe(false);
  });

  it('returns user when session row + JWT valid', async () => {
    const goodTok = authService.generateToken(42);
    prisma.session.findFirst.mockResolvedValueOnce({
      id: 1,
      user: { id: 42, email: 'a@b.com', userType: 'student' },
    });
    prisma.session.update.mockResolvedValueOnce({ id: 1 });
    const r = await authService.verifySession(goodTok);
    expect(r.valid).toBe(true);
    expect(r.user.email).toBe('a@b.com');
  });
});

// ---------------------------------------------------------------------------

describe('authService.updateUserProfile', () => {
  it('updates and returns selected fields', async () => {
    prisma.user.update.mockResolvedValueOnce({ id: 1, email: 'x@y.com', isProfileComplete: true });
    const r = await authService.updateUserProfile(1, { email: 'x@y.com', nim: '2021', fullName: 'X', programStudiId: '5' });
    expect(r.email).toBe('x@y.com');
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ programStudiId: 5, isProfileComplete: true }),
      }),
    );
  });

  it('throws on prisma failure', async () => {
    prisma.user.update.mockRejectedValueOnce(new Error('db'));
    await expect(authService.updateUserProfile(1, {})).rejects.toThrow();
  });
});
