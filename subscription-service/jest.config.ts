import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 60000,

  roots: ['<rootDir>/test'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  reporters: ['default'],
  maxWorkers: 1,

  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.jest.json' }],
  },

  moduleNameMapper: {
    '^@domain/(.*)$': '<rootDir>/src/subscription/domain/$1',
    '^@application/(.*)$': '<rootDir>/src/subscription/application/$1',
    '^@infra/(.*)$': '<rootDir>/src/subscription/infrastructure/$1',
    '^@interface/(.*)$': '<rootDir>/src/subscription/interface/$1',
    '^@pb/(.*)$': '<rootDir>/src/pb/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },

  testRegex: '.*\\.spec\\.ts$',

  collectCoverage: true,
  coverageDirectory: 'coverage',
};

export default config;
