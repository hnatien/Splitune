import { expect, type Page, test } from '@playwright/test'
import { collectErrors, expectAccessible, signIn, wav } from './helpers'

// Step 12 acceptance (prompt 12): the practice screen with the mock-mode artefacts (the contracts'
// 8-bar Am–F–C–G fixture at 100 BPM) and the real audio engine. Desktop and tablet projects run
// the practice journey; phones check the glance view. Timings are attached to the test results.

test.describe.configure({ mode: 'serial' })

let page: Page
let errors: string[]
let songUrl = ''
let mobile = false // a phone: the glance view instead of the tab (practice/layout.ts)
let desktop = true // a fine pointer: the five regions (27 §3.7.1); touch keeps today's layout

const transport = () => page.getByRole('toolbar', { name: 'Playback' })
const loopBadge = () => page.getByRole('button', { name: /^(Loop ·|No loop)/ })
const speedReadout = () => page.getByRole('button', { name: /^Speed: / })
// Desktop: the dock's mix pill names the preset (or "Mix") and opens the Mix tab; touch: the
// transport's Mix button opens the mixer drawer.
const mixControl = () =>
  transport().getByRole('button', { name: /^(Mix|Your part loud|Minus-one|Original)\b/ })
// Desktop edits in the inspector's Fix tab; touch in the editor sheet.
const editorScope = () =>
  desktop ? page.getByRole('tabpanel') : page.getByRole('dialog', { name: 'Edit this bar' })
// Desktop opens the loop's first bar from the keyboard (restart, then E edits the playing bar,
// 12 §8): its chord list is only the next few chords. Touch taps the chord in the strip.
async function editChord(chord: RegExp) {
  if (desktop) {
    await page.locator('#main').focus()
    await page.keyboard.press('PageUp')
    await page.keyboard.press('e')
    return
  }
  await page
    .getByRole('list', { name: 'Chords' })
    .getByRole('button', { name: chord })
    .first()
    .click()
}
// Editor note buttons: "A2 · string 5, fret 0" (a low-confidence one adds a hidden "?").
const NOTE = /· string \d, fret \d+$/
const noteName = async (locator: import('@playwright/test').Locator) =>
  (await locator.innerText()).replace(/\s*\?$/, '').trim()

test.beforeAll(async ({ browser }, info) => {
  const { viewport, userAgent, deviceScaleFactor, isMobile, hasTouch, baseURL } = info.project.use
  mobile = Boolean(isMobile) && Math.min(viewport?.width ?? 0, viewport?.height ?? 0) <= 640
  desktop = !hasTouch
  const context = await browser.newContext({
    reducedMotion: 'reduce',
    // These journeys hold and rewrite requests with page.route, which never sees what a service
    // worker fetches; the PWA has its own test (pwa.spec.ts).
    serviceWorkers: 'block',
    ...(viewport ? { viewport } : {}),
    ...(userAgent ? { userAgent } : {}),
    ...(deviceScaleFactor ? { deviceScaleFactor } : {}),
    ...(isMobile !== undefined ? { isMobile } : {}),
    ...(hasTouch !== undefined ? { hasTouch } : {}),
    ...(baseURL ? { baseURL } : {}),
  })
  page = await context.newPage()
  await signIn(page, 'practice')
  // From here on: the sign-in helper waits out the shared per-IP limit (429s it handles).
  errors = collectErrors(page)
})

test.afterAll(async () => {
  await page.context().close()
})

/** Every artefact is in, the stems are decoded and the engine can start. */
async function ready() {
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 90_000,
  })
  if (!mobile) {
    await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
      timeout: 60_000,
    })
    await expect(mixControl()).toBeEnabled()
  }
}

