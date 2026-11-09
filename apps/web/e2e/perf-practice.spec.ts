import { execFileSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { cpus, platform, release, totalmem } from 'node:os'
import { dirname, resolve } from 'node:path'
import {
  type Browser,
  type BrowserContextOptions,
  type CDPSession,
  expect,
  type Locator,
  type Page,
  test,
} from '@playwright/test'
import { openExample } from './helpers'

// Practice-screen performance record (28 §3.1, 12 §10): what s35 and s45 compare against. On the
// example song's practice screen in Chromium with the CPU slowed 4× (CDP), per context:
// - Long Animation Frames over 20 s of looped playback that starts with the count-in, with script
//   attribution;
// - forced style and layout during steady playback, from a CDP trace (devtools.timeline): a Layout
//   or UpdateLayoutTree event nested inside script on the renderer main thread, attributed to the
//   innermost FunctionCall's script and function (LoAF's per-script forcedStyleAndLayoutDuration is
//   kept too, but it only sees frames of 50 ms and more);
// - p75 latency (Event Timing, the longest event of each interaction) of play/pause, a loop-edge
//   nudge, a speed step and a mixer fader key step, N ≥ 10 each.
// It records and writes JSON (PERF_PRACTICE_OUT, default test-results/perf-practice.json) once
// every run of every context has finished; it asserts no thresholds yet. Each context runs
// PERF_PRACTICE_RUNS times (default 3) and keeps the median run, with every run's values beside it
// as the spread. PERF_PRACTICE_MACHINE names the machine and PERF_PRACTICE_NOTES says what else
// was running; both land in the JSON.
//
//   PERF_PRACTICE_OUT=e2e/perf-baseline.json PERF_PRACTICE_MACHINE='…' PERF_PRACTICE_NOTES='…' \
//   UV_PROJECT_ENVIRONMENT=<ML venv> UV_NO_SYNC=1 \
//     pnpm exec playwright test e2e/perf-practice.spec.ts --project chromium

/**
 * Every control the record drives or waits for, in one place: a step that renames one updates it
 * here. Actions go by role and accessible name, or by a key that keeps its meaning after s35:
 * speed uses the on-screen −/+ buttons (↑/↓ stop changing speed in s35); the loop nudge and the
 * fader step use the arrow keys on the focused control. The count-in number is aria-hidden, so it
 * is found by its slot (it is only waited for, never driven).
 */
const SELECTORS = {
  playPause: { role: 'button', name: /^(Play|Pause)$/ },
  pause: { role: 'button', name: /^Pause$/ },
  // s35 renamed them "Slower by 5 %" / "Faster by 5 %" (27 §5.7 shortcuts.slower/faster).
  slower: { role: 'button', name: /^Slower( by 5\s%)?$/ },
  faster: { role: 'button', name: /^Faster( by 5\s%)?$/ },
  loopStartEdge: { role: 'button', name: /^Loop start, bar \d+$/ },
  // Desktop's dock has the mix pill since s35, named by its preset (27 §3.7.1); touch keeps "Mix".
  mixer: { role: 'button', name: /^(Mix|Your part loud|Minus-one|Original)\b/ },
  // The stem faders ("Volume Guitar", "Volume Band"), not the master "Volume".
  fader: { role: 'slider', name: /^Volume / },
  countIn: { css: '[data-slot=count-in]' },
  // The visitor's example offers to save progress the first time playback stops after a pass.
  saveProgress: { role: 'dialog', name: /^Save your progress\?$/ },
  notNow: { role: 'button', name: /^Not now$/ },
} as const satisfies Record<
  string,
  { role: 'button' | 'slider' | 'dialog'; name: RegExp } | { css: string }
>

type Selector = (typeof SELECTORS)[keyof typeof SELECTORS]
const find = (scope: Page | Locator, selector: Selector): Locator =>
  'css' in selector
    ? scope.locator(selector.css)
    : scope.getByRole(selector.role, { name: selector.name })

const { PERF_PRACTICE_RUNS, PERF_PRACTICE_OUT, PERF_PRACTICE_MACHINE, PERF_PRACTICE_NOTES } =
  process.env
const CPU_THROTTLING = 4
const RUNS = Number(PERF_PRACTICE_RUNS ?? 3)
const SAMPLES = 12
const LOAF_WINDOW_MS = 20_000
const TRACE_WINDOW_MS = 10_000
// Event Timing reports nothing shorter than its threshold; 16 ms is the lowest the API allows.
const EVENT_THRESHOLD_MS = 16
// Room after each action for the next frame to present and the observer to deliver its entries.
const SETTLE_MS = 500
const OUT = resolve(PERF_PRACTICE_OUT ?? 'test-results/perf-practice.json')

const CONTEXTS = {
  desktop: {
    description: 'desktop Chromium, 1440 × 900, fine pointer',
    options: { viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 },
    touch: false,
  },
  tablet: {
    description: 'tablet Chromium, 1180 × 820 landscape, touch (hasTouch, isMobile)',
    options: {
      viewport: { width: 1180, height: 820 },
      deviceScaleFactor: 2,
      hasTouch: true,
      isMobile: true,
    },
    touch: true,
  },
} satisfies Record<string, { description: string; options: BrowserContextOptions; touch: boolean }>
type ContextName = keyof typeof CONTEXTS

const ACTIONS = ['playPause', 'loopNudge', 'speedStep', 'faderStep'] as const
type Action = (typeof ACTIONS)[number]

type LoafScript = {
  invoker: string
  invokerType: string
  source: string
  duration: number
  forcedStyleAndLayoutDuration: number
}
type Loaf = { start: number; duration: number; blockingDuration: number; scripts: LoafScript[] }
type EventEntry = { name: string; start: number; duration: number; interactionId: number }

declare global {
  interface Window {
    __perfPractice: { loafs: Loaf[]; events: EventEntry[] }
  }
}

/** Page-side recorders, installed before any app script runs (top frame only). */
function installRecorders(threshold: number) {
  if (window !== window.top) return
  const store: Window['__perfPractice'] = { loafs: [], events: [] }
  window.__perfPractice = store
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & {
      blockingDuration?: number
      scripts?: {
        invoker: string
        invokerType: string
        sourceURL: string
        sourceFunctionName: string
        duration: number
        forcedStyleAndLayoutDuration: number
      }[]
    })[]) {
      store.loafs.push({
        start: entry.startTime,
        duration: entry.duration,
        blockingDuration: entry.blockingDuration ?? 0,
        scripts: (entry.scripts ?? []).map((script) => ({
          invoker: script.invoker,
          invokerType: script.invokerType,
          source: `${script.sourceFunctionName || '(anonymous)'} ${script.sourceURL.split('/').pop() ?? ''}`,
          duration: script.duration,
          forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration,
        })),
      })
    }
  }).observe({ type: 'long-animation-frame', buffered: true })
  new PerformanceObserver((list) => {
    for (const entry of list.getEntries() as (PerformanceEntry & { interactionId?: number })[]) {
      if (!entry.interactionId) continue
      store.events.push({
        name: entry.name,
        start: entry.startTime,
        duration: entry.duration,
        interactionId: entry.interactionId,
      })
    }
  }).observe({
    type: 'event',
    durationThreshold: threshold,
    buffered: true,
  } as PerformanceObserverInit)
}

