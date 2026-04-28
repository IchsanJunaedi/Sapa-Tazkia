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
  // Integration tests share a single MySQL DB with unique constraints on
  // emails/NIMs. Running suites in parallel causes seed conflicts. Force
  // sequential execution for stability — coverage workload is small enough
  // that wall-clock impact is negligible.
  maxWorkers: 1,

  // ---------------------------------------------------------------
  // Reporters
  //  - default: pretty console output for humans.
  //  - jest-junit: JUnit XML for Codecov Test Analytics (flaky/failed
  //    test tracking). Output at tests-report/junit.xml — uploaded by
  //    codecov/test-results-action@v1 in the CI workflow.
  // Override locally with: JEST_REPORTERS=default
  // ---------------------------------------------------------------
  reporters: [
    'default',
    ['jest-junit', {
      outputDirectory: 'tests-report',
      outputName: 'junit.xml',
      classNameTemplate: '{filepath}',
      titleTemplate: '{classname} > {title}',
      ancestorSeparator: ' > ',
      usePathForSuiteName: 'true',
    }],
  ],
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
