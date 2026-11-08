// Renders redesign/mockups/*.dc.html to reference PNGs (Night Rehearsal and Daylight at 1440, 1180
// and 390) in the ignored redesign/.renders/, with a manifest of fonts and overflow per render.
// Never writes to redesign/mockups. Exits 1 on any render error, naming the file.
//
//   node scripts/redesign/render-mockups.mjs                       # everything
//   node scripts/redesign/render-mockups.mjs --file Main --width 1440 --look daylight
//   node scripts/redesign/render-mockups.mjs --check               # self-check, no PNGs
//
// One heavy browser run per machine: hold the run's heavy lock around it. See README.md.
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { NEGATIVE, POSITIVE, runChecks } from './fixtures.mjs'
import {
  collectFonts,
  FIXED_LOOK,
  LOOKS,
  launchBrowser,
  OUT_DIR,
  openMockup,
  planRenders,
  ROOT,
  readBoards,
  splitList,
  startServer,
  THEME,
} from './harness.mjs'

const CONCURRENCY = 4

const USAGE = `usage: node scripts/redesign/render-mockups.mjs [options]
  --file <name>    only these mockups (Main or Main.dc.html; repeat or comma-separate)
  --width <px>     only these widths (1440, 1180, 390; fixed boards use their own width)
  --look <id>      only these looks: night, daylight, fixed (boards without a look prop)
  --out <dir>      output folder (default redesign/.renders)
  --check          self-check, writes nothing: every board in every look renders with no unknown
                   tag or unresolved hole and the look's data-theme, fixtures render exactly as
                   expected, and broken fixtures fail
  --help`

// Repo-relative inside the repo, absolute elsewhere.
function shown(path) {
  const rel = relative(ROOT, path)
  return rel && !rel.startsWith('..') ? rel : path
}

// Runs jobs `size` at a time. A job that throws is reported through onError and the rest go on.
async function pool(items, size, run, onError) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) {
        const item = queue.shift()
        try {
          await run(item)
        } catch (error) {
          onError(item, error)
        }
      }
    }),
  )
}

async function measure(page) {
  return page.evaluate(() => {
    const root = document.body.firstElementChild
    const doc = document.documentElement
    return {
      page: { width: doc.scrollWidth, height: doc.scrollHeight },
      theme: root?.getAttribute('data-theme') ?? null,
      rootClass: root?.getAttribute('class') ?? null,
      // px of content cut off or scrolled sideways: a desktop-only board at 390 shows up here.
      overflowX: Math.max(
        doc.scrollWidth - doc.clientWidth,
        root ? root.scrollWidth - root.clientWidth : 0,
      ),
    }
  })
}

async function selfCheck(browser, boards) {
  const all = { ...NEGATIVE, ...POSITIVE }
  const server = await startServer({
    fixtures: Object.fromEntries(Object.entries(all).map(([name, f]) => [name, f.html])),
  })
  const failures = []
  let rendered = 0
  const openFixture = (file, look) =>
    openMockup(browser, server.origin, {
      board: { file, width: 390 },
      look: look ?? FIXED_LOOK,
      width: 390,
      height: 200,
      area: 't',
    })
  try {
    const { jobs } = planRenders(boards)
    const once = jobs.filter(
      (job, i) => jobs.findIndex((j) => j.board === job.board && j.look === job.look) === i,
    )
    await pool(
      once,
      CONCURRENCY,
      async (job) => {
        const { context, page, shim, errors } = await openMockup(browser, server.origin, {
          ...job,
          width: job.board.width,
        })
        try {
          if (shim.done && job.look in THEME) {
            const { theme } = await measure(page)
            if (theme !== THEME[job.look]) {
              errors.push(`look ${job.look} rendered data-theme="${theme}", not ${THEME[job.look]}`)
            }
          }
        } finally {
          await context.close()
        }
        if (errors.length) failures.push(`${job.board.file} (${job.look}): ${errors.join('; ')}`)
        else rendered += 1
        console.log(
          `${errors.length ? 'FAIL' : 'ok  '} ${job.board.file} ${job.look} (${shim.holes} holes, ${shim.removedHandlers.length} handlers dropped)`,
        )
      },
      (job, error) => failures.push(`${job.board.file} (${job.look}): ${error.message}`),
    )
    for (const [file, fixture] of Object.entries(POSITIVE)) {
      const { context, page, shim, errors } = await openFixture(file, fixture.look)
      try {
        if (shim.done) errors.push(...(await page.evaluate(runChecks, fixture.checks)))
      } finally {
        await context.close()
      }
      if (errors.length) failures.push(`fixture ${file}: ${errors.join('; ')}`)
      console.log(`${errors.length ? 'FAIL' : 'ok  '} fixture ${file} renders as expected`)
    }
    for (const [file, fixture] of Object.entries(NEGATIVE)) {
      const { context, errors } = await openFixture(file, fixture.look)
      await context.close()
      const caught = errors.some((error) => error.includes(fixture.expect))
      if (!caught) failures.push(`fixture ${file}: expected "${fixture.expect}", got ${errors}`)
      console.log(`${caught ? 'ok  ' : 'FAIL'} fixture ${file} fails with "${fixture.expect}"`)
    }
  } finally {
    await server.close()
  }
  console.log(
    `\nself-check: ${rendered} board renders clean, ${Object.keys(POSITIVE).length} fidelity fixtures and ${Object.keys(NEGATIVE).length} broken fixtures checked, ${failures.length} failures`,
  )
  return failures
}