type Stat = { n: number; p50: number | null; p75: number | null; max: number | null }

const round = (value: number) => Math.round(value * 100) / 100

/** Nearest-rank percentiles, rounded to 0.01 ms. */
function stat(values: number[]): Stat {
  const sorted = [...values].sort((a, b) => a - b)
  const rank = (p: number) => {
    const value = sorted[Math.max(0, Math.ceil(p * sorted.length) - 1)]
    return value === undefined ? null : round(value)
  }
  return { n: sorted.length, p50: rank(0.5), p75: rank(0.75), max: rank(1) }
}

const now = (page: Page) => page.evaluate(() => performance.now())

type Latency = Stat & { belowThreshold: number }

/**
 * Runs `act` SAMPLES times; each run is one sample: the longest Event Timing entry of the
 * interaction it started (the longest one, should it start more). An interaction faster than the
 * threshold leaves no entry; it counts as the threshold (an upper bound) and in `belowThreshold`.
 */
async function latencies(page: Page, act: (index: number) => Promise<void>): Promise<Latency> {
  const samples: number[] = []
  let belowThreshold = 0
  for (let index = 0; index < SAMPLES; index++) {
    const since = await now(page)
    await act(index)
    await page.waitForTimeout(SETTLE_MS)
    const longest = await page.evaluate((from) => {
      let max = 0
      for (const event of window.__perfPractice.events) {
        if (event.start >= from) max = Math.max(max, event.duration)
      }
      return max
    }, since)
    if (longest === 0) {
      belowThreshold++
      samples.push(EVENT_THRESHOLD_MS)
    } else samples.push(longest)
  }
  return { ...stat(samples), belowThreshold }
}

