import { type BrowserContext, expect, type Page, test } from '@playwright/test'
import {
  collectErrors,
  expectAccessible,
  expectNoHorizontalScroll,
  openExample,
  projectContext,
  signIn,
  wav,
} from './helpers'

// Step 16's accessibility pass (18 §5, 28 §5): axe (WCAG 2.2 AA, no serious or critical) on the
// core pages in every appearance, with the OS asking for more contrast and (Chromium) Windows
// forced colours; the practice loop by keyboard and pedal keys alone; reduced motion; and 200 %
// text on the library and practice screens. Violation counts are attached to the results.

type Mode = {
  name: string
  appearance: 'light' | 'dark' | 'stage'
  /** The OS setting (prefers-contrast: more); the app follows it by default. */
  moreContrast?: boolean
  forcedColors?: boolean
}

const MODES: Mode[] = [
  { name: 'Light', appearance: 'light' },
  { name: 'Dark', appearance: 'dark' },
  { name: 'Stage', appearance: 'stage' },
  { name: 'Light, more contrast', appearance: 'light', moreContrast: true },
  { name: 'Dark, more contrast', appearance: 'dark', moreContrast: true },
  { name: 'Stage, more contrast', appearance: 'stage', moreContrast: true },
  { name: 'forced colours', appearance: 'light', forcedColors: true },
]

const PAGES = [
  { path: '/', heading: /./ },
  { path: '/pricing', heading: /./ },
  { path: '/library', heading: 'Library' },
  { path: '/import', heading: /./ },
  { path: '/settings/display', heading: /./ },
  { path: '/settings/privacy', heading: /./ },
  { path: '/settings/billing', heading: /./ },
]

const PHONE_WIDTH = 640

/** The stored display choice, read by the head script before first paint (26 §2). */
async function preparePage(page: Page, mode: Mode) {
  await page.addInitScript((appearance) => {
    localStorage.setItem('splitune.display', JSON.stringify({ appearance }))
  }, mode.appearance)
  await page.emulateMedia({
    contrast: mode.moreContrast ? 'more' : 'no-preference',
    forcedColors: mode.forcedColors ? 'active' : 'none',
  })
}

async function expectMode(page: Page, mode: Mode) {
  const root = page.locator('html')
  await expect(root).toHaveAttribute('data-appearance', mode.appearance)
  await expect(root).toHaveAttribute('data-contrast', mode.moreContrast ? 'more' : 'normal')
}

/** The accessible name (or text) of the focused element; empty when nothing is focused. */
const focusedName = (page: Page) =>
  page.evaluate(() => {
    const el = document.activeElement
    if (!(el instanceof HTMLElement) || el === document.body) return ''
    return (el.getAttribute('aria-label') ?? el.innerText ?? '').trim()
  })

/**
 * Moves focus with Tab alone until the focused element's accessible name matches. Safari on macOS
 * tabs between fields only; Option-Tab reaches every control (as Tab does with "Press Tab to
 * highlight each item"), and Playwright's WebKit on macOS behaves the same.
 */
async function tabTo(page: Page, name: RegExp, limit = 60) {
  const key =
    page.context().browser()?.browserType().name() === 'webkit' && process.platform === 'darwin'
      ? 'Alt+Tab'
      : 'Tab'
  for (let i = 0; i < limit; i++) {
    await page.keyboard.press(key)
    if (name.test(await focusedName(page))) return page.locator(':focus')
  }
  throw new Error(`Tab never reached ${name}`)
}

