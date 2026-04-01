// backend/tests/integration/auth.test.js

jest.mock('../../src/services/emailService', () => ({
  sendEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
}));

const { agent } = require('../helpers/appHelper');
const { truncateAll, seedTestUser, disconnect } = require('../helpers/dbHelper');

describe('Auth Integration', () => {
  let testUser;
  let plainPassword;

  beforeAll(async () => {
    await truncateAll();
    const seeded = await seedTestUser();
    testUser = seeded.user;
    plainPassword = seeded.plainPassword;
  });

  afterAll(async () => {
    await truncateAll();
    await disconnect();
  });

  describe('POST /api/auth/login', () => {
    it('returns 200 + JWT token on valid NIM + password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user.nim).toBe(testUser.nim);
    });

    it('returns 200 + JWT token on valid email + password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.email, password: plainPassword });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body).toHaveProperty('token');
    });

    it('returns 401 on wrong password', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim, password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 401 on unknown NIM', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: '9999999999', password: 'anypassword' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('returns 422 when fields are missing', async () => {
      const res = await agent
        .post('/api/auth/login')
        .send({ identifier: testUser.nim });

      expect(res.status).toBe(422);
    });
  });

  // NOTE: POST /api/auth/register is currently disabled (commented out in authRoutes.js).
  // These tests document the expected behaviour once the route is re-enabled.
  // Until then all calls return 404 and the tests are skipped.
  describe('POST /api/auth/register', () => {
    it('returns 404 because the register route is currently disabled', async () => {
      const res = await agent
        .post('/api/auth/register')
        .send({
          fullName: 'Budi Santoso',
          nim:      '2021009999',
          email:    'budi@student.tazkia.ac.id',
          password: 'SecurePass123',
        });

      expect(res.status).toBe(404);
    });

    it.todo('returns 201 + requiresVerification on new valid user (re-enable route first)');
    it.todo('returns 400 when NIM already exists (re-enable route first)');
    it.todo('returns 400 when email already exists (re-enable route first)');
    it.todo('returns 400 when required fields are missing (re-enable route first)');
  });
});
