import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Integration tests against the compose stack: a throwaway Postgres database (global setup),
    // SeaweedFS and Mailpit.
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
