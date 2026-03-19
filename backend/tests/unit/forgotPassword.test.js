// backend/tests/unit/forgotPassword.test.js
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findFirst: jest.fn(),
    update: jest.fn()
  }
}));

jest.mock('../../src/services/redisService', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  ttl: jest.fn()
}));

jest.mock('../../src/services/emailService', () => ({
  sendPasswordResetEmail: jest.fn()
}));

const prisma = require('../../src/config/prismaClient');
const redisService = require('../../src/services/redisService');
const emailService = require('../../src/services/emailService');

describe('Forgot Password', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('forgotPassword()', () => {
    it('should send reset email when user found by email', async () => {
      prisma.user.findFirst.mockResolvedValue({
        id: 1,
        email: 'test@tazkia.ac.id',
        fullName: 'Test User'
      });
      redisService.incr.mockResolvedValue(1);
      redisService.expire.mockResolvedValue(1);
      redisService.set.mockResolvedValue(undefined);
      emailService.sendPasswordResetEmail.mockResolvedValue(true);

      const authService = require('../../src/services/authService');
      const result = await authService.forgotPassword({ email: 'test@tazkia.ac.id' });

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledTimes(1);
    });

    it('should return success even if user not found (prevent email enumeration)', async () => {
      prisma.user.findFirst.mockResolvedValue(null);

      const authService = require('../../src/services/authService');
      const result = await authService.forgotPassword({ email: 'notfound@tazkia.ac.id' });

      expect(result.success).toBe(true);
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should throw if rate limit exceeded (>3 requests/hour)', async () => {
      prisma.user.findFirst.mockResolvedValue({ id: 1, email: 'test@tazkia.ac.id' });
      redisService.incr.mockResolvedValue(4); // 4th request

      const authService = require('../../src/services/authService');
      await expect(authService.forgotPassword({ email: 'test@tazkia.ac.id' }))
        .rejects.toThrow('Terlalu banyak permintaan reset password');
    });
  });

  describe('resetPassword()', () => {
    it('should update password when token is valid', async () => {
      redisService.get.mockResolvedValue('1'); // userId = 1
      prisma.user.update.mockResolvedValue({ id: 1 });
      redisService.del.mockResolvedValue(1);

      const authService = require('../../src/services/authService');
      const result = await authService.resetPassword({
        token: 'valid-token-hex',
        newPassword: 'NewPass123'
      });

      expect(result.success).toBe(true);
      expect(redisService.del).toHaveBeenCalledWith('pwd_reset:valid-token-hex');
    });

    it('should throw when token is invalid or expired', async () => {
      redisService.get.mockResolvedValue(null); // expired

      const authService = require('../../src/services/authService');
      await expect(authService.resetPassword({
        token: 'expired-token',
        newPassword: 'NewPass123'
      })).rejects.toThrow();
    });
  });
});
