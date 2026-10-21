import { defineConfig, devices } from '@playwright/test'

// End-to-end journeys against the production build (`pnpm --filter @splitune/web build`) with the
// mock-mode Mac workers (e2e/global-setup.ts): Chromium, Firefox and WebKit on desktop, plus phone
// viewports (docs/implementation/24-browser-compatibility.md §6). Projects run one after another:
// they share one server, one Mac worker pair and the per-IP sign-in limit.
export const APP_URL = 'http://localhost:3000'

export default defineConfig({
  testDir: './e2e',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  globalSetup: './e2e/global-setup.ts',
  use: {
    baseURL: APP_URL,
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
  ],
})
