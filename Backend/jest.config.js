/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  roots: ['<rootDir>/tests'],
  testMatch: ['**/*.test.ts'],
  globalSetup: '<rootDir>/tests/setup/globalSetup.js',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/afterEnv.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },
  clearMocks: true,
};