test('a song opens in practice and fills in as its analysis lands', async () => {
  await page.goto('/import')
  await page.getByRole('tab', { name: 'File' }).click()
  await page
    .locator('input[type=file]')
    .setInputFiles({ name: 'Practice riff.wav', mimeType: 'audio/wav', buffer: wav(20) })
  await page.getByRole('button', { name: 'Start practising' }).click()
  await expect(page).toHaveURL(/\/songs\/[0-9a-f-]+\/practice/)
  songUrl = new URL(page.url()).pathname
  // Getting ready holds the notation first (27 §3.7.3), then the layers replace it. A phone's
  // glance view takes over as soon as the beats land, which the mock worker reaches within a
  // second, sometimes before the lazy Getting ready card has loaded.
  await expect(
    mobile
      ? page.getByRole('progressbar').or(page.getByRole('region', { name: 'Current chord' }))
      : page.getByRole('progressbar'),
  ).toBeVisible()
  await ready()
  expect(errors).toEqual([])
})

test('play, loop bars 3–4 with a count-in, 70 %, felt clean by keyboard, mix and edits persist', async ({
  browserName,
}, info) => {
  test.skip(mobile, 'the phone layouts are checked below')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Pause', exact: true })).toBeVisible()

  // Tap bar A, then bar B (single pointer, WCAG 2.5.7).
  await page.locator('[data-slot=bar-target][data-bar="2"]').first().click()
  await expect(loopBadge()).toHaveAccessibleName(/tap the last bar/)
  await page.locator('[data-slot=bar-target][data-bar="3"]').first().click()
  await expect(loopBadge()).toHaveAccessibleName('Loop · bars 3–4')

  // Keyboard only from here: pause, slow to 70 %, play again from the loop with the count-in.
  await page.locator('#main').focus()
  await page.keyboard.press('Space')
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeVisible()
  // ↓ never changes speed (12 §8): before a pedal is set up it asks for one.
  await page.keyboard.press('ArrowDown')
  await expect(page.locator('[data-slot=pedal-hud]')).toContainText('Pedal detected? Set it up')
  await expect(speedReadout()).toHaveAccessibleName(/^Speed: 100\s%/)
  // Speed is , and . (5 %; Shift 1 %).
  for (let i = 0; i < 6; i++) await page.keyboard.press(',')
  await expect(speedReadout()).toHaveAccessibleName(/70\s%/)
  await page.keyboard.press('Space')
  await expect(page.locator('[data-slot=count-in]')).toBeVisible()
  await expect(page.locator('[data-slot=count-in]')).toBeHidden({ timeout: 10_000 })
  // Bars 3–4 last 4.8 s at 100 %, 6.9 s at 70 %.
  await expect(loopBadge()).toHaveAccessibleName('Loop · bars 3–4, pass 1', { timeout: 20_000 })

  const synced = page.waitForResponse(
    (r) => r.url().includes('/v1/practice/sync') && r.request().method() === 'POST' && r.ok(),
  )
  await page.keyboard.press('c')
  await expect(page.getByText(/Best clean pass: 70\s%/)).toBeVisible()
  await synced
  await page.keyboard.press('Space')

  // Mix: the Minus-one preset (a radio card, 27 §3.7.4).
  await mixControl().click()
  await page.getByRole('radio', { name: /^Minus-one/ }).click()
  await expect(page.getByRole('radio', { name: /^Minus-one/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('Escape')

  // Edit a chord (typed) and a note (fret +1) from the Fix tab (desktop) or the editor sheet
  // (touch), and report one as wrong.
  const corrections = page.waitForResponse(
    (r) => /\/v1\/artefacts\/.+\/corrections/.test(r.url()) && r.request().method() === 'POST',
  )
  await editChord(/^F/)
  const editor = editorScope()
  await expect(editor.getByLabel('Type a chord')).toBeVisible()
  await editor.getByLabel('Type a chord').fill('Dm')
  await editor.getByRole('button', { name: 'Use this chord' }).click()
  await expect(page.getByText('Edit saved').first()).toBeVisible()
  expect((await corrections).ok()).toBe(true)
  await editor.getByRole('button', { name: NOTE }).first().click()
  const selected = editor.getByRole('button', { name: NOTE, pressed: true })
  const before = await noteName(selected)
  await editor.getByRole('button', { name: 'Fret up' }).click()
  await expect(selected).not.toHaveText(before)
  await editor.getByRole('button', { name: 'Report wrong' }).first().click()
  await expect(page.getByText('Thanks — this helps').first()).toBeVisible()
  const edited = await noteName(selected)
  await page.keyboard.press('Escape')
  await expect(
    desktop
      ? page.locator('[data-slot=now-chord]')
      : page.getByRole('list', { name: 'Chords' }).getByRole('button', { name: /^Dm/ }).first(),
  ).toHaveText(/^Dm/)

  // Resume state is a debounced PATCH of the whole player_state.
  const songId = songUrl.split('/')[2] ?? ''
  await expect
    .poll(
      async () => {
        const song = (await (await page.request.get(`/v1/songs/${songId}`)).json()) as {
          player_state: { speed_pct?: number; selected_loop_id?: string | null; mix?: object }
        }
        return [
          song.player_state.speed_pct,
          Boolean(song.player_state.selected_loop_id),
          JSON.stringify(song.player_state.mix ?? {}).includes('"muted":true'),
        ]
      },
      { timeout: 10_000 },
    )
    .toEqual([70, true, true])
  await page.reload()
  await ready()
  await expect(loopBadge()).toHaveAccessibleName(/^Loop · bars 3–4/)
  await expect(speedReadout()).toHaveAccessibleName(/70\s%/)
  await mixControl().click()
  await expect(page.getByRole('radio', { name: /^Minus-one/ })).toHaveAttribute(
    'aria-checked',
    'true',
  )
  await page.keyboard.press('Escape')
  await editChord(/^Dm/)
  await expect(editorScope().getByRole('button', { name: edited })).toBeVisible()
  await page.keyboard.press('Escape')

  // report_wrong is stored with the chord artefact's overlay.
  const detail = (await (await page.request.get(`/v1/songs/${songId}`)).json()) as {
    artefacts: { id: string; kind: string }[]
  }
  const ops = await Promise.all(
    detail.artefacts
      .filter((a) => a.kind === 'chords' || a.kind.startsWith('notes.'))
      .map(async (a) => {
        const body = (await (
          await page.request.get(`/v1/artefacts/${a.id}/corrections`)
        ).json()) as {
          ops: { op: { op: string } }[]
        }
        return body.ops.map((o) => o.op.op)
      }),
  )
  expect(ops.flat()).toEqual(expect.arrayContaining(['set_chord', 'set_note', 'report_wrong']))
  info.annotations.push({ type: `stored ops (${browserName})`, description: ops.flat().join(', ') })
})

test('the cursor follows the audio clock', async ({ browserName }, info) => {
  test.skip(mobile, 'desktop measurement')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(page.locator('[data-slot=count-in]')).toBeVisible()
  await expect(page.locator('[data-slot=count-in]')).toBeHidden({ timeout: 10_000 })
  // Per animation frame: the time the cursor was drawn for, against the clock's advance.
  const samples = await page.evaluate(
    () =>
      new Promise<{ ts: number; time: number }[]>((resolve) => {
        const out: { ts: number; time: number }[] = []
        const cursor = document.querySelector('[data-slot=notation-cursor]')
        const tick = (ts: number) => {
          out.push({ ts, time: Number(cursor?.getAttribute('data-time')) })
          if (out.length < 240) requestAnimationFrame(tick)
          else resolve(out)
        }
        requestAnimationFrame(tick)
      }),
  )
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  const rate = 0.7
  const frameMs = 1000 / 60
  // Within a loop pass (no wrap), the drawn time advances by rate × elapsed real time.
  const errorsMs: number[] = []
  for (let i = 1; i < samples.length; i++) {
    const a = samples[i - 1] as { ts: number; time: number }
    const b = samples[i] as { ts: number; time: number }
    const advanced = (b.time - a.time) * 1000
    if (advanced < -100) continue
    errorsMs.push(Math.abs(advanced - rate * (b.ts - a.ts)))
  }
  errorsMs.sort((x, y) => x - y)
  const worst = errorsMs.at(-1) ?? 0
  const p95 = errorsMs[Math.floor(errorsMs.length * 0.95)] ?? 0
  info.annotations.push({
    type: `cursor vs clock (${browserName})`,
    description: `frames ${errorsMs.length}, p95 ${p95.toFixed(2)} ms, worst ${worst.toFixed(2)} ms of audio (one frame at ${rate}× = ${(rate * frameMs).toFixed(2)} ms)`,
  })
  // The criterion is desktop Chrome (prompt 12); the other engines report their numbers.
  if (browserName === 'chromium') expect(p95).toBeLessThanOrEqual(rate * frameMs)
})

test('a capo change recomputes and redraws the tab', async ({ browserName }, info) => {
  test.skip(mobile, 'desktop control')
  const notation = page.locator('[data-slot=notation]')
  const previous = await notation.getAttribute('data-update-ms')
  // The capo is in the level and capo popover (the Now column's card on desktop, the chord strip's
  // end on touch).
  await page
    .getByRole('button', { name: /^Level and capo/ })
    .last()
    .click()
  await page.getByRole('button', { name: 'Capo up' }).click()
  await expect(notation).not.toHaveAttribute('data-update-ms', previous ?? '')
  const ms = Number(await notation.getAttribute('data-update-ms'))
  info.annotations.push({ type: `capo → tab redrawn (${browserName})`, description: `${ms} ms` })
  expect(ms).toBeLessThanOrEqual(300)
  await page.getByRole('button', { name: 'Capo down' }).click()
  await page.keyboard.press('Escape')
})

test("guitar's Notes follow the clock and go back to the tab", async () => {
  test.skip(mobile, 'phones keep the glance view')
  const view = page.getByRole('group', { name: 'View' })
  await view.getByRole('button', { name: 'Notes' }).click()
  const notes = page.getByRole('region', { name: 'Notes', exact: true })
  await expect(notes).toBeVisible({ timeout: 30_000 })
  // The lanes are a canvas hidden from screen readers; the neck says what sounds.
  await expect(notes.locator('[data-slot=guitar-roll]')).toHaveAttribute('aria-hidden', 'true')
  const neck = notes.locator('[data-slot=fretboard-diagram]')
  await expect(neck).toHaveAttribute('aria-label', /^(Bar \d+|Pickup): /)
  const before = await neck.getAttribute('aria-label')
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(neck).not.toHaveAttribute('aria-label', before ?? '', { timeout: 15_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await view.getByRole('button', { name: 'Tab' }).click()
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 30_000,
  })
})

test('the practice screen is accessible', async () => {
  test.skip(mobile, 'phones below')
  await expectAccessible(page)
})

test('on the desktop editor, a chord and a note edit persist', async () => {
  test.skip(mobile, 'the editor is desktop-first')
  await page.goto(`${songUrl.replace(/\/practice$/, '/edit')}`)
  if (test.info().project.use.hasTouch) {
    // Touch devices edit in practice's editor sheet (27 §3.8), covered above. The tab loads before
    // the next test navigates (WebKit reports cancelled worker and font loads as errors).
    await expect(page).toHaveURL(new RegExp(`${songUrl}$`))
    await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
      timeout: 60_000,
    })
    return
  }
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 60_000,
  })
  const firstNote = page.locator('[data-slot=note-target]').first()
  await firstNote.click()
  const inspector = page.getByRole('complementary', { name: 'Bar and note details' })
  const note = inspector.getByRole('button', { name: NOTE, pressed: true })
  const before = await noteName(note)
  await inspector.getByRole('button', { name: 'Fret up' }).click()
  await expect(note).not.toHaveText(before)
  const after = await noteName(note)
  await inspector.getByLabel('Type a chord').fill('Am7')
  const saved = page.waitForResponse(
    (r) => /\/corrections$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST',
  )
  await inspector.getByRole('button', { name: 'Use this chord' }).click()
  await saved
  await expect(inspector.getByRole('heading', { name: 'Your edits' })).toBeVisible()
  await expectAccessible(page)
  await page.reload()
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 60_000,
  })
  await page.locator('[data-slot=note-target]').first().click()
  await expect(
    page
      .getByRole('complementary', { name: 'Bar and note details' })
      .getByRole('button', { name: after }),
  ).toBeVisible()
  await expect(page.getByText('Am7').first()).toBeVisible()
})

