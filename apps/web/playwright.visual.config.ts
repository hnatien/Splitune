import { defineConfig, devices } from '@playwright/test'

// Visual regression (28 §4): the screen matrix rendered from the Screens/ stories of the built
// Storybook (fixture data, no network), compared with committed baselines. Browsers run in the
// pinned Playwright Linux image so fonts and anti-aliasing match on every machine: run it through
// `pnpm --filter @splitune/web e2e:visual` (scripts/visual.mjs), never against local browsers.
const { PW_VISUAL_WS_ENDPOINT: wsEndpoint, CI } = process.env
if (!wsEndpoint) {
  throw new Error('Run the visual suite with `pnpm --filter @splitune/web e2e:visual`')
}
export const STORYBOOK_URL = 'http://localhost:6106'

const engine = { deviceScaleFactor: 1, connectOptions: { wsEndpoint, exposeNetwork: '<loopback>' } }

export default defineConfig({
  testDir: './e2e/visual',
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  timeout: 90_000,
  fullyParallel: true,
  // The browsers run under amd64 emulation on Apple Silicon: more workers starve the server.
  workers: 2,
  retries: 0,
  reporter: [['list']],
  expect: {
    toHaveScreenshot: {
      maxDiffPixels: 20,
      animations: 'disabled',
      caret: 'hide',
      stylePath: './e2e/visual/volatile.css',
    },
  },
  use: { baseURL: STORYBOOK_URL, locale: 'en-GB', timezoneId: 'UTC' },
  webServer: {
    command: 'node scripts/serve-static.mjs storybook-static 6106',
    url: `${STORYBOOK_URL}/iframe.html`,
    reuseExistingServer: !CI,
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'], ...engine } },
    { name: 'webkit', use: { ...devices['Desktop Safari'], ...engine } },
  ],
})
