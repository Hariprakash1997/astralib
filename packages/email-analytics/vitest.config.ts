import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    root: './src',
    globalSetup: ['./__tests__/globalSetup.ts'],
    include: ['**/__tests__/**/*.spec.ts'],
    coverage: {
      provider: 'v8',
      thresholds: {
        statements: 80,
        branches: 75,
        functions: 80,
        lines: 80,
      },
      include: ['**/*.ts'],
      exclude: ['**/types/**', '**/__tests__/**', '**/index.ts'],
    },
  },
});