test.describe('axe in every appearance', () => {
  test.describe.configure({ mode: 'serial' })

  let context: BrowserContext

  test.beforeAll(async ({ browser }, info) => {
    context = await projectContext(browser, { serviceWorkers: 'block' })
    const page = await context.newPage()
    await signIn(page, `e2e-a11y-${info.project.name}-${Date.now()}@splitune.localhost`)
    // A populated library.
    await page.goto('/import')
    await page.getByRole('tab', { name: 'File' }).click()
    await page
      .locator('input[type=file]')
      .setInputFiles({ name: 'Axe check.wav', mimeType: 'audio/wav', buffer: wav(3) })
    await page.getByRole('button', { name: 'Start practising' }).click()
    await expect(page).toHaveURL(/\/practice/)
    await expect
      .poll(
        async () =>
          (
            (await (await page.request.get('/v1/songs')).json()) as {
              items: { latest_analysis: object | null }[]
            }
          ).items.filter((song) => song.latest_analysis !== null).length,
        { timeout: 30_000 },
      )
      .toBe(1)
    await page.close()
  })

  test.afterAll(async () => {
    await context?.close()
  })

  for (const mode of MODES) {
    test(`core pages: ${mode.name}`, async ({ browserName }) => {
      test.skip(
        Boolean(mode.forcedColors) && browserName !== 'chromium',
        'forced colours are emulated in Chromium only',
      )
      const page = await context.newPage()
      const errors = collectErrors(page)
      await preparePage(page, mode)
      const counts: string[] = []
      for (const { path, heading } of PAGES) {
        await page.goto(path)
        await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
        await expectMode(page, mode)
        counts.push(`${path} ${await expectAccessible(page)}`)
        await expectNoHorizontalScroll(page)
      }
      if (mode.forcedColors) {
        // The focus ring survives forced colours (system colours, 26 §7).
        await page.goto('/library')
        const control = await tabTo(page, /\S/)
        expect(
          await control.evaluate((el) => {
            const style = getComputedStyle(el)
            return style.outlineStyle !== 'none' && Number.parseFloat(style.outlineWidth) > 0
          }),
        ).toBe(true)
      }
      test.info().annotations.push({
        type: `axe minor/moderate (${mode.name})`,
        description: counts.join(', '),
      })
      expect(errors).toEqual([])
      await page.close()
    })
  }

  test('every core page reflows at 320 px (WCAG 1.4.10)', async () => {
    const page = await context.newPage()
    await page.setViewportSize({ width: 320, height: 640 })
    const overflow: Record<string, number> = {}
    for (const { path, heading } of PAGES) {
      await page.goto(path)
      await expect(page.getByRole('heading', { name: heading }).first()).toBeVisible()
      overflow[path] = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      )
    }
    expect(overflow).toEqual(Object.fromEntries(PAGES.map(({ path }) => [path, 0])))
    await page.close()
  })

  for (const mode of MODES) {
    test(`practice (example song, loop playing then paused): ${mode.name}`, async ({
      browser,
      browserName,
    }) => {
      test.skip(
        Boolean(mode.forcedColors) && browserName !== 'chromium',
        'forced colours are emulated in Chromium only',
      )
      const visitor = await projectContext(browser)
      const page = await visitor.newPage()
      const errors = collectErrors(page)
      await preparePage(page, mode)
      const play = await openExample(page)
      await expectMode(page, mode)
      await play.click()
      await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
      await page.getByRole('button', { name: 'Pause', exact: true }).click()
      const count = await expectAccessible(page)
      test.info().annotations.push({
        type: `axe minor/moderate (practice, ${mode.name})`,
        description: String(count),
      })
      expect(errors).toEqual([])
      await visitor.close()
    })
  }
})

test.describe('keyboard and pedal only', () => {
  test('onboarding to a loop, passes, speed, mute, a new loop and the mixer without a pointer', async ({
    browser,
  }) => {
    const width = test.info().project.use.viewport?.width ?? 0
    test.skip(
      Boolean(test.info().project.use.hasTouch),
      'touch layouts: their pedal keys are the same handler, run on desktop',
    )
    const context = await projectContext(browser)
    const page = await context.newPage()
    const errors = collectErrors(page)
    expect(width).toBeGreaterThan(PHONE_WIDTH)

    // Onboarding by Tab and Enter.
    await page.goto('/start')
    await expect(page.getByRole('heading', { name: 'What do you play?' })).toBeVisible()
    await (await tabTo(page, /^Guitar$/)).press('Enter')
    await expect(page.getByRole('heading', { name: /level|How long/i }).first()).toBeVisible()
    await (await tabTo(page, /^Just started/)).press('Enter')
    await expect(page.getByRole('heading', { name: "Where's your screen?" })).toBeVisible()
    await (await tabTo(page, /^Skip$/)).press('Enter')
    const card = page.getByRole('dialog', { name: 'Your first song' })
    await expect(card.getByRole('button', { name: 'Play your part' })).toBeEnabled({
      timeout: 90_000,
    })
    await (await tabTo(page, /^Play your part$/)).press('Enter')

    // The suggested loop at 70 %; from here the keys a page-turner pedal sends (12 §8).
    const badge = page.getByRole('button', { name: /^Loop · bars \d+–\d+/ })
    await expect(badge).toHaveText(/pass 1/, { timeout: 60_000 })
    await page.keyboard.press('c')
    await expect(page.getByText(/Best clean pass: 70\s%/).first()).toBeVisible()
    await page.keyboard.press('n')
    await page.keyboard.press('ArrowUp')
    await expect(page.getByRole('button', { name: /^Speed: / })).toHaveAccessibleName(/75\s%/)
    await page.keyboard.press('m')
    await expect(page.getByText('Your part muted').first()).toBeVisible()
    await page.keyboard.press('PageUp')
    await expect(page.getByText('From the top of the loop').first()).toBeVisible()
    // Stopping offers "Save your progress?" (a modal sheet, 13 §1): Escape closes it.
    await page.keyboard.press('Space')
    const save = page.getByRole('dialog', { name: 'Save your progress?' })
    const play = page.getByRole('button', { name: 'Play', exact: true })
    await expect(save.or(play)).toBeVisible()
    if (await save.isVisible()) await page.keyboard.press('Escape')
    await expect(play).toBeVisible()

    // A loop of their own: Tab into the tab's bars (one tab stop; arrows move between bars,
    // 12 §8), arrow to bar 2, Enter, arrow to bar 3, Enter.
    await tabTo(page, /^Bar \d+\b/, 120)
    for (let i = 0; i < 16 && !/^Bar 2\b/.test(await focusedName(page)); i++) {
      const bar = Number((await focusedName(page)).match(/^Bar (\d+)/)?.[1])
      await page.keyboard.press(bar > 2 ? 'ArrowLeft' : 'ArrowRight')
    }
    await page.keyboard.press('Enter')
    await page.keyboard.press('ArrowRight')
    await page.keyboard.press('Enter')
    await expect(badge).toHaveText(/^Loop · bars 2–3/)
    await page.keyboard.press('l')
    await expect(page.getByText('Loop off').first()).toBeVisible()
    await page.keyboard.press('l')
    await expect(page.getByText('Loop on').first()).toBeVisible()

    // The mixer opens and closes from the keyboard.
    await (await tabTo(page, /^Mix$/, 120)).press('Enter')
    const mixer = page.getByRole('dialog', { name: /Mix/ })
    await expect(mixer).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(mixer).toBeHidden()
    expect(errors).toEqual([])
    await context.close()
  })
})

