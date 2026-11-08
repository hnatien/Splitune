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
// What a page must show for a look. Boards: the root's data-theme (the mockups' LOOKS map). The app
// and Storybook: <html data-appearance> (apps/web/app/ui/display.ts).
export const THEME = { night: 'dark', daylight: 'light' }
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

// Emulation shared by boards and URLs: viewport, device scale 1, prefers-color-scheme matching the
// look (form controls follow it; the boards themselves switch on data-theme), motion (`reduce` by
// default for stable measurements) and, with `touch`, a touch phone (hasTouch + isMobile, so
// `(pointer: coarse)` matches as on a real phone).
export function emulation({ look, touch = false, motion = 'reduce' }) {
  if (motion !== 'reduce' && motion !== 'full') throw new Error(`unknown motion ${motion}`)
  return {
    colorScheme: look === 'daylight' ? 'light' : 'dark',
    reducedMotion: motion === 'reduce' ? 'reduce' : 'no-preference',
    hasTouch: Boolean(touch),
    isMobile: Boolean(touch),
  }
}

// Opens a page and records load problems: page errors, failed requests and HTTP errors for the
// requests `track(url)` accepts (boards: the local server only, so a font CDN outage is a font
// fallback, not a failure; URL targets: every host).
export async function preparePage(browser, { width, height, look, touch, motion, track }) {
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    ...emulation({ look, touch, motion }),
  })
  const page = await context.newPage()
  const problems = []
  page.on('pageerror', (error) => problems.push(`page error: ${error.message}`))
  page.on('requestfailed', (request) => {
    if (track(new URL(request.url()))) {
      problems.push(`request failed (${request.failure()?.errorText}): ${request.url()}`)
    }
  })
  page.on('response', (response) => {
    if (track(new URL(response.url())) && response.status() >= 400) {
      problems.push(`HTTP ${response.status()}: ${response.url()}`)
    }
  })
  return { context, page, problems }
}

const isLocalServer = (url) => url.hostname === '127.0.0.1'

// Loads a board through the shim and waits for fonts. Returns the shim outcome plus load problems;
// `errors` is empty only when the board rendered completely. Never throws for a broken board (a
// navigation timeout is an error of that board), so one bad file can't stop a whole run.
export async function openMockup(browser, origin, options) {
  const { board, look, width, height, touch, motion, area = 'm' } = options
  const opened = await preparePage(browser, {
    width,
    height,
    look,
    touch,
    motion,
    track: isLocalServer,
  })
  const { context, page, problems } = opened
  const failed = (message) => ({
    context,
    page,
    shim: { done: false, ok: false, errors: [message], holes: 0, removedHandlers: [] },
    errors: [message, ...problems],
  })
  try {
    await page.goto(`${origin}${mockupPath(board, look, area)}`, { waitUntil: 'networkidle' })
  } catch (error) {
    return failed(`navigation failed: ${error.message.split('\n')[0]}`)
  }
  try {
    await page.waitForFunction(() => window.__dc?.done === true, null, { timeout: 15_000 })
  } catch {
    return failed('the shim never finished')
  }
  const shim = await page.evaluate(() => window.__dc)
  try {
    await settle(page)
  } catch (error) {
    problems.push(`fonts did not settle: ${error.message.split('\n')[0]}`)
  }
  return { context, page, shim, errors: [...shim.errors, ...problems] }
}

// Forces layout so every used face is requested, then waits for the font loads to finish. Boards
// are static, so they also wait for network idle; app pages may hold an EventSource open forever,
// so URL targets don't.
export async function settle(page, { networkIdle = true } = {}) {
  await page.evaluate(async () => {
    document.body?.getBoundingClientRect()
    await document.fonts.ready
  })
  if (networkIdle) await page.waitForLoadState('networkidle')
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve))
      }),
  )
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

// `requested`: the first family of every rendered element that shows text. `loaded`: families with at
// least one loaded face. `missing`: requested but not loaded, i.e. drawn with a fallback.
export async function collectFonts(page) {
  const { requested, loaded } = await page.evaluate(() => {
    const unquote = (family) => family.trim().replace(/^["']|["']$/g, '')
    const loadedSet = new Set(
      [...document.fonts].filter((face) => face.status === 'loaded').map((f) => unquote(f.family)),
    )
    const requestedSet = new Set()
    for (const el of document.body.querySelectorAll('*')) {
      if (!el.checkVisibility()) continue
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
