import { expect, type Page } from '@playwright/test'

// Opens a built story the way every visual row does: a fixed clock (relative dates, renewal dates
// and the evening hints never change between runs), the story rendered and its play function
// finished, network quiet, alphaTab's first glyphs drawn and the fonts loaded.
export const FIXED_NOW = new Date('2026-10-22T10:00:00Z')

export async function openStory(page: Page, story: string, globals?: string) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto(`/iframe.html?id=${story}&viewMode=story${globals ? `&globals=${globals}` : ''}`)
  const phase = await page.waitForFunction(
    () => {
      const current = (
        window as unknown as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } }
      ).__STORYBOOK_PREVIEW__?.currentRender?.phase
      return current === 'finished' || current === 'errored' ? current : false
    },
    null,
    { timeout: 60_000 },
  )
  expect(await phase.jsonValue(), `${story} rendered without errors`).toBe('finished')
  await page.waitForLoadState('networkidle')
  const score = page.locator('[data-slot=alphatab-view]')
  if (await score.isVisible()) await expect(score.locator('svg').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}
