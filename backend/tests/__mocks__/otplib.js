// Mock for otplib to avoid ESM dependency on @scure/base in Jest (CJS mode)
const authenticator = {
  generate: jest.fn(() => '123456'),
  verify: jest.fn(() => true),
  generateSecret: jest.fn(() => 'MOCKSECRET'),
  keyuri: jest.fn(() => 'otpauth://totp/mock?secret=MOCKSECRET'),
};

module.exports = { authenticator };