test.describe('reduced motion', () => {
  test('nothing animates on the practice screen while playing and with the mixer open', async ({
    browser,
  }) => {
    test.skip(Boolean(test.info().project.use.hasTouch), 'one desktop check per engine')
    const context = await projectContext(browser, { reducedMotion: 'reduce' })
    const page = await context.newPage()
    const play = await openExample(page)
    await expect(page.locator('html')).toHaveAttribute('data-motion', 'reduce')
    expect(
      await page.evaluate(() =>
        ['--duration-fast', '--duration-base', '--duration-slow'].map((name) =>
          Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue(name)),
        ),
      ),
    ).toEqual([0, 0, 0])
    await play.click()
    await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Mix', exact: true }).click()
    await expect(page.getByRole('dialog', { name: /Mix/ })).toBeVisible()
    // CSS animations and transitions all end at once (26 §10); the score cursor moves by script.
    const running = await page.evaluate(() =>
      document
        .getAnimations()
        .filter((a) => a.playState === 'running')
        .map((a) => `${a.constructor.name} ${(a as CSSAnimation).animationName ?? ''}`),
    )
    expect(running).toEqual([])
    await context.close()
  })
})

test.describe('200 % text', () => {
  /** Text at twice the default size (a browser's text-only zoom): every rem doubles. */
  const doubleText = () => {
    const style = document.createElement('style')
    style.textContent = 'html { font-size: 200% !important }'
    document.documentElement.append(style)
  }

  test('the library and practice screens keep their content and controls', async ({
    browser,
  }, info) => {
    test.skip(
      Boolean(info.project.use.hasTouch),
      'browse at 200 % on desktop widths; phones reflow at 320 px',
    )
    const context = await projectContext(browser, { serviceWorkers: 'block' })
    const page = await context.newPage()
    await signIn(page, `e2e-zoom-${info.project.name}-${Date.now()}@splitune.localhost`)
    await page.addInitScript(doubleText)
    await page.goto('/library')
    await expect(page.getByRole('heading', { name: 'Library' })).toBeVisible()
    await expect(page.getByRole('link', { name: /Import/ }).first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    await info.attach('library at 200 % text', {
      body: await page.screenshot({ fullPage: true }),
      contentType: 'image/png',
    })

    const visitor = await projectContext(browser)
    const practice = await visitor.newPage()
    await practice.addInitScript(doubleText)
    const play = await openExample(practice)
    await play.click()
    const pause = practice.getByRole('button', { name: 'Pause', exact: true })
    await expect(pause).toBeVisible()
    await pause.click()
    for (const control of [
      practice.getByRole('button', { name: 'Play', exact: true }),
      practice.getByRole('button', { name: /^Speed: / }),
      practice.getByRole('button', { name: /^Loop · bars/ }),
    ]) {
      await control.scrollIntoViewIfNeeded()
      await expect(control).toBeInViewport()
    }
    await expectNoHorizontalScroll(practice)
    await info.attach('practice at 200 % text', {
      body: await practice.screenshot(),
      contentType: 'image/png',
    })
    await visitor.close()
    await context.close()
  })
})