type TraceEvent = {
  name: string
  ph: string
  ts: number
  dur?: number
  pid: number
  tid: number
  args?: { name?: string; data?: { url?: string; functionName?: string } }
}

const SCRIPT_EVENTS = new Set([
  'FunctionCall',
  'EvaluateScript',
  'TimerFire',
  'FireAnimationFrame',
  'EventDispatch',
  'RunMicrotasks',
  'V8.Execute',
  'v8.callFunction',
])
const LAYOUT_EVENTS = new Set(['Layout', 'UpdateLayoutTree'])

type ForcedLayout = Stat & {
  totalMs: number
  byScript: { source: string; count: number; totalMs: number }[]
}

/** Forced style/layout on renderer main threads: layout work nested inside a script event. */
function forcedLayout(events: TraceEvent[]): ForcedLayout {
  const mainThreads = new Set(
    events
      .filter((e) => e.ph === 'M' && e.name === 'thread_name' && e.args?.name === 'CrRendererMain')
      .map((e) => `${e.pid}:${e.tid}`),
  )
  // Begin/end pairs become complete events, so every span has a duration.
  const spans: (TraceEvent & { dur: number })[] = []
  const open = new Map<string, TraceEvent[]>()
  for (const event of [...events].sort((a, b) => a.ts - b.ts)) {
    const thread = `${event.pid}:${event.tid}`
    if (!mainThreads.has(thread)) continue
    if (event.ph === 'X' && event.dur !== undefined) spans.push({ ...event, dur: event.dur })
    else if (event.ph === 'B') open.set(thread, [...(open.get(thread) ?? []), event])
    else if (event.ph === 'E') {
      const stack = open.get(thread) ?? []
      const begin = stack.pop()
      if (begin) spans.push({ ...begin, dur: event.ts - begin.ts })
    }
  }
  const scripts = spans.filter((s) => SCRIPT_EVENTS.has(s.name))
  const forced: { source: string; ms: number }[] = []
  for (const layout of spans.filter((s) => LAYOUT_EVENTS.has(s.name))) {
    const inside = scripts.filter(
      (s) =>
        s.pid === layout.pid &&
        s.tid === layout.tid &&
        s.ts <= layout.ts &&
        s.ts + s.dur >= layout.ts + layout.dur,
    )
    if (inside.length === 0) continue
    // The innermost script around it names the source.
    const innermost = inside.reduce((a, b) => (b.ts >= a.ts && b.dur <= a.dur ? b : a))
    const call = inside
      .filter((s) => s.name === 'FunctionCall')
      .reduce<TraceEvent | undefined>(
        (a, b) => (!a || (b.ts >= a.ts && (b.dur ?? 0) <= (a.dur ?? 0)) ? b : a),
        undefined,
      )
    const data = call?.args?.data
    const source = data
      ? `${data.functionName || '(anonymous)'} ${data.url?.split('/').pop() ?? ''}`.trim()
      : innermost.name
    forced.push({ source, ms: layout.dur / 1000 })
  }
  const bySource = new Map<string, { count: number; totalMs: number }>()
  for (const { source, ms } of forced) {
    const entry = bySource.get(source) ?? { count: 0, totalMs: 0 }
    bySource.set(source, { count: entry.count + 1, totalMs: entry.totalMs + ms })
  }
  return {
    ...stat(forced.map((f) => f.ms)),
    totalMs: round(forced.reduce((sum, f) => sum + f.ms, 0)),
    byScript: [...bySource]
      .map(([source, entry]) => ({ source, count: entry.count, totalMs: round(entry.totalMs) }))
      .sort((a, b) => b.totalMs - a.totalMs),
  }
}

async function trace(cdp: CDPSession, page: Page, ms: number): Promise<TraceEvent[]> {
  const events: TraceEvent[] = []
  const collect = ({ value }: { value: object[] }) => events.push(...(value as TraceEvent[]))
  cdp.on('Tracing.dataCollected', collect)
  await cdp.send('Tracing.start', {
    transferMode: 'ReportEvents',
    traceConfig: { includedCategories: ['devtools.timeline', '__metadata'] },
  })
  await page.waitForTimeout(ms)
  const complete = new Promise<void>((done) => cdp.once('Tracing.tracingComplete', () => done()))
  await cdp.send('Tracing.end')
  await complete
  cdp.off('Tracing.dataCollected', collect)
  return events
}

