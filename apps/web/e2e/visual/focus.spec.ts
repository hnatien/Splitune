import { expect, test } from '@playwright/test'

// Focus is never hidden by the sticky shell bar (26 §7, WCAG 2.4.11): a control scrolled under the
// bar comes back into view below it when it takes focus.
test.use({ viewport: { width: 390, height: 500 }, hasTouch: true, isMobile: true })

test('a focused control scrolls clear of the sticky app bar', async ({ page }) => {
  await page.goto('/iframe.html?id=screens-library--populated&viewMode=story')
  await page.waitForFunction(
    () =>
      (window as unknown as { __STORYBOOK_PREVIEW__?: { currentRender?: { phase?: string } } })
        .__STORYBOOK_PREVIEW__?.currentRender?.phase === 'finished',
  )
  const menus = page.getByRole('button', { name: /^More for/ })
  const target = menus.nth(3)
  await menus.nth(4).focus()
  const box = await target.boundingBox()
  if (!box) throw new Error('no card menu')
  // Put the control just under the bar, then move focus onto it.
  await page.evaluate((y) => window.scrollTo(0, window.scrollY + y - 30), box.y)
  await target.focus()
  const header = await page.getByRole('banner').boundingBox()
  const focused = await target.boundingBox()
  expect(focused?.y).toBeGreaterThanOrEqual((header?.y ?? 0) + (header?.height ?? 0))
})
