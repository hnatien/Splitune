import { expect, type Page, test } from '@playwright/test'

// The visual matrix of 28 §4 (~36 images per engine): key screens × appearances × viewports,
// each a Screens/ story with fixture data. The clock is fixed so relative dates, renewal dates
// and the evening Stage hint never change between runs.

type Appearance = 'light' | 'dark' | 'stage'
type Viewport = 'phone' | 'tablet' | 'desktop'

const VIEWPORTS: Record<Viewport, Parameters<typeof test.use>[0]> = {
  phone: { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true },
  tablet: { viewport: { width: 1180, height: 820 }, hasTouch: true, isMobile: true },
  desktop: { viewport: { width: 1440, height: 900 }, hasTouch: false, isMobile: false },
}
const ALL: Viewport[] = ['phone', 'tablet', 'desktop']
const FIXED_NOW = new Date('2026-10-22T10:00:00Z')

const MATRIX: { name: string; story: string; appearances: Appearance[]; viewports: Viewport[] }[] =
  [
    {
      name: 'home',
      story: 'screens-home--signed-out',
      appearances: ['light', 'dark'],
      viewports: ALL,
    },
    {
      name: 'library',
      story: 'screens-library--populated',
      appearances: ['light', 'dark'],
      viewports: ALL,
    },
    {
      name: 'import-file',
      story: 'screens-import--file-selected',
      appearances: ['light', 'dark'],
      viewports: ALL,
    },
    // Tab ready, loop on bars 5–6, the fixture's low-confidence notes outlined and marked "?".
    {
      name: 'practice',
      story: 'screens-practice--loop-active',
      appearances: ['light', 'dark', 'stage'],
      viewports: ALL,
    },
    // Stems ready, tab pending (27 §3.7.3).
    {
      name: 'practice-tab-pending',
      story: 'screens-practice--chords',
      appearances: ['light'],
      viewports: ['tablet'],
    },
    {
      name: 'practice-stems-expired',
      story: 'screens-practice--stems-expired',
      appearances: ['light'],
      viewports: ['tablet'],
    },
    {
      name: 'mock-checkout',
      story: 'screens-billing--checkout',
      appearances: ['light'],
      viewports: ['phone', 'desktop'],
    },
    {
      name: 'settings-display',
      story: 'screens-settings--display',
      appearances: ['light'],
      viewports: ['phone', 'desktop'],
    },
    {
      name: 'settings-privacy',
      story: 'screens-settings--privacy',
      appearances: ['light'],
      viewports: ['phone', 'desktop'],
    },
    {
      name: 'account-deleted',
      story: 'screens-system--account-was-deleted',
      appearances: ['light'],
      viewports: ['phone'],
    },
  ]

async function openStory(page: Page, story: string, appearance: Appearance) {
  await page.clock.setFixedTime(FIXED_NOW)
  await page.goto(`/iframe.html?id=${story}&viewMode=story&globals=appearance:${appearance}`)
  // The story rendered and its play function (which waits for the screen's state) passed.
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
  // alphaTab draws in its worker after the story settles: wait for the score's first glyphs.
  const score = page.locator('[data-slot=alphatab-view]')
  if (await score.isVisible()) await expect(score.locator('svg').first()).toBeVisible()
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
}

for (const row of MATRIX) {
  for (const viewport of row.viewports) {
    test.describe(`${row.name} @ ${viewport}`, () => {
      test.use(VIEWPORTS[viewport])
      for (const appearance of row.appearances) {
        test(appearance, async ({ page }) => {
          await openStory(page, row.story, appearance)
          await expect(page).toHaveScreenshot(`${row.name}--${viewport}--${appearance}.png`)
        })
      }
    })
  }
}
