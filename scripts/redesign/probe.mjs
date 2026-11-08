// Measures a page for fidelity checks: the aria snapshot and, per selector, bounding boxes and
// computed styles. The target is a mockup board (rendered through the shim) or any URL (the app,
// a Storybook iframe), themed for the requested look. The JSON shape (schema 2) is documented in
// README.md; keys and ordering are stable so two probes can be diffed. A probe with load or theme
// errors still prints its JSON (with `errors`) but exits 1; from Node, probe() throws ProbeError.
//
//   node scripts/redesign/probe.mjs Main --look daylight --width 1440 --select .play --select header
//   node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=base-button--primary' \
//     --look night --width 1180 --select button
//
// From Node: import { probe, probePage, ProbeError } from './scripts/redesign/probe.mjs'
import { realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  collectFonts,
  emulation,
  FIXED_LOOK,
  LOOKS,
  launchBrowser,
  mockupPath,
  openMockup,
  preparePage,
  readBoards,
  settle,
  startServer,
  THEME,
} from './harness.mjs'

export { THEME }

export const SCHEMA = 2
const DEFAULT_LIMIT = 20
const DEFAULT_TIMEOUT = 30_000

// apps/web/app/ui/display.ts DISPLAY_STORAGE_KEY: the app's head script reads the stored choice.
const DISPLAY_STORAGE_KEY = 'splitune.display'
// Storybook marks <body> once the story has rendered (sb-show-main) or failed.
const STORYBOOK_SETTLED = 'body.sb-show-main, body.sb-show-errordisplay, body.sb-show-nopreview'

export class ProbeError extends Error {
  constructor(result) {
    super(result.errors.join('; '))
    this.name = 'ProbeError'
    this.result = result
  }
}

// Runs in the page: one record per matched element. Colours are the computed strings plus an
// sRGB #rrggbbaa read back through a canvas, so oklch() and hex sources compare equal.
function measureElements(elements, limit) {
  const canvas = document.createElement('canvas')
  canvas.width = 1
  canvas.height = 1
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  const srgb = (value) => {
    ctx.clearRect(0, 0, 1, 1)
    ctx.fillStyle = '#000000'
    ctx.fillStyle = value
    ctx.fillRect(0, 0, 1, 1)
    const data = ctx.getImageData(0, 0, 1, 1).data
    return `#${[...data].map((n) => n.toString(16).padStart(2, '0')).join('')}`
  }
  const round = (n) => Math.round(n * 100) / 100
  const sides = (s, f) => ['Top', 'Right', 'Bottom', 'Left'].map((side) => s[f(side)])
  return elements.slice(0, limit).map((el, index) => {
    const s = getComputedStyle(el)
    const r = el.getBoundingClientRect()
    const borderColor = sides(s, (side) => `border${side}Color`)
    const text = (el.innerText ?? el.textContent ?? '').replace(/\s+/g, ' ').trim()
    return {
      index,
      tag: el.localName,
      text: text.length > 80 ? `${text.slice(0, 79)}…` : text,
      attrs: {
        id: el.getAttribute('id'),
        class: el.getAttribute('class'),
        role: el.getAttribute('role'),
        ariaLabel: el.getAttribute('aria-label'),
      },
      box: {
        x: round(r.x + scrollX),
        y: round(r.y + scrollY),
        width: round(r.width),
        height: round(r.height),
      },
      styles: {
        display: s.display,
        color: s.color,
        backgroundColor: s.backgroundColor,
        fontFamily: s.fontFamily,
        fontSize: s.fontSize,
        fontWeight: s.fontWeight,
        fontStyle: s.fontStyle,
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        textTransform: s.textTransform,
        textAlign: s.textAlign,
        margin: sides(s, (side) => `margin${side}`),
        padding: sides(s, (side) => `padding${side}`),
        borderWidth: sides(s, (side) => `border${side}Width`),
        borderStyle: sides(s, (side) => `border${side}Style`),
        borderColor,
        borderRadius: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(
          (corner) => s[`border${corner}Radius`],
        ),
        gap: [s.rowGap, s.columnGap],
        boxShadow: s.boxShadow,
        opacity: s.opacity,
      },
      srgb: {
        color: srgb(s.color),
        backgroundColor: srgb(s.backgroundColor),
        borderColor: borderColor.map(srgb),
      },
    }
  })
}

