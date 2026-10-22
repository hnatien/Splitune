// The offline-render scenarios through the real AudioWorklet in each browser engine.
import { expect, test } from '@playwright/test'
import { scenarios } from '../scenarios.ts'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.waitForFunction(() => 'harness' in window)
})

for (const scenario of scenarios) {
  test(scenario.name, async ({ page }) => {
    const result = await page.evaluate((name) => window.harness.run(name), scenario.name)
    scenario.check(result, expect)
  })
}
