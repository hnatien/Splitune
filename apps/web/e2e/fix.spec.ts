import { expect, type Page, test } from '@playwright/test'
import { collectErrors, projectContext, signIn, wav } from './helpers'

// Step s38's Fix mode (12 §4, 27 §3.7.4) on the real practice screen, desktop: J enters Fix mode
// on the song's unsure spot with focus on its first action, "It's right" is saved and still there
// after a reload, and an edit made offline waits on the device and is sent when the connection is
// back. The mock analysis is the contracts' fixture: one unsure note, in bar 4.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

const ready = () =>
  expect(page.getByRole('button', { name: /^Play/ }).first()).toBeEnabled({ timeout: 90_000 })
const panel = () => page.getByRole('tabpanel')
const pill = () => page.getByText('Fixing · every change saves as you go')
const corrections = () =>
  page.waitForResponse(
    (r) => /\/corrections$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
    { timeout: 30_000 },
  )
const NOTE = /· string \d, fret \d+$/

test.beforeAll(async ({ browser }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'Fix mode needs the inspector (desktop)')
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  page = await context.newPage()
  await signIn(page, 'fix')
  errors = collectErrors(page)
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Fix riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  await ready()
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 60_000,
  })
})

test.afterAll(async () => {
  await page?.context().close()
})

test('J enters Fix mode on the unsure spot, and "It\'s right" survives a reload', async () => {
  await expect(page.getByRole('tab', { name: /^Fix/ })).toHaveAccessibleName(/1 unsure/)
  await page.locator('#main').focus()
  await page.keyboard.press('j')
  await expect(panel().getByRole('heading', { name: 'Spot 1 of 1 · bar 4' })).toBeVisible()
  await expect(pill()).toBeVisible()
  // The selected bar loops in the Fix dock.
  const dock = page.getByRole('toolbar', { name: 'Playback' })
  await expect(dock.getByRole('button', { name: 'Play bar 4' })).toBeEnabled()
  await expect(dock.getByRole('group', { name: 'Listen to' })).toBeVisible()
  // Keys only: the spot's first action has focus.
  await expect(panel().getByRole('button', { name: "It's right" })).toBeFocused()
  const saved = corrections()
  await page.keyboard.press('Enter')
  await expect(page.getByText('Edit saved · bar 4')).toBeVisible()
  expect((await saved).ok()).toBe(true)
  await expect(page.getByRole('tab', { name: 'Fix', exact: true })).toBeVisible()

  await page.reload()
  await ready()
  await expect(page.getByRole('tab', { name: 'Fix', exact: true })).toBeVisible()
  await page.getByRole('tab', { name: 'Fix', exact: true }).click()
  await expect(pill()).toBeVisible()
  await expect(panel().getByText('Nothing marked unsure in this song.')).toBeVisible()
  await expect(panel().getByText('Marked as correct · bar 4')).toBeVisible()
  await expect(panel().getByText('Your fixes are saved for this song.')).toBeVisible()
  expect(errors).toEqual([])
})

test('an edit made offline waits on this device and is sent when the connection is back', async () => {
  // E takes the bar at the playhead (the first bar).
  await page.locator('#main').focus()
  await page.keyboard.press('e')
  await panel().getByRole('button', { name: NOTE }).first().click()
  const note = panel().getByRole('button', { name: NOTE, pressed: true })
  const before = await note.innerText()

  await page.context().setOffline(true)
  await panel().getByRole('button', { name: 'Fret up' }).click()
  await expect(page.getByText(/^Saved on this device · bar 1, string \d → fret \d+$/)).toBeVisible()
  // Applied at once all the same.
  await expect(note).not.toHaveText(before)
  const after = await note.innerText()
  const edits = panel().getByRole('region', { name: 'Your edits' })
  await expect(edits.getByText('Saved on this device')).toBeVisible({ timeout: 20_000 })

  const sent = corrections()
  await page.context().setOffline(false)
  expect((await sent).ok()).toBe(true)
  await expect(edits.getByText('Saved on this device')).toBeHidden()

  await page.reload()
  await ready()
  await page.locator('#main').focus()
  await page.keyboard.press('e')
  await expect(panel().getByRole('button', { name: after })).toBeVisible()
  await expect(panel().getByText('Changed a note · bar 1')).toBeVisible()
})

test('Done hands the practice screen back', async () => {
  await page.getByRole('button', { name: 'Done', exact: true }).click()
  await expect(pill()).toBeHidden()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled()
})
