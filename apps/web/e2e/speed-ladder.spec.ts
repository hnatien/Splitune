import { expect, type Page, test } from '@playwright/test'
import { collectErrors, projectContext, signIn, wav } from './helpers'

// Step s37's speed ladder (21 V1, 12 §5) on the real practice screen, desktop, by keys alone: a
// loop at 70 % with the ladder on steps to 75 % after three Felt clean passes; while the loop
// plays the step waits for the loop seam; the ladder and the learner's place on it are saved on
// the clip and come back after a reload.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

const speedReadout = () => page.getByRole('button', { name: /^Speed: / })
const loopPill = () => page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })
const ladderSwitch = () => page.getByRole('switch', { name: 'Speed ladder' })
const hud = () => page.locator('[data-slot=pedal-hud]')
const ready = () =>
  expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 90_000 })

test.beforeAll(async ({ browser }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'the desktop Loop tab and keymap')
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  page = await context.newPage()
  await signIn(page, 'ladder')
  errors = collectErrors(page)
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Ladder riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
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

test('a loop at 70 % with the ladder on steps to 75 % after three Felt clean passes', async () => {
  await page.locator('#main').focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press(',')
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 70\s%/)
  // The palette loops typed bars (12 §8); a new loop has no ladder until the learner asks for one.
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill('loop 3-4')
  await expect(palette.getByText('Loop bars 3–4')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(palette).toBeHidden()
  await expect(loopPill()).toBeVisible()
  await expect(ladderSwitch()).not.toBeChecked()
  await ladderSwitch().focus()
  await page.keyboard.press('Space')
  await expect(ladderSwitch()).toBeChecked()
  // It never speeds the learner up: 70 % is the first rung, the goal shows in the dock.
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 70\s%.*→ 100, ladder goal 100\s%$/)
  await expect(page.getByRole('img', { name: '70 percent now, 75 percent next' })).toBeVisible()
  await expect(loopPill()).toHaveAccessibleName(/pass 1 of 3 at 70\s%/)

  await page.locator('#main').focus()
  await page.keyboard.press('c')
  await expect(loopPill()).toHaveAccessibleName(/pass 2 of 3 at 70\s%/)
  await page.keyboard.press('c')
  await expect(loopPill()).toHaveAccessibleName(/pass 3 of 3 at 70\s%/)
  await page.keyboard.press('c')
  // Nothing is sounding, so the step is taken at once.
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 75\s%/)
  await expect(hud()).toContainText(/Speed 75\s% · ladder/)
  await expect(loopPill()).toHaveAccessibleName(/pass 1 of 3 at 75\s%/)
  await expect(
    page.getByRole('img', { name: '70 percent done, 75 percent now, 80 percent next' }),
  ).toBeVisible()
})

test('while the loop plays, the step waits for the seam and its count-in', async () => {
  await page.locator('#main').focus()
  await page.keyboard.press('Space')
  // Count-in before each pass, then the pass itself.
  await expect(page.locator('[data-slot=count-in]')).toBeVisible()
  await expect(page.locator('[data-slot=count-in]')).toBeHidden({ timeout: 10_000 })
  for (let i = 0; i < 3; i++) await page.keyboard.press('c')
  // The ladder already stands on 80 %; the sound stays at 75 % until the pass ends.
  await expect(loopPill()).toHaveAccessibleName(/pass 1 of 3 at 80\s%/)
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 75\s%/)
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 80\s%/, { timeout: 20_000 })
  await expect(hud()).toContainText(/Speed 80\s% · ladder/)
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
})

test('the ladder and the place on it come back after a reload', async () => {
  const songId = new URL(page.url()).pathname.split('/')[2] ?? ''
  await expect
    .poll(
      async () => {
        const [loops, song] = (await Promise.all([
          page.request.get(`/v1/songs/${songId}/loops`).then((r) => r.json()),
          page.request.get(`/v1/songs/${songId}`).then((r) => r.json()),
        ])) as [
          { items: { id: string; trainer: { current_pct?: number; on_goal: string } | null }[] },
          { player_state: { selected_loop_id?: string | null } },
        ]
        const clip = loops.items.find((item) => item.id === song.player_state.selected_loop_id)
        return [clip?.trainer?.current_pct, clip?.trainer?.on_goal]
      },
      { timeout: 15_000 },
    )
    .toEqual([80, 'keep'])
  await page.reload()
  await ready()
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 80\s%.*→ 100/)
  await expect(ladderSwitch()).toBeChecked()
  await expect(loopPill()).toHaveAccessibleName(/pass 1 of 3 at 80\s%/)
  await expect(page.getByRole('img', { name: /80 percent now, 85 percent next$/ })).toBeVisible()
  expect(errors).toEqual([])
})

test('a saved clip chosen from the palette comes back with its ladder', async () => {
  const panel = page.getByRole('tabpanel', { name: 'Loop' })
  await panel.getByRole('button', { name: 'Save this loop' }).click()
  await panel.getByLabel('Clip name').fill('Chorus climb')
  await panel.getByRole('button', { name: 'Save clip' }).click()
  await expect(panel.getByRole('button', { name: /^Chorus climb/ })).toBeVisible()
  // Leave the clip: no loop, and the speed back at 100 %.
  await panel.getByRole('button', { name: 'Clear loop' }).click()
  await expect(ladderSwitch()).toBeHidden()
  await page.locator('#main').focus()
  for (let i = 0; i < 4; i++) await page.keyboard.press('.')
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 100\s%/)

  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill('Chorus climb')
  await expect(palette.getByText('Chorus climb')).toBeVisible()
  await page.keyboard.press('Enter')
  await expect(palette).toBeHidden()
  await expect(ladderSwitch()).toBeChecked()
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 80\s%.*→ 100/)
  await expect(loopPill()).toHaveAccessibleName(/^Loop · bars 3–4, pass 1 of 3 at 80\s%/)
  expect(errors).toEqual([])
})
