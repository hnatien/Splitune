import { type BrowserContext, expect, type Page, test } from '@playwright/test'

// Step 13 acceptance (prompt 13): installable PWA, app shell offline after the first visit, and
// a cached example song practised offline. Lighthouse 12 dropped its PWA category, so Chromium's
// own installability verdict (the source of the old Lighthouse audit) is checked directly.
// Chromium is the browser the acceptance names; WebKit's result is reported too (it is
// Playwright's WebKit build, not Safari).

test.describe.configure({ mode: 'serial' })

let context: BrowserContext
let page: Page

const loopBadge = () => page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })

test.beforeAll(async ({ browser, browserName, isMobile }) => {
  test.skip(
    isMobile || browserName === 'firefox',
    'desktop Chromium and WebKit (Firefox runs remotely; phones repeat the same engine)',
  )
  context = await browser.newContext({ reducedMotion: 'reduce' })
  page = await context.newPage()
})

test.afterAll(async () => {
  await context?.close()
})

test('the app installs: manifest, icons and a service worker that controls the page', async ({
  browserName,
}) => {
  await page.goto('/start')
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    // clientsClaim: the first version takes over this page as soon as it activates.
    if (!navigator.serviceWorker.controller) {
      await new Promise((resolve) =>
        navigator.serviceWorker.addEventListener('controllerchange', resolve, { once: true }),
      )
    }
  })
  const precached = await page.evaluate(async () => {
    const names = await caches.keys()
    const precache = names.find((n) => n.includes('precache'))
    return precache ? (await (await caches.open(precache)).keys()).length : 0
  })
  expect(precached).toBeGreaterThan(50)
  if (browserName !== 'chromium') return
  const cdp = await context.newCDPSession(page)
  const { installabilityErrors } = await cdp.send('Page.getInstallabilityErrors')
  expect(installabilityErrors).toEqual([])
  const manifest = await cdp.send('Page.getAppManifest')
  expect(manifest.errors).toEqual([])
})

test('an example song played once practises offline, and the app shell opens offline', async () => {
  // Online: the visitor's way in, once, through the service worker.
  await page.goto('/start?step=song&instrument=guitar&level=just_started')
  const play = page.getByRole('button', { name: 'Play your part' })
  await expect(play).toBeEnabled({ timeout: 90_000 })
  const practiceUrl = page.url()
  await play.click()
  await expect(loopBadge()).toBeVisible()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()

  await context.setOffline(true)
  try {
    await page.reload()
    const again = page.getByRole('button', { name: 'Play your part' })
    await expect(again).toBeEnabled({ timeout: 60_000 })
    await again.click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await expect(loopBadge()).toBeVisible()
    expect(page.url()).toBe(practiceUrl)

    await page.goto('/start')
    await expect(page.getByRole('heading', { name: 'What do you play?' })).toBeVisible()
  } finally {
    await context.setOffline(false)
  }
})
