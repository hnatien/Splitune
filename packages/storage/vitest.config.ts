import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Integration tests run against the compose SeaweedFS (S3_* from the environment, .env or
    // .env.example).
    setupFiles: ['./test/env.ts'],
    testTimeout: 30_000,
  },
})
