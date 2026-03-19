// backend/tests/unit/userProfile.test.js
jest.mock('../../src/config/prismaClient', () => ({
  user: {
    findUnique: jest.fn(),
    update: jest.fn()
  }
}));

const prisma = require('../../src/config/prismaClient');
const bcrypt = require('bcryptjs');

describe('User Profile Management', () => {
  beforeEach(() => jest.clearAllMocks());

  describe('changePassword()', () => {
    it('should update password when currentPassword is correct', async () => {
      const hashedPw = await bcrypt.hash('OldPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });
      prisma.user.update.mockResolvedValue({ id: 1 });

      const authService = require('../../src/services/authService');
      const result = await authService.changePassword({
        userId: 1,
        currentPassword: 'OldPass123',
        newPassword: 'NewPass456'
      });

      expect(result.success).toBe(true);
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } })
      );
    });

    it('should throw when currentPassword is wrong', async () => {
      const hashedPw = await bcrypt.hash('OldPass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });

      const authService = require('../../src/services/authService');
      await expect(authService.changePassword({
        userId: 1,
        currentPassword: 'WrongPass',
        newPassword: 'NewPass456'
      })).rejects.toThrow('Password saat ini tidak sesuai');
    });

    it('should throw when new password equals current password', async () => {
      const hashedPw = await bcrypt.hash('SamePass123', 10);
      prisma.user.findUnique.mockResolvedValue({ id: 1, passwordHash: hashedPw });

      const authService = require('../../src/services/authService');
      await expect(authService.changePassword({
        userId: 1,
        currentPassword: 'SamePass123',
        newPassword: 'SamePass123'
      })).rejects.toThrow('Password baru tidak boleh sama dengan password lama');
    });
  });

  describe('updateUserProfile() with programStudiId', () => {
    it('should update programStudiId when provided', async () => {
      prisma.user.update.mockResolvedValue({ id: 1, programStudiId: 2 });

      const authService = require('../../src/services/authService');
      const result = await authService.updateUserProfile(1, { programStudiId: 2 });
      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ programStudiId: 2 })
        })
      );
    });
  });
});
