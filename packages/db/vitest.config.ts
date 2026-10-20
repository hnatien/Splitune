import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Integration tests share one throwaway database created by the global setup.
    globalSetup: ['./test/global-setup.ts'],
    fileParallelism: false,
    testTimeout: 20_000,
  },
})
