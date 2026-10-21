import AxeBuilder from '@axe-core/playwright'
import { expect, type Page } from '@playwright/test'

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

async function magicLink(email: string): Promise<string> {
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
  await page.getByRole('button', { name: 'Email me a link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()
  await page.goto(await magicLink(email))
  await expect(page).toHaveURL(/\/library/)
  await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
}

/** Console errors and uncaught exceptions on the page (CORS failures show up here). */
export function collectErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  page.on('pageerror', (error) => errors.push(error.message))
  return errors
}

/** No serious or critical axe violations (WCAG 2.2 AA rules) on the current page. */
export async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
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
