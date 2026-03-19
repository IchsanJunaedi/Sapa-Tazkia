// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js', '**/src/__tests__/**/*.test.js'],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 10000,
  verbose: true
};
