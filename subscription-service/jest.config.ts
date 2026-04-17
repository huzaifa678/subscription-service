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
    '^@model/(.*)$': '<rootDir>/src/model/$1',
    '^@mapper/(.*)$': '<rootDir>/src/mapper/$1',
    '^@service/(.*)$': '<rootDir>/src/service/$1',
    '^@resolvers/(.*)$': '<rootDir>/src/resolvers/$1',
    '^@controller/(.*)$': '<rootDir>/src/controller/$1',
    '^@pb/(.*)$': '<rootDir>/src/pb/$1',
    '^@repository/(.*)$': '<rootDir>/src/repository/$1',
    '^@events/(.*)$': '<rootDir>/src/events/$1',
    '^@test/(.*)$': '<rootDir>/test/$1',
    '^@logger/(.*)$': '<rootDir>/src/logger/$1',
    '^@lib/(.*)$': '<rootDir>/src/lib/$1',
  },

  testRegex: '.*\\.spec\\.ts$',

  collectCoverage: true,
  coverageDirectory: 'coverage',
};

export default config;