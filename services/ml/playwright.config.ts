// Browser decode check for stem encodes: `pnpm --filter @splitune/ml e2e` (Tier 1 engines).
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: 'browser',
  reporter: [['list']],
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
})