type Loafs = {
  duration: Stat
  blockingDuration: Stat
  byScript: { source: string; invoker: string; count: number; totalMs: number; forcedMs: number }[]
}

function summariseLoafs(loafs: Loaf[]): Loafs {
  const byScript = new Map<
    string,
    { source: string; invoker: string; count: number; totalMs: number; forcedMs: number }
  >()
  for (const script of loafs.flatMap((loaf) => loaf.scripts)) {
    const key = `${script.invoker}|${script.source}`
    const entry = byScript.get(key) ?? {
      source: script.source,
      invoker: script.invoker,
      count: 0,
      totalMs: 0,
      forcedMs: 0,
    }
    byScript.set(key, {
      ...entry,
      count: entry.count + 1,
      totalMs: entry.totalMs + script.duration,
      forcedMs: entry.forcedMs + script.forcedStyleAndLayoutDuration,
    })
  }
  return {
    duration: stat(loafs.map((l) => l.duration)),
    blockingDuration: stat(loafs.map((l) => l.blockingDuration)),
    byScript: [...byScript.values()]
      .map((e) => ({ ...e, totalMs: round(e.totalMs), forcedMs: round(e.forcedMs) }))
      .sort((a, b) => b.totalMs - a.totalMs),
  }
}

/**
 * How busy every core of the machine was, 0–1, over `ms` (os.cpus() times; Windows has no load
 * average). Sampled while nothing of the run is open, it shows other load on the machine.
 */
async function machineBusy(ms: number): Promise<number> {
  const totals = () =>
    cpus().reduce(
      (sum, cpu) => {
        const { user, nice, sys, irq, idle } = cpu.times
        return {
          busy: sum.busy + user + nice + sys + irq,
          all: sum.all + user + nice + sys + irq + idle,
        }
      },
      { busy: 0, all: 0 },
    )
  const before = totals()
  await new Promise((done) => setTimeout(done, ms))
  const after = totals()
  return round((after.busy - before.busy) / Math.max(1, after.all - before.all))
}

type Run = {
  run: number
  startedAt: string
  /** Share of the machine's CPU in use over 3 s before the run opened its context. */
  machineBusyBefore: number
  layout: { coarsePointer: boolean; innerWidth: number; innerHeight: number }
  countInSeen: boolean
  loafs: Loafs
  forcedLayout: ForcedLayout
  latency: Record<Action, Latency>
}

