// Shared plumbing for render-mockups.mjs and probe.mjs: the board list (redesign/mockups +
// canvas.json), the render plan (which widths and looks apply to which board), a read-only
// localhost server that serves the mockups with shim.js standing in for ./support.js, and
// opening one board in Chromium with the shim's outcome checked. Playwright and its Chromium
// come from apps/web (no root dependency).
import { readdirSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const MOCKUPS_DIR = join(ROOT, 'redesign', 'mockups')
export const OUT_DIR = join(ROOT, 'redesign', '.renders')
const SHIM = join(dirname(fileURLToPath(import.meta.url)), 'shim.js')

// Look ids used in file names and on the command line → the mockups' `look` prop values.
// `fixed` is a board without a look prop (the direction studies and Foundations): it renders
// its own hard-coded look once.
export const LOOKS = { night: 'Night Rehearsal', daylight: 'Daylight' }
export const FIXED_LOOK = 'fixed'
export const WIDTHS = [1440, 1180, 390]

const SUFFIX = '.dc.html'

export function boardName(file) {
  return file.endsWith(SUFFIX) ? file.slice(0, -SUFFIX.length) : file
}

// Every *.dc.html with its canvas.json board (size, title, `expand: fill` = fluid) and whether
// its data-props declare the `look` prop. A file missing from canvas.json, or the reverse, is an
// error: the board list must not drift silently.
export function readBoards(dir = MOCKUPS_DIR) {
  const canvas = JSON.parse(readFileSync(join(dir, 'canvas.json'), 'utf8'))
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(SUFFIX))
    .sort()
  const missing = Object.keys(canvas.boards).filter((file) => !files.includes(file))
  if (missing.length) throw new Error(`canvas.json lists missing files: ${missing.join(', ')}`)
  return files.map((file) => {
    const board = canvas.boards[file]
    if (!board) throw new Error(`${file}: not in canvas.json`)
    const html = readFileSync(join(dir, file), 'utf8')
    const match = /data-props='([^']*)'/.exec(html)
    if (!match) throw new Error(`${file}: no data-props on the x-dc script`)
    const props = JSON.parse(match[1])
    if (props.look) {
      for (const look of Object.values(LOOKS)) {
        if (!props.look.options.includes(look)) throw new Error(`${file}: look has no "${look}"`)
      }
    }
    return {
      name: boardName(file),
      file,
      title: board.title,
      width: board.w,
      height: board.h,
      fluid: board.expand === 'fill',
      looks: props.look ? Object.keys(LOOKS) : [FIXED_LOOK],
    }
  })
}

// Fluid boards render at every requested width; a fixed-size board (phones 390, Stand 1180,
// System 1440, direction studies 1280) only at its own width. The viewport height is the canvas
// board height; screenshots are full-page, so taller content still shows.
export function planRenders(boards, { files, widths, looks } = {}) {
  const jobs = []
  const skips = []
  const wanted = files?.length ? files.map(boardName) : null
  if (wanted) {
    const unknown = wanted.filter((name) => !boards.some((board) => board.name === name))
    if (unknown.length) throw new Error(`unknown mockup: ${unknown.join(', ')}`)
  }
  for (const board of boards) {
    if (wanted && !wanted.includes(board.name)) continue
    const boardWidths = board.fluid ? WIDTHS : [board.width]
    const useWidths = widths?.length ? boardWidths.filter((w) => widths.includes(w)) : boardWidths
    const useLooks = looks?.length ? board.looks.filter((l) => looks.includes(l)) : board.looks
    if (!board.fluid) {
      const other = (widths?.length ? widths : WIDTHS).filter((w) => w !== board.width)
      if (other.length) {
        skips.push(`${board.name}: fixed ${board.width}px board, skipped width ${other.join(', ')}`)
      }
    }
    if (board.looks[0] === FIXED_LOOK) {
      skips.push(`${board.name}: no look prop, renders its fixed look only (no night/daylight)`)
    } else if (useLooks.length < board.looks.length) {
      const other = board.looks.filter((l) => !useLooks.includes(l))
      skips.push(`${board.name}: look filter skipped ${other.join(', ')}`)
    }
    for (const look of useLooks) {
      for (const width of useWidths) {
        jobs.push({ board, look, width, height: board.height })
      }
    }
  }
  return { jobs, skips }
}

export function splitList(values, map = (v) => v) {
  return (values ?? [])
    .flatMap((value) => value.split(','))
    .filter(Boolean)
    .map(map)
}

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
}

