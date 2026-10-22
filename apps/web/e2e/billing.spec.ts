import { expect, type Page, test } from '@playwright/test'
import pg from 'pg'
import {
  collectErrors,
  expectAccessible,
  expectNoCardInputs,
  expectNoHorizontalScroll,
  signIn,
} from './helpers'

// Step 14 acceptance (prompt 14): a Free user uses the Welcome analysis → the Lite allowance → the
// cap message → upgrades through the mock checkout (declined first) → a Full analysis is allowed
// and queued ahead of Free work → cancels in one tap → Plus continues to the period end → the dev
// clock passes it → back on Free. Every billing page is scanned for card inputs and checked by axe.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]
const songs: string[] = []
const LINK = 'https://www.youtube.com/watch?v=h_N0-H49R6I'
const LITE_PER_MONTH = 5

async function importLink(type: 'Full' | 'Lite') {
  await page.goto('/import')
  await page.getByRole('tab', { name: 'Link' }).click()
  await page.getByLabel('Link to a video or song').fill(LINK)
  await page.getByRole('radio', { name: new RegExp(`^${type}`) }).check()
  await page.getByRole('button', { name: 'Import and analyse' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  const songId = new URL(page.url()).pathname.split('/')[2] as string
  songs.push(songId)
  return songId
}

/** Queue priority of a song's analysis jobs, from the throwaway database (e2e/global-setup.ts). */
async function prioritiesOf(songId: string): Promise<number[]> {
  const { E2E_DATABASE_URL: connectionString } = process.env
  const client = new pg.Client({ connectionString })
  await client.connect()
  try {
    const { rows } = await client.query(
      `select distinct j.priority from jobs j join analyses a on a.id = j.analysis_id
       where a.song_id = $1`,
      [songId],
    )
    return rows.map((r: { priority: number }) => r.priority)
  } finally {
    await client.end()
  }
}

async function advanceClock(days: number) {
  // WebKit reports fetches a reload aborts as console errors: let the page settle first.
  await page.waitForLoadState('networkidle')
  const res = await page.request.post('/internal/dev/clock', {
    headers: { 'x-splitune-csrf': '1' },
    data: { advance_days: days },
  })
  expect(res.status()).toBe(200)
}

async function checkBillingPage() {
  await expectNoCardInputs(page)
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
}

test.beforeAll(async ({ browser }, info) => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    serviceWorkers: 'block',
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
  })
  page = await context.newPage()
  await signIn(page, `e2e-billing-${info.project.name}-${Date.now()}@splitune.localhost`)
  // From here on: the sign-in helper waits out the shared per-IP limit (429s it handles).
  errors = collectErrors(page)
})

test.afterAll(async () => {
  // Deleting the songs takes their queued analyses with them, so later specs don't wait behind
  // this journey's work on the shared mock workers.
  for (const songId of songs) {
    await page.request.delete(`/v1/songs/${songId}`, { headers: { 'x-splitune-csrf': '1' } })
  }
  await page.context().close()
})

test('billing: pricing shows Free and Plus without card fields or dark patterns', async () => {
  await page.goto('/pricing')
  await expect(page.getByText('Demo mode — no real charges.')).toBeVisible()
  await expect(page.getByRole('radio', { name: /Monthly/ })).toBeChecked()
  await expect(page.getByText('$9.99 a month')).toBeVisible()
  await expect(page.getByText('$79.99 a year')).toBeVisible()
  await expect(page.getByText(/most popular/i)).toHaveCount(0)
  await checkBillingPage()
})

test('billing: the Welcome analysis is the first full one, then Full is locked', async () => {
  await page.goto('/import')
  await expect(
    page.getByText('Your first full analysis is free — your part isolated, plus tab.'),
  ).toBeVisible()
  const songId = await importLink('Full')
  expect(await prioritiesOf(songId)).toEqual([100])
  await page.goto('/import')
  await expect(page.getByText(/Full analyses are part of Plus/)).toBeVisible()
  await expect(page.getByRole('radio', { name: /^Full/ })).toBeDisabled()
})

test('billing: the Lite allowance runs out with its exact limit and reset date', async () => {
  for (let i = 0; i < LITE_PER_MONTH; i++) await importLink('Lite')
  await page.goto('/settings/billing')
  await expect(
    page.getByRole('main').getByText(/^0 of 5 Lite analyses left · resets /),
  ).toBeVisible()
  await page.goto('/import')
  await expect(
    page.getByText(/You've used this month's 5 Lite analyses\. They reset on \d+ \w+/),
  ).toBeVisible()
  // Nothing can start: Full is Plus' and Lite is used up (the page reopens on the Link tab).
  await expect(page.getByRole('radio', { name: /^Lite/ })).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Import and analyse' })).toBeDisabled()
})

test('billing: a declined payment changes nothing, a successful one upgrades to Plus', async () => {
  await page.getByRole('button', { name: 'See Plus' }).first().click()
  await expect(page.getByRole('heading', { name: 'Plus gives you' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Monthly/ })).toBeChecked()
  await expectNoCardInputs(page, '[data-slot=drawer-popup]')
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Continue to checkout' }).click()

  await expect(page).toHaveURL(/\/billing\/mock-checkout\?session=/)
  await expect(page.getByText('Splitune Plus, monthly')).toBeVisible()
  await checkBillingPage()
  await page.getByRole('button', { name: 'Simulate declined card' }).click()
  await expect(
    page.getByText('The (simulated) payment was declined. Nothing was charged.'),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Simulate successful payment' }).click()

  await expect(page).toHaveURL(/\/settings\/billing\?checkout=success/)
  await expect(
    page.getByText(/^You're on Plus\. 15 full analyses a month, resets \d+ \w+/),
  ).toBeVisible()
  await expect(page.getByText('Splitune Plus, monthly')).toBeVisible()
  await checkBillingPage()
})

test('billing: Plus allows a Full analysis and queues it first', async () => {
  const songId = await importLink('Full')
  expect(await prioritiesOf(songId)).toEqual([50])
  await page.goto('/settings/billing')
  await expect(page.getByRole('main').getByText(/^14 of 15 full analyses left/)).toBeVisible()
})

test('billing: the portal shows the plan, and Settings cancels in one tap', async () => {
  await page.goto('/settings/billing')
  await page.getByRole('button', { name: 'Manage plan' }).click()
  await expect(page).toHaveURL(/\/billing\/mock-portal\?session=/)
  await expect(page.getByText(/^Renews on \d+ \w+/)).toBeVisible()
  await checkBillingPage()
  await page.getByRole('link', { name: 'Back to Plan & billing' }).click()

  await page.getByRole('button', { name: 'Cancel Plus' }).click()
  await expect(
    page.getByText(/^Plus stays active until \d+ \w+.*Then you'll be on Free/),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Resume Plus' })).toBeVisible()
  await expect(page.getByText(/^Ends on \d+ \w+/)).toBeVisible()
})

test('billing: Plus lasts to the period end, then the account is back on Free', async () => {
  await advanceClock(20)
  await page.reload()
  await expect(page.getByText('Splitune Plus, monthly')).toBeVisible()
  await advanceClock(15)
  await page.reload()
  await expect(page.getByText('Free', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'See Plus' })).toBeVisible()
  // A new month on the billing clock: the Lite allowance is back.
  await expect(
    page.getByRole('main').getByText(/^5 of 5 Lite analyses left · resets /),
  ).toBeVisible()
  await checkBillingPage()
})

// Fetches a navigation cancels are already left out by collectErrors (helpers.ts).
test('billing: no console errors', async () => {
  expect(errors).toEqual([])
})
