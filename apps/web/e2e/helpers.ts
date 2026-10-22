import AxeBuilder from '@axe-core/playwright'
import {
  type Browser,
  type BrowserContext,
  type BrowserContextOptions,
  expect,
  type Page,
  test,
} from '@playwright/test'
import { APP_URL } from '../playwright.config.ts'

const MAILPIT = 'http://localhost:8025'

/** A WAV file of a plucked 220 Hz tone (16-bit mono, 44.1 kHz): real audio every browser decodes. */
export function wav(seconds: number): Buffer {
  const rate = 44_100
  const frames = Math.round(seconds * rate)
  const data = Buffer.alloc(frames * 2)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    const envelope = Math.exp(-3 * (t % 0.5))
    data.writeInt16LE(Math.round(0.6 * envelope * Math.sin(2 * Math.PI * 220 * t) * 32767), i * 2)
  }
  const header = Buffer.alloc(44)
  header.write('RIFF', 0)
  header.writeUInt32LE(36 + data.length, 4)
  header.write('WAVEfmt ', 8)
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36)
  header.writeUInt32LE(data.length, 40)
  return Buffer.concat([header, data])
}

export async function magicLink(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const search = await fetch(
      `${MAILPIT}/api/v1/search?query=${encodeURIComponent(`to:"${email}"`)}&limit=1`,
    )
    const { messages } = (await search.json()) as { messages: { ID: string }[] }
    const [message] = messages
    if (message) {
      const body = (await (await fetch(`${MAILPIT}/api/v1/message/${message.ID}`)).json()) as {
        Text: string
      }
      const link = body.Text.match(/https?:\/\/\S+/)?.[0]
      if (link) return link
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  throw new Error(`no magic link for ${email}`)
}

/** Signs in through the real form and the emailed link (Mailpit), ending in the library. */
export async function signIn(page: Page, email: string) {
  await page.goto('/library')
  await expect(page).toHaveURL(/\/auth\/sign-in/)
  await page.getByLabel('Email').fill(email)
  // Projects share one IP and its 10/min sign-in limit: wait out a "Too many tries" and retry.
  for (let attempt = 0; ; attempt++) {
    await page.getByRole('button', { name: 'Email me a link' }).click()
    const sent = page.getByRole('heading', { name: 'Check your email' })
    const limited = page.getByText(/Too many tries in a short time\. Try again in (\d+)/)
    await expect(sent.or(limited)).toBeVisible()
    if (await sent.isVisible()) break
    if (attempt >= 3) throw new Error('sign-in stayed rate limited')
    const seconds = Number((await limited.textContent())?.match(/in (\d+)/)?.[1] ?? 60)
    await page.waitForTimeout((seconds + 1) * 1000)
  }
  // Opening the link counts against the same limit: wait out a 429 there too.
  const link = await magicLink(email)
  for (let attempt = 0; ; attempt++) {
    const response = await page.goto(link)
    if (response?.status() !== 429) break
    if (attempt >= 3) throw new Error('magic link stayed rate limited')
    const seconds = Number(response.headers()['retry-after'] ?? 60)
    await page.waitForTimeout((seconds + 1) * 1000)
  }
  await expect(page).toHaveURL(/\/library/)
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
}

// WebKit logs a fetch to the app's own API that a navigation cancels as "/localhost:3000/v1/…
// due to access control checks." Same-origin requests can't fail CORS, so only those are dropped;
// cross-origin ones (the bucket's presigned uploads) still count.
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const CANCELLED_SAME_ORIGIN = new RegExp(
  `/${escapeRegExp(new URL(APP_URL).host)}/v1/\\S* due to access control checks`,
)

/** Console errors and uncaught exceptions on the page (CORS failures show up here). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error' && !CANCELLED_SAME_ORIGIN.test(message.text())) {
      errors.push(message.text())
    }
  })
  // An unhandled rejection of such a fetch arrives as a page error with the same text.
  page.on('pageerror', (error) => {
    if (!CANCELLED_SAME_ORIGIN.test(error.message)) errors.push(error.message)
  })
  return errors
}

/** No serious or critical axe violations (WCAG 2.2 AA rules) on the current page. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    // Base UI's visually hidden focus guards around an open dialog or sheet: in WebKit they get
    // role="button" (no name) on purpose, so VoiceOver's cursor stays trapped inside.
    .exclude('[data-base-ui-focus-guard]')
    .analyze()
  const serious = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  )
  expect(
    serious.map(
      (v) =>
        `${v.id}: ${v.nodes.map((n) => `${n.target.join(' ')} (${n.failureSummary ?? ''})`).join(', ')}`,
    ),
  ).toEqual([])
  return results.violations.length
}

/** Content reflows to the viewport: no horizontal scrolling (WCAG 1.4.10). */
export async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)
}

/**
 * Billing pages never render card fields, even fake ones (25 §2): no text-like input, select or
 * textarea at all, and nothing that names or autocompletes card data. `scope` limits the scan to
 * part of the page (the upgrade sheet over the import screen). Returns how many form controls it
 * found (radios only).
 */
export async function expectNoCardInputs(page: Page, scope = 'body') {
  const scan = await page.evaluate((selector) => {
    const root = document.querySelector(selector) ?? document.body
    const controls = [...root.querySelectorAll('input, select, textarea')]
    const textLike = controls.filter(
      (el) =>
        !(el instanceof HTMLInputElement && ['radio', 'checkbox', 'hidden'].includes(el.type)),
    )
    const cardish = controls.filter((el) => {
      const attrs = ['name', 'id', 'autocomplete', 'placeholder', 'aria-label']
        .map((name) => el.getAttribute(name) ?? '')
        .join(' ')
      return /\bcc-|card|cvc|cvv|expir|iban|account.?number/i.test(attrs)
    })
    return {
      controls: controls.length,
      textLike: textLike.map((el) => el.outerHTML.slice(0, 120)),
      cardish: cardish.map((el) => el.outerHTML.slice(0, 120)),
    }
  }, scope)
  expect(scan.textLike).toEqual([])
  expect(scan.cardish).toEqual([])
  test.info().annotations.push({
    type: 'card-input scan',
    description: `${new URL(page.url()).pathname} ${scope}: ${scan.controls} form controls, 0 card or text inputs`,
  })
  return scan.controls
}

/**
 * A context with the project's device settings (viewport, user agent, touch), reduced motion and
 * `options` on top. Firefox has no device emulation: its "phone" is the viewport alone.
 */
export async function projectContext(
  browser: Browser,
  options: BrowserContextOptions = {},
): Promise<BrowserContext> {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } =
    test.info().project.use
  return browser.newContext({
    reducedMotion: 'reduce',
    ...(viewport ? { viewport } : {}),
    ...(userAgent && browser.browserType().name() !== 'firefox' ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
    ...options,
  })
}

/**
 * Onboarding's way into the example song without signing in (13 §1): instrument, level, skip the
 * screen step. Returns the card's "Play your part" once the audio is decoded.
 */
export async function openExample(page: Page) {
  await page.goto('/start')
  await page.getByRole('button', { name: 'Guitar', exact: true }).click()
  await page.getByRole('button', { name: 'Just started' }).click()
  await page.getByRole('button', { name: 'Skip' }).click()
  const play = page
    .getByRole('dialog', { name: 'Your first song' })
    .getByRole('button', { name: 'Play your part' })
  await expect(play).toBeEnabled({ timeout: 90_000 })
  return play
}