async function recordRun(
  browser: Browser,
  name: ContextName,
  run: number,
  baseURL: string | undefined,
): Promise<Run> {
  const setup = CONTEXTS[name]
  const startedAt = new Date().toISOString()
  const machineBusyBefore = await machineBusy(3_000)
  const context = await browser.newContext({
    ...setup.options,
    ...(baseURL ? { baseURL } : {}),
    reducedMotion: 'no-preference',
    serviceWorkers: 'block',
  })
  const page = await context.newPage()
  await page.addInitScript(installRecorders, EVENT_THRESHOLD_MS)
  const press = (locator: Locator) => (setup.touch ? locator.tap() : locator.click())
  try {
    const start = await openExample(page)
    const layout = await page.evaluate(() => ({
      coarsePointer: matchMedia('(pointer: coarse)').matches,
      innerWidth,
      innerHeight,
    }))
    const cdp = await context.newCDPSession(page)
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: CPU_THROTTLING })

    // Looped playback from the example's loop, starting with its count-in.
    const pressed = await now(page)
    await press(start)
    await expect(find(page, SELECTORS.pause)).toBeVisible()
    await expect(find(page, SELECTORS.loopStartEdge)).toBeVisible()
    const countInSeen = await find(page, SELECTORS.countIn)
      .waitFor({ state: 'visible', timeout: 5_000 })
      .then(
        () => true,
        () => false,
      )
    const elapsed = (await now(page)) - pressed
    await page.waitForTimeout(Math.max(0, LOAF_WINDOW_MS - elapsed))
    const loafs = await page.evaluate(
      ([from, to]) => window.__perfPractice.loafs.filter((l) => l.start >= from && l.start < to),
      [pressed, pressed + LOAF_WINDOW_MS] as const,
    )

    // Steady playback: well past the count-in, the loop wrapping.
    const forced = forcedLayout(await trace(cdp, page, TRACE_WINDOW_MS))

    // Each action alternates direction, so the loop, speed and mix end where they started.
    const latency = {} as Record<Action, Latency>
    latency.speedStep = await latencies(page, (i) =>
      press(find(page, i % 2 === 0 ? SELECTORS.faster : SELECTORS.slower)),
    )
    const edge = find(page, SELECTORS.loopStartEdge)
    latency.loopNudge = await latencies(page, async (i) => {
      await edge.focus()
      await page.keyboard.press(i % 2 === 0 ? 'ArrowRight' : 'ArrowLeft')
    })
    // The first stop after a pass opens the save sheet once; it is dismissed before measuring, so
    // every measured press is the transport's own work.
    await press(find(page, SELECTORS.pause))
    const save = find(page, SELECTORS.saveProgress)
    if (
      await save.waitFor({ timeout: 5_000 }).then(
        () => true,
        () => false,
      )
    ) {
      await press(find(save, SELECTORS.notNow))
      await expect(save).toBeHidden()
    }
    // An even number of presses from paused, so it ends paused.
    latency.playPause = await latencies(page, async () => {
      await press(find(page, SELECTORS.playPause))
      // Play starts with the count-in; give each state a moment before the next press.
      await page.waitForTimeout(300)
    })
    // The fader steps while the loop plays. The mixer stays open to the end: the drawer may cover
    // its own toggle on narrower screens.
    await press(find(page, SELECTORS.playPause))
    await expect(find(page, SELECTORS.pause)).toBeVisible()
    await press(find(page, SELECTORS.mixer))
    const fader = find(page, SELECTORS.fader).first()
    await expect(fader).toBeVisible()
    latency.faderStep = await latencies(page, async (i) => {
      await fader.focus()
      await page.keyboard.press(i % 2 === 0 ? 'ArrowDown' : 'ArrowUp')
    })
    return {
      run,
      startedAt,
      machineBusyBefore,
      layout,
      countInSeen,
      loafs: summariseLoafs(loafs),
      forcedLayout: forced,
      latency,
    }
  } finally {
    await context.close()
  }
}

// One run after another in one worker: a failed run stops the rest, and nothing is written.
test.describe.configure({ mode: 'serial' })

const results: Record<ContextName, Run[]> = { desktop: [], tablet: [] }

for (const name of Object.keys(CONTEXTS) as ContextName[]) {
  for (let run = 1; run <= RUNS; run++) {
    test(`practice perf record: ${name}, run ${run} of ${RUNS}`, async ({ browser }, info) => {
      test.skip(info.project.name !== 'chromium', 'LoAF, Event Timing and CDP are Chromium-only')
      test.setTimeout(300_000)
      results[name].push(await recordRun(browser, name, run, info.project.use.baseURL))
    })
  }
}

/** The run whose mean p75 latency over the four actions is the median of the runs. */
function medianRun(runs: Run[]): Run | undefined {
  const score = (run: Run) =>
    ACTIONS.reduce((sum, action) => sum + (run.latency[action].p75 ?? 0), 0) / ACTIONS.length
  const ranked = [...runs].sort((a, b) => score(a) - score(b))
  return ranked[Math.floor((ranked.length - 1) / 2)]
}

/** Every run's value of one measure, and its range. */
function spread(values: (number | null)[]) {
  const known = values.filter((value): value is number => value !== null)
  return {
    runs: values,
    min: known.length ? Math.min(...known) : null,
    max: known.length ? Math.max(...known) : null,
  }
}

function git(args: string[]): string {
  return execFileSync('git', args, { encoding: 'utf8' }).trim()
}

