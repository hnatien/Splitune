import { expect, type Page, test } from '@playwright/test'
import { openExample, projectContext } from './helpers'

// Step 16's performance checks (28 §5, 12 §10): no long task over 50 ms while the practice screen
// plays (desktop Chrome, Long Animation Frame attribution attached), and music-core's
// recompute + redraw after a capo change on a tablet-sized Chromium with the CPU slowed 4× (a
// mid-range phone or tablet; real devices are on the owner's checklist).

declare global {
  interface Window {
    __longFrames: { start: number; duration: number; scripts: string[] }[]
  }
}

/** Records Long Animation Frames (≥50 ms) with the scripts that ran in them. */
function recordLongFrames() {
  window.__longFrames = []
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      scripts?: {
        sourceURL: string
        sourceFunctionName: string
        invoker: string
        duration: number
      }[]
    })[]) {
      window.__longFrames.push({
        start: entry.startTime,
        duration: entry.duration,
        scripts: (entry.scripts ?? []).map(
          (s) =>
            `${s.invoker} ${s.sourceFunctionName || '(anonymous)'} ${s.sourceURL.split('/').pop()} ${Math.round(s.duration)} ms`,
        ),
      })
    }
  }).observe({ type: 'long-animation-frame', buffered: false })
}

const longFrames = (page: Page) => page.evaluate(() => window.__longFrames)

test('no long tasks over 50 ms while a loop plays (desktop Chrome)', async ({ browser }, info) => {
  test.skip(info.project.name !== 'chromium', 'Long Animation Frames are Chromium-only')
  const context = await projectContext(browser)
  const page = await context.newPage()
  await page.addInitScript(recordLongFrames)
  const play = await openExample(page)
  const pressed = await page.evaluate(() => performance.now())
  await play.click()
  const pause = page.getByRole('button', { name: 'Pause', exact: true })
  await expect(pause).toBeVisible()
  const started = await page.evaluate(() => performance.now())
  // 12 s of playback: the count-in, the 70 % loop and its wraps, the cursor and the beat counter.
  await page.waitForTimeout(12_000)
  const frames = await longFrames(page)
  const relative = frames.map((f) => ({ ...f, at: Math.round(f.start - pressed) }))
  info.annotations.push({
    type: 'long animation frames (≥50 ms) from the Play press',
    description:
      relative.length === 0
        ? 'none'
        : relative
            .map((f) => `+${f.at} ms: ${Math.round(f.duration)} ms [${f.scripts.join('; ')}]`)
            .join(' | '),
  })
  // Steady playback: nothing after the engine reported it had started.
  expect(frames.filter((f) => f.start > started && f.duration > 50)).toEqual([])
  await pause.click()
  await context.close()
})

test('music-core recomputes and redraws a capo change on a slowed tablet CPU', async ({
  browser,
}, info) => {
  test.skip(info.project.name !== 'tablet-chrome', 'CPU throttling is a Chromium (CDP) feature')
  const context = await projectContext(browser)
  const page = await context.newPage()
  const cdp = await context.newCDPSession(page)
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 })
  // The example's card closes once its audio starts; then stop to work on the score.
  await (await openExample(page)).click()
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const notation = page.locator('[data-slot=notation]')
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 60_000,
  })
  const samples: number[] = []
  for (const control of ['Capo up', 'Capo down', 'Capo up', 'Capo down', 'Capo up']) {
    // Cleared first: the next redraw sets it again (two redraws can take the same time).
    await notation.evaluate((el) => el.removeAttribute('data-update-ms'))
    await page.getByRole('button', { name: control }).click()
    await expect(notation).toHaveAttribute('data-update-ms', /^\d+$/)
    samples.push(Number(await notation.getAttribute('data-update-ms')))
  }
  const sorted = [...samples].sort((a, b) => a - b)
  const median = sorted[Math.floor(sorted.length / 2)] ?? 0
  info.annotations.push({
    type: 'capo → tab redrawn, CPU 4× slower',
    description: `${samples.join(', ')} ms (median ${median} ms)`,
  })
  // 12 §10: a capo or level change redraws within 300 ms.
  expect(median).toBeLessThanOrEqual(300)
  await context.close()
})
