'use strict';

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  testPathIgnorePatterns: ['/node_modules/'],
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.js', '!src/server.js'],
  coverageDirectory: '<rootDir>/coverage',
  coverageReporters: ['text', 'text-summary', 'lcov'],
  coverageThreshold: {
    './src/services/geradorCardapio.js': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
    './src/utils/validators.js': {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
};
