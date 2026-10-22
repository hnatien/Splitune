import { defineConfig } from 'vitest/config'

// Node tests only; test/browser/*.spec.ts run under Playwright (`pnpm test:browser`).
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts', 'test/*.test.ts'],
    testTimeout: 60_000,
  },
})
