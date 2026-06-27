// vitest.config.js — SETU QA Pipeline
// Unit + Integration tests using Vitest + jsdom + Testing Library

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./config/vitest-setup.js'],
    include: [
      'tests/unit/**/*.test.{js,jsx,ts,tsx}',
      'tests/integration/**/*.test.{js,jsx,ts,tsx}',
    ],
    exclude: ['tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './reports/coverage',
      include: [
        '../src/**/*.{js,jsx,ts,tsx}',
      ],
      exclude: [
        '../src/**/*.test.*',
        '../src/main.jsx',
        '../src/components/ui/**',   // shadcn boilerplate
      ],
      thresholds: {
        lines:      60,
        functions:  60,
        branches:   55,
        statements: 60,
      },
    },
    reporters: ['verbose', 'json'],
    outputFile: {
      json: './reports/vitest-results.json',
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '../src'),
    },
  },
});
