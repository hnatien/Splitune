import { expect, type Page, test } from '@playwright/test'
import { collectErrors, expectAccessible, expectNoHorizontalScroll, signIn, wav } from './helpers'

// Step 10 acceptance (prompt 10): sign in via Mailpit → upload a short audio file → stages
// progress → ready in the library; URL import shows progress; delete works; an upload survives a
// reload mid-transfer; no console (CORS) errors; axe on landing, library and import.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]

// The StageList's progress label (a polite live region announces the same words).
const finished = () => page.locator('[data-slot=progress-label]', { hasText: 'Analysis finished' })

test.beforeAll(async ({ browser }, info) => {
  // One context per project (with its device), shared by the serial tests below.
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use
  // Reduced motion: colour transitions finish instantly, so axe never samples a half-faded state.
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
  })
  page = await context.newPage()
  errors = collectErrors(page)
  const email = `e2e-${info.project.name}-${Date.now()}@splitune.localhost`
  await signIn(page, email)
})

test.afterAll(async () => {
  await page.context().close()
})

test('landing page is accessible and leads to the example', async () => {
  await page.goto('/')
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Learn the songs you love, one loop at a time.',
  )
  await expect(page.getByRole('link', { name: 'Try an example song' })).toHaveAttribute(
    'href',
    '/start',
  )
  await expectAccessible(page)
})

test('the empty library is accessible', async () => {
  await page.goto('/library')
  await expect(page.getByText('Your library is empty.')).toBeVisible()
  await expectAccessible(page)
})

async function pickFile(name: string, buffer: Buffer) {
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page.locator('input[type=file]').setInputFiles({ name, mimeType: 'audio/wav', buffer })
  await expect(page.getByRole('img', { name: new RegExp(`Waveform of ${name}`) })).toBeVisible()
}

test('a short file uploads, analyses and shows as ready', async () => {
  await pickFile('Riff in A minor.wav', wav(3))
  const start = page.getByRole('button', { name: 'Start practising' })
  await expect(start).toBeEnabled()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
  await start.click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  await expect(page.getByRole('progressbar')).toBeVisible()
  await expect(finished()).toBeVisible({ timeout: 90_000 })
  for (const stage of ['Reading the audio', 'Finding the beat', 'Building the tab']) {
    await expect(page.locator('li', { hasText: stage })).toHaveAttribute('data-status', 'done')
  }
  await page.getByRole('link', { name: 'Back to library' }).click()
  const card = page.getByRole('article').filter({ hasText: 'Riff in A minor' })
  await expect(card.getByText('Ready')).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
})

test('a link import shows its download and analysis progress', async () => {
  await page.goto('/import')
  await page.getByRole('tab', { name: 'Link' }).click()
  await page
    .getByLabel('Link to a video or song')
    .fill('https://www.youtube.com/watch?v=h_N0-H49R6I')
  await page.getByRole('button', { name: 'Import and analyse' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  await expect(page.locator('li', { hasText: 'Downloading' })).toBeVisible()
  await expect(finished()).toBeVisible({ timeout: 90_000 })
})

test('an upload interrupted by a reload resumes instead of restarting', async () => {
  // 21 MB → three 8 MiB parts. Parts 2 and 3 are held until the reload; part 1 lands first.
  const held: string[] = []
  await page.route(/localhost:8333\/.*partNumber=[23]/, (route) => {
    held.push(route.request().url())
  })
  const take = wav(240)
  await pickFile('Long take.wav', take)
  await expect(page.getByRole('button', { name: 'Start practising' })).toBeEnabled()
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/practice/)
  await expect
    .poll(
      () =>
        page.evaluate(
          () =>
            new Promise<number>((resolve) => {
              const open = indexedDB.open('splitune')
              open.onsuccess = () => {
                const all = open.result.transaction('uploads').objectStore('uploads').getAll()
                all.onsuccess = () =>
                  resolve(
                    Math.max(0, ...all.result.map((u: { parts: unknown[] }) => u.parts.length)),
                  )
              }
            }),
        ),
      { timeout: 60_000 },
    )
    .toBe(1)
  await page.unroute(/localhost:8333\/.*partNumber=[23]/)

  const afterReload: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'PUT' && request.url().includes('partNumber='))
      afterReload.push(request.url())
  })
  await page.reload()
  // Browsers that can't keep the file in IndexedDB (WebKit's ephemeral contexts, like Safari
  // private browsing) ask for the same file again; the others continue on their own.
  const chooseAgain = page.getByRole('button', { name: 'Choose the file' })
  await expect(
    page
      .getByText(/^Uploading/)
      .or(chooseAgain)
      .or(finished())
      .first(),
  ).toBeVisible()
  if (await chooseAgain.isVisible()) {
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'Long take.wav', mimeType: 'audio/wav', buffer: take })
  }
  await expect(finished()).toBeVisible({ timeout: 90_000 })
  expect(afterReload.some((url) => /partNumber=1(&|$)/.test(url))).toBe(false)
  expect(afterReload.filter((url) => /partNumber=[23](&|$)/.test(url)).length).toBe(2)
})

test('delete removes the song', async () => {
  await page.goto('/library')
  const card = page.getByRole('article').filter({ hasText: 'Riff in A minor' })
  await card.getByRole('button', { name: 'More for Riff in A minor' }).click()
  await page.getByRole('menuitem', { name: 'Delete song' }).click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Delete “Riff in A minor”?')
  await dialog.getByRole('button', { name: 'Delete song' }).click()
  await expect(card).toHaveCount(0)
})

test('no console errors, CORS included', async () => {
  expect(errors).toEqual([])
})
