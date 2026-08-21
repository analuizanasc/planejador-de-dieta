'use strict';

module.exports = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/tests/**/*.test.js', '<rootDir>/tests/**/*.test.ts'],
  testPathIgnorePatterns: ['/node_modules/'],
  // Resolve require('../utils/jwt') para .ts quando o .js não existir mais.
  moduleFileExtensions: ['js', 'ts', 'json', 'node'],
  // Transpila apenas .ts com ts-jest; os .js legados seguem sem transform.
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  collectCoverage: false,
  collectCoverageFrom: ['src/**/*.{js,ts}', '!src/server.js'],
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
