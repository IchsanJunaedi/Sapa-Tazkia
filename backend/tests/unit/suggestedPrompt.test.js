// backend/tests/unit/suggestedPrompt.test.js
const prisma = require('../../src/config/prismaClient');

// Mock prisma
jest.mock('../../src/config/prismaClient', () => ({
  suggestedPrompt: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
    delete: jest.fn(),
  }
}));

// Mock redisService
jest.mock('../../src/services/redisService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
}));

const { getPublicPrompts, createPrompt, updatePrompt, deletePrompt, togglePrompt } =
  require('../../src/controllers/suggestedPromptController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('suggestedPromptController', () => {
  afterEach(() => jest.clearAllMocks());

  test('getPublicPrompts returns active prompts', async () => {
    const fakePrompts = [
      { id: 1, text: 'Apa syarat KRS?', source: 'manual', isActive: true, order: 0 },
      { id: 2, text: 'Bagaimana cara bayar SPP?', source: 'manual', isActive: true, order: 1 },
    ];
    prisma.suggestedPrompt.findMany.mockResolvedValue(fakePrompts);
    const req = {};
    const res = mockRes();
    await getPublicPrompts(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  test('createPrompt validates required text field', async () => {
    const req = { body: {} };
    const res = mockRes();
    await createPrompt(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createPrompt creates a prompt with valid data', async () => {
    const fake = { id: 1, text: 'Test prompt', source: 'manual', isActive: true, order: 0 };
    prisma.suggestedPrompt.create.mockResolvedValue(fake);
    const req = { body: { text: 'Test prompt' } };
    const res = mockRes();
    await createPrompt(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