test.afterAll(async ({ browser }, info) => {
  if (info.project.name !== 'chromium') return
  const names = Object.keys(CONTEXTS) as ContextName[]
  // A partial record never overwrites a complete one.
  if (names.some((name) => results[name].length < RUNS)) return
  const contexts = Object.fromEntries(
    names.map((name) => {
      const runs = results[name]
      const kept = medianRun(runs)
      if (!kept) throw new Error(`no run of ${name}`)
      return [
        name,
        {
          description: CONTEXTS[name].description,
          options: CONTEXTS[name].options,
          keptRun: kept.run,
          runs: runs.map((run) => ({
            run: run.run,
            startedAt: run.startedAt,
            machineBusyBefore: run.machineBusyBefore,
            layout: run.layout,
            countInSeen: run.countInSeen,
          })),
          measures: {
            longAnimationFrames: kept.loafs.duration,
            longAnimationFrameBlocking: kept.loafs.blockingDuration,
            forcedStyleAndLayout: {
              n: kept.forcedLayout.n,
              p50: kept.forcedLayout.p50,
              p75: kept.forcedLayout.p75,
              max: kept.forcedLayout.max,
              totalMs: kept.forcedLayout.totalMs,
            },
            ...Object.fromEntries(
              ACTIONS.map((action) => [`latency.${action}`, kept.latency[action]]),
            ),
          },
          attribution: {
            longAnimationFrames: kept.loafs.byScript,
            forcedStyleAndLayout: kept.forcedLayout.byScript,
          },
          spread: {
            'longAnimationFrames.n': spread(runs.map((run) => run.loafs.duration.n)),
            'longAnimationFrames.p75': spread(runs.map((run) => run.loafs.duration.p75)),
            'longAnimationFrames.max': spread(runs.map((run) => run.loafs.duration.max)),
            'forcedStyleAndLayout.n': spread(runs.map((run) => run.forcedLayout.n)),
            'forcedStyleAndLayout.totalMs': spread(runs.map((run) => run.forcedLayout.totalMs)),
            ...Object.fromEntries(
              ACTIONS.flatMap((action) => [
                [`latency.${action}.p50`, spread(runs.map((run) => run.latency[action].p50))],
                [`latency.${action}.p75`, spread(runs.map((run) => run.latency[action].p75))],
                [`latency.${action}.max`, spread(runs.map((run) => run.latency[action].max))],
              ]),
            ),
          },
        },
      ]
    }),
  )
  const cpu = cpus()
  const record = {
    schema: 1,
    recordedAt: new Date().toISOString(),
    git: {
      sha: git(['rev-parse', 'HEAD']),
      subject: git(['log', '-1', '--format=%s']),
      uncommitted: git(['status', '--porcelain']).split('\n').filter(Boolean),
    },
    machine: {
      name: PERF_PRACTICE_MACHINE ?? null,
      platform: `${platform()} ${release()}`,
      cpu: cpu[0]?.model ?? 'unknown',
      logicalCores: cpu.length,
      memoryGb: Math.round(totalmem() / 2 ** 30),
      node: process.version,
      notes: PERF_PRACTICE_NOTES ?? null,
    },
    browser: {
      name: browser.browserType().name(),
      version: browser.version(),
      headless: info.project.use.headless ?? true,
    },
    throttling: {
      cpu: CPU_THROTTLING,
      via: 'CDP Emulation.setCPUThrottlingRate on the page, after the example loads',
    },
    method: {
      screen:
        'the onboarding example song (openExample: /start, Guitar, Just started, Skip), its practice screen, started from the "Play your part" card',
      motion: 'full (reducedMotion no-preference); service workers blocked',
      longAnimationFrames: `PerformanceObserver long-animation-frame (≥ 50 ms), ${LOAF_WINDOW_MS / 1000} s from the press that starts the looped playback with its count-in`,
      forcedStyleAndLayout: `CDP trace (devtools.timeline) over ${TRACE_WINDOW_MS / 1000} s of steady playback right after that window: Layout/UpdateLayoutTree nested in script on CrRendererMain, attributed to the innermost FunctionCall; LoAF per-script forcedStyleAndLayoutDuration is in attribution.longAnimationFrames`,
      latency: `Event Timing (durationThreshold ${EVENT_THRESHOLD_MS} ms), one sample per action = the longest entry of the interactions it started, ${SAMPLES} samples per action during playback (play/pause alternates while stopped and playing); a sample below the threshold counts as ${EVENT_THRESHOLD_MS} ms and in belowThreshold`,
      actions: {
        playPause: 'press Play/Pause in the transport',
        loopNudge: 'ArrowRight/ArrowLeft on the focused loop-start edge of the song map',
        speedStep: 'press Faster/Slower (the on-screen speed buttons)',
        faderStep:
          'ArrowDown/ArrowUp on the focused first stem fader in the open mixer, while playing',
      },
      press: 'desktop: click; tablet: tap',
      percentiles: 'nearest rank; ms rounded to 0.01',
      keptRun: 'per context, the run with the median mean-p75 latency; spread lists every run',
      selectors: SELECTORS,
    },
    contexts,
  }
  mkdirSync(dirname(OUT), { recursive: true })
  writeFileSync(
    OUT,
    `${JSON.stringify(record, (_, value) => (value instanceof RegExp ? value.source : value), 2)}\n`,
  )
})
