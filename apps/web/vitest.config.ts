import { fileURLToPath } from 'node:url'
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { playwright } from '@vitest/browser-playwright'
import { defineConfig, mergeConfig, type TestProjectInlineConfiguration } from 'vitest/config'
import viteConfig from './vite.base.ts'

// `unit`: plain Node tests. `storybook`: every story rendered as a test in Chromium and WebKit
// with axe (a11y.test = 'error'), per docs/specs/28-ui-quality-and-design-review.md §2.
//
// The two browsers run one after the other (`sequence.groupOrder`), and WebKit one story file at a
// time. With files in parallel, Playwright's WebKit content process was killed part-way ("The
// webkit page crashed while running tests"), which either aborted the run or left it waiting
// forever (Windows, 2026-11-09, 21 GB free: crashes in 2 of 4 runs at two files at a time and with
// Chromium alongside; none in 3 runs at one file, 512 stories in about 190 s). Project names
// must be unique, so WebKit's project is `storybook-webkit`; its browser keeps the name
// `storybook (webkit)`, and `--project=storybook*` (`test:stories`) selects both.
const stories = (
  name: string,
  browser: 'chromium' | 'webkit',
  order: number,
  maxWorkers?: number,
): TestProjectInlineConfiguration => ({
  extends: true,
  plugins: [
    storybookTest({
      configDir: fileURLToPath(new URL('./.storybook', import.meta.url)),
      storybookScript: 'pnpm storybook --no-open',
    }),
  ],
  test: {
    name,
    sequence: { groupOrder: order },
    ...(maxWorkers ? { maxWorkers } : {}),
    browser: {
      enabled: true,
      headless: true,
      provider: playwright(),
      instances: [{ browser, name: `storybook (${browser})` }],
    },
  },
})

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
        stories('storybook', 'chromium', 0),
        stories('storybook-webkit', 'webkit', 1, 1),
      ],
    },
  }),
)
