import { expect, type Page, test } from '@playwright/test'
import { E2E_EXAMPLE } from './global-setup'
import { collectErrors, expectAccessible, expectNoHorizontalScroll, magicLink } from './helpers'

// Step 13 acceptance (prompt 13): a fresh browser reaches a slowed loop of an isolated part from
// /start without signing in, in under 10 scripted steps, on a phone-sized viewport in Chromium,
// WebKit and Firefox (desktop Chromium and WebKit too); then signing in from "Save your progress?"
// keeps the loop and the pass. The example is the one global-setup built through
// `pnpm examples:build` with the mock-mode workers (the contracts' 8-bar fixture at 100 BPM).
// Time to the first slowed loop is attached to the results.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]
let looped: { bars: string; ms: number }

const PHONE = { width: 390, height: 844 }
const loopBadge = () => page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })

test.beforeAll(async ({ browser, browserName }, info) => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use
  // Firefox has no device emulation: its run is the phone viewport alone.
  const firefox = browserName === 'firefox'
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    ...(firefox ? { viewport: PHONE } : viewport ? { viewport } : {}),
    ...(userAgent && !firefox ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
  })
  page = await context.newPage()
  errors = collectErrors(page)
})

test.afterAll(async () => {
  await page.context().close()
})

test('a fresh visitor reaches a slowed loop of their part without signing in', async () => {
  const info = test.info()
  const started = Date.now()
  // 1. Land on /start.
  await page.goto('/start')
  await expect(page.getByRole('heading', { name: 'What do you play?' })).toBeVisible()
  await expect(page.getByText('Step 1 of 5')).toBeVisible()
  await expectAccessible(page)
  await expectNoHorizontalScroll(page)
  // 2. Instrument.
  await page.getByRole('button', { name: 'Guitar', exact: true }).click()
  // 3. Level.
  await page.getByRole('button', { name: 'Just started' }).click()
  await expect(page.getByRole('heading', { name: "Where's your screen?" })).toBeVisible()
  await expectAccessible(page)
  // 4. Skip the screen step.
  await page.getByRole('button', { name: 'Skip' }).click()
  // The example's practice screen loads behind its card; the card's button starts the audio.
  const card = page.getByRole('dialog', { name: 'Your first song' })
  await expect(card).toBeVisible({ timeout: 30_000 })
  await expect(card.getByText(E2E_EXAMPLE.title).first()).toBeVisible()
  const play = card.getByRole('button', { name: 'Play your part' })
  await expect(play).toBeEnabled({ timeout: 90_000 })
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice\?.*guide=true/)
  // 5. Play your part: the suggested phrase loops at 70 % with the part loud.
  await play.click()
  await expect(loopBadge()).toBeVisible()
  await expect(page.getByText(/We've looped bars \d+–\d+ at 70\s%/)).toBeVisible()
  await expect(loopBadge()).toHaveText(/pass 1/, { timeout: 60_000 })
  const bars = (await loopBadge().innerText()).match(/bars (\d+–\d+)/)?.[1] ?? ''
  looped = { bars, ms: Date.now() - started }
  info.annotations.push({
    type: 'time to first slowed loop',
    description: `${(looped.ms / 1000).toFixed(1)} s (5 scripted steps, bars ${bars} at 70 %)`,
  })
  console.log(
    `[${info.project.name}] time to first slowed loop: ${(looped.ms / 1000).toFixed(1)} s`,
  )
  expect(errors).toEqual([])
})

test('signing in from "Save your progress?" keeps the loop and the pass', async () => {
  const info = test.info()
  // Mark the pass, then stop: the save sheet waits for playback to stop (never mid-pass).
  await page.getByRole('button', { name: 'Felt clean' }).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const sheet = page.getByRole('dialog', { name: 'Save your progress?' })
  await expect(sheet).toBeVisible()
  await expectAccessible(page)
  const email = `e2e-onboarding-${info.project.name}-${Date.now()}@splitune.localhost`
  await sheet.getByLabel('Email').fill(email)
  await sheet.getByRole('button', { name: 'Continue' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  await page.goto(await magicLink(email))
  await expect(page).toHaveURL(/\/start\/saved/)
  await expect(page.getByRole('heading', { name: 'Your progress is saved' })).toBeVisible({
    timeout: 30_000,
  })
  await expectAccessible(page)

  const library = (await (await page.request.get('/v1/songs')).json()) as {
    items: { id: string; title: string; source_kind: string }[]
  }
  const song = library.items.find((s) => s.source_kind === 'example')
  expect(song?.title).toBe(E2E_EXAMPLE.title)
  const loops = (await (await page.request.get(`/v1/songs/${song?.id}/loops`)).json()) as {
    items: { start_bar: number; end_bar: number; best_clean_tempo_pct: number | null }[]
  }
  expect(loops.items.map((l) => `${l.start_bar + 1}–${l.end_bar + 1}`)).toEqual([looped.bars])
  expect(loops.items[0]?.best_clean_tempo_pct).toBe(70)
  const progress = (await (await page.request.get(`/v1/progress?song_id=${song?.id}`)).json()) as {
    clips: { attempts: { tempo_pct: number; outcome: string }[] }[]
  }
  expect(progress.clips[0]?.attempts).toEqual([
    expect.objectContaining({ tempo_pct: 70, outcome: 'clean' }),
  ])
  const me = (await (await page.request.get('/v1/me')).json()) as {
    primary_instrument: string
    level: string
  }
  expect(me).toMatchObject({ primary_instrument: 'guitar', level: 'just_started' })

  // The next step: a song of their own.
  await expect(page.getByRole('link', { name: 'Import a song' })).toBeVisible()
  await page.getByRole('link', { name: 'Keep practising' }).click()
  await expect(page).toHaveURL(new RegExp(`/songs/${song?.id}/practice`))
  await expect(loopBadge()).toHaveText(`Loop · bars ${looped.bars}`, { timeout: 30_000 })
  expect(errors).toEqual([])
})
