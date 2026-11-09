import { expect, type Page, test } from '@playwright/test'
import { collectErrors, projectContext, signIn, wav } from './helpers'

// Step s35's keymap (12 §8, frozen decision 5) on the real practice screen, desktop only: every key
// is confirmed by the PedalHud within 100 ms; ↑/↓ never change speed and ask for the pedal setup;
// ⌘K / Ctrl K opens the palette, which loops typed bars; with single keys off, character keys are
// inert while Space and Ctrl K keep working. Timings are attached to the test results.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

const speedReadout = () => page.getByRole('button', { name: /^Speed: / })
const hud = () => page.locator('[data-slot=pedal-hud]')

test.beforeAll(async ({ browser }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'the desktop keymap')
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  page = await context.newPage()
  await signIn(page, 'keys')
  errors = collectErrors(page)
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Keys riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 90_000,
  })
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 60_000,
  })
})

test.afterAll(async () => {
  await page?.context().close()
})

/** Milliseconds from the keydown to the HUD showing (its data-visible), measured in the page. */
async function hudLatency(key: string): Promise<number> {
  await page.evaluate(() => {
    const target = document.querySelector('[data-slot=pedal-hud]')?.parentElement ?? document.body
    const w = window as unknown as { __hud?: { down: number; shown: number } }
    w.__hud = { down: 0, shown: 0 }
    window.addEventListener(
      'keydown',
      () => {
        if (w.__hud) w.__hud.down = performance.now()
      },
      { capture: true, once: true },
    )
    const observer = new MutationObserver(() => {
      const shown = document.querySelector('[data-slot=pedal-hud][data-visible]')
      if (shown && w.__hud && w.__hud.down > 0 && w.__hud.shown === 0) {
        w.__hud.shown = performance.now()
        observer.disconnect()
      }
    })
    observer.observe(target, { subtree: true, attributes: true, childList: true })
  })
  await page.keyboard.press(key)
  await expect
    .poll(() =>
      page.evaluate(() => (window as unknown as { __hud: { shown: number } }).__hud.shown),
    )
    .toBeGreaterThan(0)
  return page.evaluate(() => {
    const { down, shown } = (window as unknown as { __hud: { down: number; shown: number } }).__hud
    return shown - down
  })
}

test('every key is confirmed within 100 ms, and ↑/↓ never change speed', async ({
  browserName,
}, info) => {
  await page.locator('#main').focus()
  const timings: string[] = []
  for (const key of ['ArrowUp', 'ArrowDown', ',', '.', 'Shift+Period', 'l']) {
    // A fresh HUD each time: wait for the last one to fade.
    await expect(hud()).not.toHaveAttribute('data-visible', '', { timeout: 6_000 })
    const ms = await hudLatency(key)
    timings.push(`${key} ${ms.toFixed(1)} ms`)
    expect(ms, key).toBeLessThanOrEqual(100)
    if (key.startsWith('Arrow')) {
      await expect(hud()).toContainText('Pedal detected? Set it up')
      await expect(speedReadout()).toHaveAccessibleName(/^Speed: 100\s%/)
    }
  }
  // , then . then Shift+. : 95 → 100 → 100 (the top), so step down and up by 1 % to see Shift.
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 100\s%/)
  await page.keyboard.press(',')
  await page.keyboard.press('Shift+Period')
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 96\s%/)
  info.annotations.push({
    type: `PedalHud latency (${browserName})`,
    description: timings.join(', '),
  })
})

test('⌘K / Ctrl K opens the palette, which loops typed bars', async () => {
  await page.locator('#main').focus()
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await expect(palette).toBeVisible()
  await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill('loop 3-4')
  await expect(palette.getByText('Loop bars 3–4')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(palette).toBeHidden()
  await expect(page.getByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
})

test('with single keys off, character keys are inert and chords still work', async () => {
  const practice = page.url()
  await page.goto('/settings/keyboard')
  const toggle = page.getByRole('switch', { name: 'Single-key shortcuts' })
  await expect(toggle).toBeChecked()
  await toggle.click()
  await expect(toggle).not.toBeChecked()
  await page.goto(practice)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 60_000,
  })
  await page.locator('#main').focus()
  const before = await speedReadout().getAttribute('aria-label')
  await page.keyboard.press('.')
  await page.keyboard.press(',')
  await expect(speedReadout()).toHaveAttribute('aria-label', before ?? '')
  // Space isn't a character shortcut: pedals send it.
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
  await page.keyboard.press('Space')
  await page.keyboard.press('ControlOrMeta+k')
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.keyboard.press('Escape')
  // Back on for the next run on this device.
  await page.goto('/settings/keyboard')
  await page.getByRole('switch', { name: 'Single-key shortcuts' }).click()
})

test('no console errors', async () => {
  expect(errors).toEqual([])
})