// Measures an already-open Playwright page (use this inside a Playwright test). `selectors` are
// Playwright selectors (CSS by default; `role=button[name="Pause"]` and `text=` work too).
export async function probePage(page, { selectors = [], limit = DEFAULT_LIMIT, aria = true } = {}) {
  const elements = {}
  for (const selector of selectors) {
    const locator = page.locator(selector)
    const count = await locator.count()
    const items = await locator.evaluateAll(measureElements, limit)
    elements[selector] = { count, items }
  }
  const info = await page.evaluate(() => {
    const html = document.documentElement
    return {
      viewport: { width: innerWidth, height: innerHeight },
      page: { width: html.scrollWidth, height: html.scrollHeight },
      display: {
        dataTheme: document.querySelector('[data-theme]')?.getAttribute('data-theme') ?? null,
        appearance: html.getAttribute('data-appearance'),
        contrast: html.getAttribute('data-contrast'),
        distance: html.getAttribute('data-distance'),
        motion: html.getAttribute('data-motion'),
        readingFont: html.getAttribute('data-reading-font'),
        score: html.getAttribute('data-score'),
      },
    }
  })
  let ariaOut = null
  if (aria) {
    const snapshot = await page.locator('body').ariaSnapshot()
    const roles = {}
    for (const line of snapshot.split('\n')) {
      const role = /^\s*- ([a-z]+)/.exec(line)?.[1]
      if (role) roles[role] = (roles[role] ?? 0) + 1
    }
    ariaOut = { roles: Object.fromEntries(Object.entries(roles).sort()), snapshot }
  }
  return { ...info, fonts: await collectFonts(page), aria: ariaOut, elements }
}

// Adds the Storybook globals for the look and motion to an iframe.html URL (globals=k:v;k:v):
// `appearance` (THEME) and `motion` (Storybook pins both in initialGlobals, so emulating the media
// queries alone doesn't reach a story). A URL that already pins a different value is a
// contradiction, not something to override. Other URLs are returned unchanged.
export function themedUrl(target, look, motion = 'reduce') {
  const url = new URL(target)
  if (!url.pathname.endsWith('/iframe.html')) return url.href
  const globals = new Map(
    (url.searchParams.get('globals') ?? '')
      .split(';')
      .filter(Boolean)
      .map((pair) => pair.split(':')),
  )
  for (const [name, value, option] of [
    ['appearance', THEME[look], `--look ${look}`],
    ['motion', motion, `--motion ${motion}`],
  ]) {
    const pinned = globals.get(name)
    if (pinned && pinned !== value) {
      throw new Error(`URL sets globals ${name}:${pinned} but ${option} needs ${value}`)
    }
    globals.set(name, value)
  }
  url.searchParams.set('globals', [...globals].map(([k, v]) => `${k}:${v}`).join(';'))
  return url.href
}

// Opens an app or Storybook URL themed for `look`. Waits for `load`, then for `waitFor` (default
// on Storybook iframes: the story settled) and fonts, never for network idle (the app keeps an
// EventSource open). Load problems from any host, a non-2xx document and a Storybook error panel
// are returned as `problems`.
async function openUrl(browser, target, { look, width, height, touch, motion, waitFor, timeout }) {
  const url = themedUrl(target, look, motion)
  const opened = await preparePage(browser, {
    width,
    height,
    look,
    touch,
    motion,
    track: () => true,
  })
  const { context, page, problems } = opened
  await context.addInitScript(
    ({ key, appearance }) => {
      // Opaque frames (about:blank) have no storage and throw; only the app's origin matters.
      try {
        const stored = JSON.parse(localStorage.getItem(key) ?? '{}') ?? {}
        localStorage.setItem(key, JSON.stringify({ ...stored, appearance }))
      } catch {
        return
      }
    },
    { key: DISPLAY_STORAGE_KEY, appearance: THEME[look] },
  )
  let response
  try {
    response = await page.goto(url, { waitUntil: 'load', timeout })
  } catch (error) {
    problems.push(`navigation failed: ${error.message.split('\n')[0]}`)
    return { context, page, url, problems, loaded: false }
  }
  // The response listener reports >= 400 already; this also catches a non-2xx document below that.
  const status = response ? `HTTP ${response.status()}: ${response.url()}` : null
  if (response && !response.ok() && !problems.includes(status)) problems.push(status)
  const storybook = new URL(url).pathname.endsWith('/iframe.html')
  const ready = waitFor ?? (storybook ? STORYBOOK_SETTLED : null)
  if (ready) {
    try {
      await page.locator(ready).first().waitFor({ state: 'attached', timeout })
    } catch {
      problems.push(`timed out after ${timeout} ms waiting for ${ready}`)
    }
  }
  if (storybook) {
    const state = await page.evaluate(() => ({
      main: document.body.classList.contains('sb-show-main'),
      classes: document.body.className,
      error: document.querySelector('#error-message')?.textContent?.trim() ?? '',
    }))
    if (!state.main) {
      problems.push(`Storybook did not render the story (body: ${state.classes}) ${state.error}`)
    }
  }
  try {
    await settle(page, { networkIdle: false })
  } catch (error) {
    problems.push(`fonts did not settle: ${error.message.split('\n')[0]}`)
  }
  return { context, page, url, problems, loaded: true }
}

