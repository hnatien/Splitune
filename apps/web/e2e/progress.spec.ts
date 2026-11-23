import { expect, type Page, test } from '@playwright/test'
import { collectErrors, projectContext, signIn, wav } from './helpers'

// Step s39's progress (12 §5, 27 §3.5, §3.7.4) through the real API: passes marked by keys on a
// loop at 70 % reach GET /v1/progress with their session, the Progress tab draws them (chart,
// today's stats, the session row) and the library's Continue card, This week and its badges read
// the same answer. Desktop only (the inspector and the keymap).

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

const ready = () =>
  expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({ timeout: 90_000 })

test.beforeAll(async ({ browser }, info) => {
  test.skip(Boolean(info.project.use.hasTouch), 'the desktop inspector and keymap')
  const context = await projectContext(browser, { serviceWorkers: 'block' })
  page = await context.newPage()
  await signIn(page, 'progress')
  errors = collectErrors(page)
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Progress riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
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

test('passes on a loop show on the Progress tab with the cold pass and today’s counts', async () => {
  await page.locator('#main').focus()
  for (let i = 0; i < 6; i++) await page.keyboard.press(',')
  await page.keyboard.press('ControlOrMeta+k')
  const palette = page.getByRole('dialog')
  await palette.getByRole('combobox').or(palette.getByRole('textbox')).first().fill('loop 3-4')
  // The loop is saved as a clip (12 §5) and the list refetched; passes then carry the clip.
  const loops = (method: string) => (r: { url(): string; request(): { method(): string } }) =>
    /\/v1\/songs\/[^/]+\/loops$/.test(new URL(r.url()).pathname) && r.request().method() === method
  let saved = false
  void page.waitForResponse(loops('POST')).then(() => {
    saved = true
  })
  const listed = page.waitForResponse((r) => saved && loops('GET')(r))
  await page.keyboard.press('Enter')
  await expect(palette).toBeHidden()
  await expect(page.getByRole('button', { name: /^Loop · bars 3–4/ })).toBeVisible()
  await listed

  await page.locator('#main').focus()
  for (const key of ['n', 'c', 'c']) {
    const synced = page.waitForResponse(
      (r) => r.url().includes('/v1/practice/sync') && r.request().method() === 'POST' && r.ok(),
    )
    await page.keyboard.press(key)
    await synced
  }

  // The tools panel is closed until asked for: X opens it (on Mix), then its Progress tab.
  await page.keyboard.press('x')
  await page.getByRole('tab', { name: 'Progress' }).click()
  const panel = page.getByRole('tabpanel')
  await expect(panel.getByRole('heading', { name: 'Bars 3–4' })).toBeVisible()
  await expect(
    panel.getByRole('img', {
      name: 'Best clean speed 70 percent in one session. First clean pass 70 percent.',
    }),
  ).toBeVisible()
  // Today's figures (Stat: the figure over its label).
  const today = panel.getByRole('group', { name: 'Today' })
  await expect(today.locator('[data-slot=stat]', { hasText: /^70\s%/ })).toBeVisible()
  await expect(today.locator('[data-slot=stat]', { hasText: /^2 \/ 3/ })).toBeVisible()
  const sessions = panel.getByRole('region', { name: 'Sessions' }).getByRole('listitem')
  await expect(sessions).toHaveCount(1)
  await expect(sessions.first()).toContainText(/^Today.*3 passes.*best 70\s%$/)
})

test('the library picks up the clip, today’s first clean pass and this week', async () => {
  await page.goto('/library')
  const lead = page.getByRole('region', { name: 'Pick up where you left off' })
  await expect(lead.getByRole('heading', { level: 2, name: 'Progress riff' })).toBeVisible()
  await expect(lead).toContainText(/bars 3–4 · today, \d+\smin/)
  await expect(lead.getByText(/^Today's first clean pass: 70\s%$/)).toBeVisible()
  await expect(lead.getByText(/^Best clean 70\s%$/)).toBeVisible()
  const week = page.getByRole('region', { name: 'This week' })
  await expect(week.getByRole('img', { name: 'Practised on 1 of the last 7 days' })).toBeVisible()
  await expect(week.getByText('clean passes')).toBeVisible()
  await expect(page.getByRole('region', { name: 'Worth a revisit' })).toHaveCount(0)
  expect(errors).toEqual([])
})
