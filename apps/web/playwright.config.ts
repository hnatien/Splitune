import { defineConfig, devices } from '@playwright/test'

// End-to-end journeys against the production build (`pnpm --filter @splitune/web build`) with the
// mock-mode Mac workers (e2e/global-setup.ts): Chromium, Firefox and WebKit on desktop, plus phone
// and tablet viewports (docs/implementation/24-browser-compatibility.md §6). Projects run one after
// another: they share one server, one Mac worker pair and the per-IP sign-in limit.
// The full matrix runs nightly; E2E_SMOKE=1 (`e2e:smoke`, every PR) runs the core journeys on the
// three desktop engines (18 §1).
export const APP_URL = 'http://localhost:3000'
// Firefox doesn't start on macOS 27: PW_FIREFOX_WS_ENDPOINT runs it in the Linux Playwright image
// (as the audio engine's suite does), with loopback traffic tunnelled back to this machine.
const { PW_FIREFOX_WS_ENDPOINT: firefoxEndpoint, E2E_SMOKE } = process.env
const smoke = E2E_SMOKE === '1'
// Import → analysis → practice (loop at 70 %, count-in), onboarding, delete song and account: the
// release-gate flows of 24 §6 that aren't billing.
const SMOKE_SPECS = ['journey', 'practice', 'onboarding', 'account'].map((s) => `**/${s}.spec.ts`)
const DESKTOP = ['chromium', 'firefox', 'webkit']

export default defineConfig({
  testDir: './e2e',
  // The visual matrix has its own config (playwright.visual.config.ts, run in Docker).
  testIgnore: 'visual/**',
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
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        ...(firefoxEndpoint
          ? { connectOptions: { wsEndpoint: firefoxEndpoint, exposeNetwork: '<loopback>' } }
          : {}),
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'mobile-chrome', use: { ...devices['Pixel 7'] } },
    { name: 'mobile-safari', use: { ...devices['iPhone 15'] } },
    // The practice screen's primary place: a tablet on a music stand, landscape (12 §1); and
    // an Android tablet in portrait.
    { name: 'tablet-safari', use: { ...devices['iPad Pro 11 landscape'] } },
    { name: 'tablet-chrome', use: { ...devices['Galaxy Tab S4'] } },
  ]
    .filter((project) => !smoke || DESKTOP.includes(project.name))
    .map((project) => (smoke ? { ...project, testMatch: SMOKE_SPECS } : project)),
})
