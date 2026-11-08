// Measures a page for fidelity checks: the aria snapshot and, per selector, bounding boxes and
// computed styles. The target is a mockup board (rendered through the shim) or any URL (the app,
// a Storybook iframe). The JSON shape (schema 1) is documented in README.md; keys and ordering are
// stable so two probes can be diffed.
//
//   node scripts/redesign/probe.mjs Main --look daylight --width 1440 --select .play --select header
//   node scripts/redesign/probe.mjs 'http://localhost:6006/iframe.html?id=ui-button--primary' \
//     --look night --width 1180 --select button --wait-for button
//
// From Node: import { probe, probePage } from './scripts/redesign/probe.mjs'
import { realpathSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { parseArgs } from 'node:util'
import {
  collectFonts,
  FIXED_LOOK,
  LOOKS,
  launchBrowser,
  mockupPath,
  openMockup,
  preparePage,
  readBoards,
  settle,
  startServer,
} from './harness.mjs'

export const SCHEMA = 1
const DEFAULT_LIMIT = 20

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
        lineHeight: s.lineHeight,
        letterSpacing: s.letterSpacing,
        padding: sides(s, (side) => `padding${side}`),
        borderWidth: sides(s, (side) => `border${side}Width`),
        borderStyle: sides(s, (side) => `border${side}Style`),
        borderColor,
        borderRadius: ['TopLeft', 'TopRight', 'BottomRight', 'BottomLeft'].map(
          (corner) => s[`border${corner}Radius`],
        ),
        gap: [s.rowGap, s.columnGap],
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
  const info = await page.evaluate(() => ({
    viewport: { width: innerWidth, height: innerHeight },
    page: {
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
    },
    dataTheme: document.querySelector('[data-theme]')?.getAttribute('data-theme') ?? null,
  }))
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

// Opens `target` (a board name such as Main / Main.dc.html, or an http(s) URL), probes it and
// closes it. For a board, width and height default to its canvas size and `look` picks the look
// prop; for a URL, `look` only sets prefers-color-scheme (put the app's theme in the URL).
// Pass `browser` to reuse one Chromium across calls. Throws when the board fails to render.
export async function probe(target, options = {}) {
  const {
    look: requestedLook,
    width,
    height,
    selectors = [],
    limit,
    aria,
    waitFor,
    browser: shared,
  } = options
  const isUrl = /^https?:\/\//.test(target)
  const board = isUrl ? null : readBoards().find((b) => b.file === target || b.name === target)
  if (!isUrl && !board) throw new Error(`unknown mockup ${target}`)
  const look = requestedLook ?? board?.looks[0] ?? 'night'
  if (board && !board.looks.includes(look)) {
    throw new Error(`${board.file} has no look ${look} (has ${board.looks.join(', ')})`)
  }
  if (isUrl && !(look in LOOKS) && look !== FIXED_LOOK) throw new Error(`unknown look ${look}`)
  const browser = shared ?? (await launchBrowser())
  const server = board ? await startServer() : null
  let context
  try {
    const size = { width: width ?? board?.width ?? 1440, height: height ?? board?.height ?? 900 }
    let page
    if (board) {
      const opened = await openMockup(browser, server.origin, { board, look, ...size })
      ;({ context, page } = opened)
      if (opened.errors.length) throw new Error(`${board.file}: ${opened.errors.join('; ')}`)
    } else {
      ;({ context, page } = await preparePage(browser, { ...size, look }))
      await page.goto(target, { waitUntil: 'networkidle' })
      if (waitFor) await page.locator(waitFor).first().waitFor()
      await settle(page)
    }
    const measured = await probePage(page, { selectors, limit, aria })
    return {
      schema: SCHEMA,
      target: board ? board.file : target,
      url: board ? `redesign/mockups${mockupPath(board, look).slice(2)}` : target,
      look,
      ...measured,
    }
  } finally {
    await context?.close()
    await server?.close()
    if (!shared) await browser.close()
  }
}

const USAGE = `usage: node scripts/redesign/probe.mjs <board|url> [options]
  --look <id>        night, daylight, or fixed (default: night, or fixed for boards without a look prop)
  --width <px>       viewport width (default: the board's canvas width, 1440 for URLs)
  --height <px>      viewport height (default: the board's canvas height, 900 for URLs)
  --select <sel>     Playwright selector to measure (repeat for several)
  --limit <n>        elements measured per selector (default ${DEFAULT_LIMIT}; count is always total)
  --wait-for <sel>   URL targets: wait for this selector before measuring
  --no-aria          leave out the aria snapshot
  --out <file>       write the JSON there instead of stdout`

async function cli() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      look: { type: 'string' },
      width: { type: 'string' },
      height: { type: 'string' },
      select: { type: 'string', multiple: true },
      limit: { type: 'string' },
      'wait-for': { type: 'string' },
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
  const result = await probe(positionals[0], {
    look: values.look,
    width: int('width'),
    height: int('height'),
    selectors: values.select ?? [],
    limit: int('limit'),
    aria: !values['no-aria'],
    waitFor: values['wait-for'],
  })
  const json = `${JSON.stringify(result, null, 2)}\n`
  if (values.out) writeFileSync(values.out, json)
  else process.stdout.write(json)
  return 0
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
