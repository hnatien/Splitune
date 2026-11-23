import { expect, type Page, test } from '@playwright/test'
import { collectErrors, projectContext, signIn, wav } from './helpers'

// Step s40b's mixer (12 §7, 27 §3.7.4) with the mock workers' stems (the fixture's guitar, drums
// and other: every stem of the run, so no "Band") and the real audio engine: one row per stem with
// your part first, presets, the M key, and every fader set without a drag (WCAG 2.5.7): a click on
// its track and its readout's stepper. Desktop (the inspector's Mix tab).

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

test.beforeAll(async ({ browser }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'the desktop inspector')
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  page = await context.newPage()
  await signIn(page, 'mixer')
  errors = collectErrors(page)
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Mixer riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 90_000,
  })
  // X opens the tools panel on Mix; its presets appear once the stems play through the mixer.
  await page.locator('#main').focus()
  await page.keyboard.press('x')
  await expect(page.getByRole('tabpanel').getByRole('radiogroup', { name: 'Mix' })).toBeVisible({
    timeout: 90_000,
  })
})

test.afterAll(async () => {
  await page?.context().close()
})

const panel = () => page.getByRole('tabpanel')

test('every stem has a row, your part first, and soloing one leaves the others not heard', async () => {
  await expect(panel().getByRole('radiogroup', { name: 'Mix' })).toBeVisible()
  const names = await panel().locator('[data-slot=stem-row] .truncate').allInnerTexts()
  expect(names).toEqual(['Guitar', 'Drums', 'Other'])
  await expect(panel().getByText('Band', { exact: true })).toHaveCount(0)
  // The fixture's run has no bass, so no Rhythm only.
  await expect(panel().getByRole('radio')).toHaveCount(3)
  await panel().getByRole('button', { name: 'Solo Drums' }).click()
  await expect(panel().getByRole('button', { name: 'Volume Guitar: Not heard' })).toBeVisible()
  await panel().getByRole('button', { name: 'Solo Drums' }).click()
  await expect(panel().getByRole('button', { name: 'Volume Guitar: Not heard' })).toHaveCount(0)
})

test('faders set by a click on the track and by the readout’s stepper, without a drag', async () => {
  const slider = panel().getByRole('slider', { name: 'Volume Drums' })
  const track = panel()
    .locator('[data-slot=slider]')
    .filter({ has: page.getByRole('slider', { name: 'Volume Drums' }) })
    .locator('[data-slot=slider-track]')
  const box = await track.boundingBox()
  if (!box) throw new Error('no track')
  // −30…+6 dB: the far left of the track is the bottom of the range.
  await page.mouse.click(box.x + 1, box.y + box.height / 2)
  await expect(slider).toHaveAttribute('aria-valuenow', '-30')
  await page.mouse.click(box.x + box.width - 1, box.y + box.height / 2)
  await expect(slider).toHaveAttribute('aria-valuenow', '6')

  await panel()
    .getByRole('button', { name: /^Volume Drums: / })
    .click()
  await page.getByRole('button', { name: 'Quieter Drums' }).click()
  await page.getByRole('button', { name: 'Quieter Drums' }).click()
  await expect(slider).toHaveAttribute('aria-valuenow', '4')
  await page.keyboard.press('Escape')
  await expect(panel().getByRole('button', { name: /^Volume Drums: \+4\sdB$/ })).toBeVisible()
  await expect(page.getByRole('tab', { name: /Mix changed/ })).toBeVisible()
})

test('presets, Reset mix and the M key', async () => {
  await panel()
    .getByRole('radio', { name: /^Minus-one/ })
    .click()
  await expect(panel().getByRole('button', { name: 'Mute Guitar' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await expect(page.getByRole('button', { name: /^Minus-one/ }).first()).toBeVisible()
  await panel().getByRole('button', { name: 'Reset mix' }).click()
  await expect(page.getByRole('tab', { name: /Mix changed/ })).toHaveCount(0)
  await page.locator('#main').focus()
  await page.keyboard.press('m')
  await expect(panel().getByRole('button', { name: 'Volume Guitar: muted' })).toBeVisible()
  await expect(page.getByText('Your part muted').first()).toBeVisible()
  expect(errors).toEqual([])
})
