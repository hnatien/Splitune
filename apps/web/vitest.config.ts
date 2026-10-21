import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig } from 'vitest/config'
import viteConfig from './vite.config.ts'

// `unit`: plain Node tests. `storybook`: every story rendered as a test in Chromium and WebKit
// with axe (a11y.test = 'error'), per docs/implementation/28-ui-quality-and-design-review.md §2.
export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      projects: [
        {
          extends: true,
          test: {
            name: 'unit',
            environment: 'node',
            include: ['app/**/*.test.ts'],
          },
        },
        {
          extends: true,
          plugins: [
            storybookTest({
              configDir: fileURLToPath(new URL('./.storybook', import.meta.url)),
              storybookScript: 'pnpm storybook --no-open',
            }),
          ],
          test: {
            name: 'storybook',
            browser: {
              enabled: true,
              headless: true,
              provider: playwright(),
              instances: [{ browser: 'chromium' }, { browser: 'webkit' }],
            },
          },
        },
      ],
    },
  }),
)