async function renderAll(browser, plan, outDir) {
  const server = await startServer()
  const entries = []
  const failures = []
  try {
    const run = async (job) => {
      const { board, look, width, height } = job
      const started = Date.now()
      const { context, page, errors } = await openMockup(browser, server.origin, job)
      try {
        if (errors.length) {
          failures.push({ job, message: errors.join('; ') })
          console.log(`FAIL ${board.file} ${look} ${width}`)
          return
        }
        const measured = await measure(page)
        if (look in THEME && measured.theme !== THEME[look]) {
          failures.push({
            job,
            message: `rendered data-theme="${measured.theme}", not ${THEME[look]}`,
          })
          console.log(`FAIL ${board.file} ${look} ${width}`)
          return
        }
        const png = join(outDir, board.name, `${look}-${width}.png`)
        mkdirSync(join(outDir, board.name), { recursive: true })
        await page.screenshot({ path: png, fullPage: true, animations: 'disabled' })
        const fonts = await collectFonts(page)
        entries.push({
          board: board.name,
          file: board.file,
          title: board.title,
          look,
          lookName: LOOKS[look] ?? null,
          width,
          viewportHeight: height,
          png: relative(outDir, png),
          ...measured,
          fonts,
          ms: Date.now() - started,
        })
        const note = fonts.missing.length ? ` (fallback for ${fonts.missing.join(', ')})` : ''
        console.log(`ok   ${board.file} ${look} ${width}${note}`)
      } finally {
        await context.close()
      }
    }
    await pool(plan.jobs, CONCURRENCY, run, (job, error) => {
      failures.push({ job, message: error.message.split('\n')[0] })
      console.log(`FAIL ${job.board.file} ${job.look} ${job.width}`)
    })
  } finally {
    await server.close()
  }
  return { entries, failures }
}

const key = (e) => `${e.board}|${e.look}|${e.width}`

// An unfiltered run writes a fresh manifest; a filtered run replaces only its own entries and adds
// its skips. Entries of failed jobs are dropped. Every PNG an entry no longer points at (a failed,
// removed or renamed board) is deleted, so nothing stale passes as a reference. Only PNGs listed in
// the previous manifest are ever deleted.
function writeManifest(outDir, { entries, failures, skips, filtered }) {
  const path = join(outDir, 'manifest.json')
  let previous = { skips: [], renders: [] }
  if (existsSync(path)) previous = JSON.parse(readFileSync(path, 'utf8'))
  const failed = new Set(
    failures.map(({ job }) => key({ board: job.board.name, look: job.look, width: job.width })),
  )
  const fresh = new Set(entries.map(key))
  const kept = filtered
    ? previous.renders.filter((e) => !fresh.has(key(e)) && !failed.has(key(e)))
    : []
  const renders = [...kept, ...entries].sort((a, b) =>
    key(a).localeCompare(key(b), 'en', { numeric: true }),
  )
  const live = new Set(renders.map((e) => e.png))
  for (const stale of previous.renders) {
    const png = resolve(outDir, stale.png)
    if (!live.has(stale.png) && !relative(outDir, png).startsWith('..'))
      rmSync(png, { force: true })
  }
  const allSkips = filtered ? [...new Set([...previous.skips, ...skips])] : skips
  writeFileSync(
    path,
    `${JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), skips: allSkips, renders }, null, 2)}\n`,
  )
  return path
}

async function main() {
  const { values } = parseArgs({
    options: {
      file: { type: 'string', multiple: true },
      width: { type: 'string', multiple: true },
      look: { type: 'string', multiple: true },
      out: { type: 'string' },
      check: { type: 'boolean' },
      help: { type: 'boolean' },
    },
  })
  if (values.help) {
    console.log(USAGE)
    return 0
  }
  const widths = splitList(values.width, Number)
  const looks = splitList(values.look)
  const badLook = looks.find((look) => !(look in LOOKS) && look !== FIXED_LOOK)
  if (badLook) throw new Error(`unknown look ${badLook} (night, daylight, fixed)`)
  if (widths.some((w) => !Number.isInteger(w) || w <= 0)) throw new Error('bad --width')

  const boards = readBoards()
  const browser = await launchBrowser()
  try {
    if (values.check) {
      const failures = await selfCheck(browser, boards)
      for (const failure of failures) console.error(`error: ${failure}`)
      return failures.length ? 1 : 0
    }
    const plan = planRenders(boards, { files: splitList(values.file), widths, looks })
    if (!plan.jobs.length) throw new Error('nothing to render with these filters')
    const outDir = values.out ? resolve(values.out) : OUT_DIR
    mkdirSync(outDir, { recursive: true })
    const { entries, failures } = await renderAll(browser, plan, outDir)
    const filtered = Boolean(values.file?.length || widths.length || looks.length)
    const manifest = writeManifest(outDir, { entries, failures, skips: plan.skips, filtered })
    for (const skip of plan.skips) console.log(`skip ${skip}`)
    const counts = {}
    for (const e of entries)
      counts[`${e.look} ${e.width}`] = (counts[`${e.look} ${e.width}`] ?? 0) + 1
    console.log(`\n${entries.length} PNGs in ${shown(outDir)}:`)
    for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k}: ${n}`)
    console.log(`manifest: ${shown(manifest)}`)
    for (const { job, message } of failures) {
      console.error(`error: ${job.board.file} (${job.look}, ${job.width}): ${message}`)
    }
    return failures.length ? 1 : 0
  } finally {
    await browser.close()
  }
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`error: ${error.message}`)
    process.exit(1)
  },
)