// Opens `target` (a board name such as Main / Main.dc.html, or an http(s) URL), probes it and
// closes it. For a board, width and height default to its canvas size and `look` picks the look
// prop; for a URL, `look` sets the app appearance (see THEME). Pass `browser` to reuse one Chromium.
// Throws ProbeError (its `result` holds the JSON) when anything failed to load or the page shows a
// theme other than the look's; other mistakes (unknown board or look) throw a plain Error.
export async function probe(target, options = {}) {
  const {
    look: requestedLook,
    width,
    height,
    selectors = [],
    limit,
    aria,
    waitFor,
    touch = false,
    motion = 'reduce',
    timeout = DEFAULT_TIMEOUT,
    browser: shared,
  } = options
  const isUrl = /^https?:\/\//.test(target)
  const board = isUrl ? null : readBoards().find((b) => b.file === target || b.name === target)
  if (!isUrl && !board) throw new Error(`unknown mockup ${target}`)
  const look = requestedLook ?? board?.looks[0] ?? 'night'
  if (board && !board.looks.includes(look)) {
    throw new Error(`${board.file} has no look ${look} (has ${board.looks.join(', ')})`)
  }
  if (isUrl && !(look in THEME)) throw new Error(`unknown look ${look} for a URL (night, daylight)`)
  if (look !== FIXED_LOOK && !(look in LOOKS)) throw new Error(`unknown look ${look}`)
  emulation({ look, touch, motion })
  const browser = shared ?? (await launchBrowser())
  const server = board ? await startServer() : null
  let context
  try {
    const size = { width: width ?? board?.width ?? 1440, height: height ?? board?.height ?? 900 }
    const errors = []
    let page
    let url
    let loaded
    if (board) {
      const opened = await openMockup(browser, server.origin, {
        board,
        look,
        touch,
        motion,
        ...size,
      })
      ;({ context, page } = opened)
      errors.push(...opened.errors)
      url = `redesign/mockups${mockupPath(board, look).slice(2)}`
      loaded = opened.shim.done
    } else {
      const opened = await openUrl(browser, target, {
        look,
        touch,
        motion,
        waitFor,
        timeout,
        ...size,
      })
      ;({ context, page, url, loaded } = opened)
      errors.push(...opened.problems)
    }
    const measured = loaded ? await probePage(page, { selectors, limit, aria }) : null
    if (measured && look in THEME) {
      const [name, actual] = board
        ? ['data-theme', measured.display.dataTheme]
        : ['data-appearance', measured.display.appearance]
      if (actual !== THEME[look]) {
        errors.push(`look ${look} expects ${name}="${THEME[look]}", the page has ${actual}`)
      }
    }
    const result = {
      schema: SCHEMA,
      target: board ? board.file : target,
      url,
      look,
      emulation: { ...size, touch, motion },
      errors,
      ...(measured ?? {}),
    }
    if (errors.length) throw new ProbeError(result)
    return result
  } finally {
    await context?.close()
    await server?.close()
    if (!shared) await browser.close()
  }
}

const USAGE = `usage: node scripts/redesign/probe.mjs <board|url> [options]
  --look <id>        night, daylight, or fixed (default: night, or fixed for boards without a look
                     prop). URLs: sets the Storybook appearance global / the app's stored appearance
  --width <px>       viewport width (default: the board's canvas width, 1440 for URLs)
  --height <px>      viewport height (default: the board's canvas height, 900 for URLs)
  --select <sel>     Playwright selector to measure (repeat for several)
  --limit <n>        elements measured per selector (default ${DEFAULT_LIMIT}; count is always total)
  --touch            emulate a touch phone (hasTouch + isMobile: pointer is coarse)
  --motion <m>       reduce (default) or full
  --wait-for <sel>   URL targets: wait for this selector after load (Storybook: the story by default)
  --timeout <ms>     URL targets: navigation and wait timeout (default ${DEFAULT_TIMEOUT})
  --no-aria          leave out the aria snapshot
  --out <file>       write the JSON there instead of stdout
Exit 1 on any error; the JSON (with its \`errors\`) is still written when the page was measured.`

async function cli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      look: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      select: { type: 'string', multiple: true },
      limit: { type: 'string' },
      touch: { type: 'boolean' },
      motion: { type: 'string' },
      'wait-for': { type: 'string' },
      timeout: { type: 'string' },
      'no-aria': { type: 'boolean' },
      out: { type: 'string' },
      help: { type: 'boolean' },
    },
  })
  if (values.help || positionals.length !== 1) {
    console.log(USAGE)
    return values.help ? 0 : 1
  }
  const int = (name) => {
    if (values[name] === undefined) return undefined
    const n = Number(values[name])
    if (!Number.isInteger(n) || n <= 0) throw new Error(`bad --${name} ${values[name]}`)
    return n
  }
  const write = (result) => {
    const json = `${JSON.stringify(result, null, 2)}\n`
    if (values.out) writeFileSync(values.out, json)
    else process.stdout.write(json)
  }
  try {
    write(
      await probe(positionals[0], {
        look: values.look,
        width: int('width'),
        height: int('height'),
        selectors: values.select ?? [],
        limit: int('limit'),
        touch: values.touch,
        motion: values.motion,
        waitFor: values['wait-for'],
        timeout: int('timeout'),
        aria: !values['no-aria'],
      }),
    )
    return 0
  } catch (error) {
    if (!(error instanceof ProbeError)) throw error
    write(error.result)
    for (const message of error.result.errors) console.error(`error: ${message}`)
    return 1
  }
}

if (process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url)) {
  cli().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`error: ${error.message}`)
      process.exit(1)
    },
  )
}
