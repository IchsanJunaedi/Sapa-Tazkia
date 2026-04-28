// backend/jest.config.js
module.exports = {
  testEnvironment: 'node',
  testMatch: [
    '**/tests/unit/**/*.test.js',
    '**/tests/integration/**/*.test.js',
    '**/tests/api/**/*.test.js',
    '**/src/__tests__/**/*.test.js',
  ],
  setupFiles: ['./tests/setup.js'],
  testTimeout: 30000,
  verbose: true,
  moduleNameMapper: {
    '^pdf-parse$': '<rootDir>/tests/__mocks__/pdf-parse.js',
    '^otplib$': '<rootDir>/tests/__mocks__/otplib.js',
  },
  transform: {
    '^.+\\.js$': ['babel-jest', { configFile: './babel.config.js' }],
  },
  transformIgnorePatterns: ['/node_modules/(?!uuid/)'],

  // ---------------------------------------------------------------
  // Coverage — used by `npm run test:coverage` (or `jest --coverage`)
  // Outputs lcov.info at coverage/jest/lcov.info which is consumed
  // by scripts/merge-coverage.js before upload to Codecov.
  // ---------------------------------------------------------------
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/__tests__/**',
    '!src/**/*.test.js',
    '!src/config/swagger.js',
    '!src/app.js',
  ],
  coverageDirectory: 'coverage/jest',
  coverageReporters: ['text', 'text-summary', 'lcov', 'json', 'html'],
  // Threshold is intentionally NOT enforced at Jest level — it's enforced at
  // the Codecov level (see `codecov.yml`). This keeps CI green while coverage
  // is ramping up toward the 75% target.
};
