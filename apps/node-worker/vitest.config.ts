import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // The worker test runs against the compose stack: a throwaway Postgres database (global
    // setup) and SeaweedFS.
    globalSetup: ['./test/global-setup.ts'],
    setupFiles: ['./test/env.ts'],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
})
