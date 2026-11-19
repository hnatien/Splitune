import { expect, test } from '@playwright/test'
import { openStory } from './story'

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

for (const row of MATRIX) {
  for (const viewport of row.viewports) {
    test.describe(`${row.name} @ ${viewport}`, () => {
      test.use(VIEWPORTS[viewport])
      for (const appearance of row.appearances) {
        test(appearance, async ({ page }) => {
          await openStory(page, row.story, `appearance:${appearance}`)
          await expect(page).toHaveScreenshot(`${row.name}--${viewport}--${appearance}.png`)
        })
      }
    })
  }
}
