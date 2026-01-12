/**
 * Jest configuration for backend tests.
 * 
 * @type {import('jest').Config}
 */
module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'database/**/*.js',
    'utils/**/*.js',
    '!database/migrate.js' // CLI migration runner is tested via integration
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 60,
      functions: 70,
      lines: 70,
      statements: 70
    }
  },
  verbose: true,
  testTimeout: 30000,
  // Clean up after each test file
  clearMocks: true,
  resetModules: true
};