test('layers appear one by one without moving the transport', async () => {
  test.skip(mobile, 'desktop layout')
  const songId = songUrl.split('/')[2] ?? ''
  // The analysis, as if its stages were still landing: only released artefact kinds are listed,
  // and the SSE stream nudges the page to refetch every 300 ms.
  let released: string[] = []
  const keep = (kind: string) =>
    released.some((r) => kind === r || kind.startsWith(`${r}.`)) ||
    ['probe', 'manifest'].includes(kind)
  const filter = async (route: import('@playwright/test').Route) => {
    // Resume-state PATCHes and other writes pass through untouched.
    if (route.request().method() !== 'GET') return route.continue()
    const response = await route.fetch()
    const body = (await response.json()) as {
      artefacts: { kind: string }[]
      latest_analysis?: { artefacts: { kind: string }[]; status: string } | null
      status?: string
    }
    body.artefacts = body.artefacts.filter((a) => keep(a.kind))
    if (body.latest_analysis) {
      body.latest_analysis.artefacts = body.latest_analysis.artefacts.filter((a) => keep(a.kind))
    }
    await route.fulfill({ response, json: body })
  }
  let eventId = 1_000_000
  await page.route(new RegExp(`/v1/songs/${songId}$`), filter)
  await page.route(/\/v1\/analyses\/[0-9a-f-]+$/, filter)
  await page.route(/\/v1\/analyses\/[0-9a-f-]+\/events$/, (route) =>
    route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/event-stream' },
      body: `retry: 300\nid: ${eventId++}\ndata: ${JSON.stringify({ type: 'progress', value: 0.5 })}\n\nid: ${eventId++}\ndata: ${JSON.stringify({ type: 'stage.started', stage: 'notes.guitar', at: new Date().toISOString() })}\n\n`,
    }),
  )
  await page.goto(songUrl)
  const boxes: string[] = []
  const box = async () => JSON.stringify(await transport().boundingBox())

  await expect(page.getByRole('heading', { name: 'Getting your part ready' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Play', exact: true })).toBeEnabled({
    timeout: 60_000,
  })
  boxes.push(await box())

  released = ['beats']
  await expect(
    page.getByText(
      'You can practise already: the beat is found, so loops, slow-down and count-in work on the original song.',
    ),
  ).toBeVisible({ timeout: 15_000 })
  boxes.push(await box())

  released = ['beats', 'stems']
  await expect(mixControl()).toBeEnabled({ timeout: 30_000 })
  boxes.push(await box())

  released = ['beats', 'stems', 'chords']
  await expect(page.locator('[data-slot=chord-sheet]')).toBeVisible({ timeout: 15_000 })
  boxes.push(await box())

  released = ['beats', 'stems', 'chords', 'notes', 'tab', 'render', 'summary']
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 30_000,
  })
  boxes.push(await box())

  expect(new Set(boxes).size).toBe(1)
  await page.unrouteAll({ behavior: 'wait' })
})

test('on a phone the glance view shows the chord, bar and speed', async () => {
  test.skip(!mobile, 'phones only')
  const glance = page.getByRole('region', { name: 'Current chord', exact: true })
  await expect(glance).toBeVisible()
  await page.getByRole('button', { name: 'Play', exact: true }).click()
  await expect(glance.getByText(/^Bar \d+\.\d$/)).toBeVisible({ timeout: 15_000 })
  await page.getByRole('button', { name: 'Pause', exact: true }).click()
  await page.getByRole('group', { name: 'View' }).getByRole('button', { name: 'Tab' }).click()
  await expect(page.getByRole('region', { name: 'Tab', exact: true })).toBeVisible({
    timeout: 30_000,
  })
  await expectAccessible(page)
})

test('no console errors', async () => {
  expect(errors).toEqual([])
})