// Serves /m/<file> from redesign/mockups and /t/<file> from in-memory fixtures (self-check), with
// /m/support.js and /t/support.js answered by the shim. Bound to 127.0.0.1, GET only, flat file
// names only: nothing outside redesign/mockups is reachable.
export async function startServer({ fixtures = {} } = {}) {
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url ?? '/', 'http://127.0.0.1')
    const match = /^\/([mt])\/([\w.-]+)$/.exec(pathname)
    const send = (status, body, type = 'text/plain; charset=utf-8') => {
      res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' })
      res.end(body)
    }
    if (req.method !== 'GET' || !match || match[2].startsWith('.')) return send(404, 'not found')
    const [, area, name] = match
    const type = TYPES[name.slice(name.lastIndexOf('.'))]
    if (!type) return send(404, 'not found')
    try {
      if (name === 'support.js') return send(200, readFileSync(SHIM), type)
      if (area === 't' && fixtures[name] !== undefined) return send(200, fixtures[name], type)
      return send(200, readFileSync(join(MOCKUPS_DIR, name)), type)
    } catch {
      return send(404, 'not found')
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, '127.0.0.1', resolve)
  })
  const { port } = server.address()
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

export async function launchBrowser() {
  const require = createRequire(join(ROOT, 'apps', 'web', 'package.json'))
  let playwright
  try {
    playwright = require('playwright')
  } catch {
    throw new Error('playwright not found in apps/web; run `pnpm install --frozen-lockfile`')
  }
  try {
    return await playwright.chromium.launch()
  } catch (error) {
    throw new Error(
      `Chromium failed to launch (is it installed? \`pnpm --filter @splitune/web exec playwright install chromium\`): ${error.message}`,
    )
  }
}

export function mockupPath(board, look, area = 'm') {
  const query = look in LOOKS ? `?look=${encodeURIComponent(LOOKS[look])}` : ''
  return `/${area}/${board.file}${query}`
}

// Prepares a page for a board: viewport, colour-scheme emulation matching the look (form controls
// follow it; the boards themselves switch on data-theme), reduced motion.
export async function preparePage(browser, { width, height, look }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    colorScheme: look === 'daylight' ? 'light' : 'dark',
    reducedMotion: 'reduce',
  })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
  page.on('requestfailed', (request) => {
    const url = new URL(request.url())
    if (url.hostname === '127.0.0.1') problems.push(`request failed: ${url.pathname}`)
  })
  page.on('response', (response) => {
    const url = new URL(response.url())
    if (url.hostname === '127.0.0.1' && response.status() >= 400) {
      problems.push(`HTTP ${response.status()}: ${url.pathname}`)
    }
  })
  return { context, page, problems }
}

// Loads a board through the shim and waits for fonts. Returns the shim outcome plus same-origin
// load problems; `errors` is empty only when the board rendered completely.
export async function openMockup(browser, origin, { board, look, width, height, area = 'm' }) {
  const { context, page, problems } = await preparePage(browser, { width, height, look })
  await page.goto(`${origin}${mockupPath(board, look, area)}`, { waitUntil: 'networkidle' })
  try {
    await page.waitForFunction(() => window.__dc?.done === true, null, { timeout: 15_000 })
  } catch {
    const shim = { done: false, ok: false, errors: ['the shim never finished'], holes: 0 }
    return {
      context,
      page,
      shim: { ...shim, removedHandlers: [] },
      errors: [...shim.errors, ...problems],
    }
  }
  const shim = await page.evaluate(() => window.__dc)
  await settle(page)
  return { context, page, shim, errors: [...shim.errors, ...problems] }
}

// Forces layout so every used face is requested, then waits for the font loads to finish.
export async function settle(page) {
  await page.evaluate(async () => {
    document.body?.getBoundingClientRect()
    await document.fonts.ready
  })
  await page.waitForLoadState('networkidle')
  await page.evaluate(() => document.fonts.ready)
}

const GENERIC = new Set([
  'serif',
  'sans-serif',
  'monospace',
  'cursive',
  'fantasy',
  'system-ui',
  'ui-serif',
  'ui-sans-serif',
  'ui-monospace',
  'ui-rounded',
  'math',
  'emoji',
])

// `requested`: the first family of every element that shows text. `loaded`: families with at
// least one loaded face. `missing`: requested but not loaded, i.e. drawn with a fallback.
export async function collectFonts(page) {
  const { requested, loaded } = await page.evaluate(() => {
    const unquote = (family) => family.trim().replace(/^["']|["']$/g, '')
    const loadedSet = new Set(
      [...document.fonts].filter((face) => face.status === 'loaded').map((f) => unquote(f.family)),
    )
    const requestedSet = new Set()
    for (const el of document.body.querySelectorAll('*')) {
      const hasText = [...el.childNodes].some((n) => n.nodeType === 3 && n.data.trim())
      if (hasText) requestedSet.add(unquote(getComputedStyle(el).fontFamily.split(',')[0]))
    }
    return { requested: [...requestedSet], loaded: [...loadedSet] }
  })
  const req = requested.filter((family) => !GENERIC.has(family)).sort()
  return {
    requested: req,
    loaded: loaded.sort(),
    missing: req.filter((family) => !loaded.includes(family)),
  }
}
