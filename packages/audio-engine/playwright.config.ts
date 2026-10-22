import { defineConfig, devices } from '@playwright/test'

// Offline-render audio suite (docs/implementation/18-testing-strategy.md §2) in Chromium, Firefox
// and WebKit. PW_FIREFOX_WS_ENDPOINT runs Firefox in a Playwright server elsewhere (the Linux
// Docker image) where it can't start locally; the page still loads from this machine's server.
const PORT = 5174
const { CI, PW_FIREFOX_WS_ENDPOINT: firefoxEndpoint } = process.env

export default defineConfig({
  testDir: './test/browser',
  timeout: 120_000,
  retries: 0,
  reporter: [['list']],
  use: { baseURL: `http://localhost:${PORT}` },
  webServer: {
    command: 'vite --config test/browser/vite.config.ts',
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !CI,
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
  ],
})
