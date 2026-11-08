// Renders redesign/mockups/*.dc.html to reference PNGs (Night Rehearsal and Daylight at 1440, 1180
// and 390) in the ignored redesign/.renders/, with a manifest of fonts and overflow per render.
// Never writes to redesign/mockups. Exits 1 on any render error, naming the file.
//
//   node scripts/redesign/render-mockups.mjs                       # everything
//   node scripts/redesign/render-mockups.mjs --file Main --width 1440 --look daylight
//   node scripts/redesign/render-mockups.mjs --check               # self-check, no PNGs
//
// One heavy browser run per machine: hold the run's heavy lock around it. See README.md.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'
import { parseArgs } from 'node:util'
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
} from './harness.mjs'

const CONCURRENCY = 4

const USAGE = `usage: node scripts/redesign/render-mockups.mjs [options]
  --file <name>    only these mockups (Main or Main.dc.html; repeat or comma-separate)
  --width <px>     only these widths (1440, 1180, 390; fixed boards use their own width)
  --look <id>      only these looks: night, daylight, fixed (boards without a look prop)
  --out <dir>      output folder (default redesign/.renders)
  --check          self-check: every board in every look renders with no unknown tag or
                   unresolved hole, and broken fixtures fail; writes nothing
  --help`

// Self-check fixtures: each must fail with an error containing `expect`.
const FIXTURE = (body, vals = '{}', props = '{"$preview":{"width":390,"height":200}}') =>
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>fixture</title>
<script src="./support.js"></script><link rel="stylesheet" href="splitune.css"></head><body>
<x-dc><helmet><style>body{margin:0}</style></helmet>${body}</x-dc>
<script type="text/x-dc" data-dc-script data-props='${props}'>
class Component extends DCLogic { renderVals() { return ${vals} } }
</script></body></html>`

const NEGATIVE = {
  'unknown-tag.dc.html': {
    html: FIXTURE('<div class="app"><sc-each><i>{{label}}</i></sc-each></div>', '{ label: "x" }'),
    expect: 'unknown tag <sc-each>',
  },
  'unresolved-hole.dc.html': {
    html: FIXTURE('<div class="app" style="width: {{w}}px">{{label}}</div>', '{ label: "x" }'),
    expect: 'unresolved hole {{w}}',
  },
  'unresolved-item-hole.dc.html': {
    html: FIXTURE(
      '<ul class="app"><sc-for list="{{rows}}" as="r"><li>{{r.nope}}</li></sc-for></ul>',
      '{ rows: [{ name: "a" }] }',
    ),
    expect: 'unresolved hole {{r.nope}}',
  },
  'unknown-look.dc.html': {
    html: FIXTURE('<div class="app">x</div>'),
    look: 'daylight',
    expect: 'no look prop',
  },
}

// Repo-relative inside the repo, absolute elsewhere.
function shown(path) {
  const rel = relative(ROOT, path)
  return rel && !rel.startsWith('..') ? rel : path
}

async function pool(items, size, run) {
  const queue = [...items]
  await Promise.all(
    Array.from({ length: Math.min(size, queue.length) }, async () => {
      while (queue.length) await run(queue.shift())
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
  const fixtures = Object.fromEntries(Object.entries(NEGATIVE).map(([n, f]) => [n, f.html]))
  const server = await startServer({ fixtures })
  const failures = []
  let rendered = 0
  try {
    const { jobs } = planRenders(boards)
    const once = jobs.filter(
      (job, i) => jobs.findIndex((j) => j.board === job.board && j.look === job.look) === i,
    )
    await pool(once, CONCURRENCY, async (job) => {
      const { context, shim, errors } = await openMockup(browser, server.origin, {
        ...job,
        width: job.board.width,
      })
      await context.close()
      if (errors.length) failures.push(`${job.board.file} (${job.look}): ${errors.join('; ')}`)
      else rendered += 1
      console.log(
        `${errors.length ? 'FAIL' : 'ok  '} ${job.board.file} ${job.look} (${shim.holes} holes, ${shim.removedHandlers.length} handlers dropped)`,
      )
    })
    for (const [file, fixture] of Object.entries(NEGATIVE)) {
      const board = { file, width: 390 }
      const { context, errors } = await openMockup(browser, server.origin, {
        board,
        look: fixture.look ?? FIXED_LOOK,
        width: 390,
        height: 200,
        area: 't',
      })
      await context.close()
      const caught = errors.some((error) => error.includes(fixture.expect))
      if (!caught) failures.push(`fixture ${file}: expected "${fixture.expect}", got ${errors}`)
      console.log(`${caught ? 'ok  ' : 'FAIL'} fixture ${file} fails with "${fixture.expect}"`)
    }
  } finally {
    await server.close()
  }
  console.log(
    `\nself-check: ${rendered} board renders clean, ${Object.keys(NEGATIVE).length} broken fixtures checked, ${failures.length} failures`,
  )
  return failures
}

async function renderAll(browser, plan, outDir) {
  const server = await startServer()
  const entries = []
  const failures = []
  try {
    await pool(plan.jobs, CONCURRENCY, async (job) => {
      const { board, look, width, height } = job
      const started = Date.now()
      const { context, page, errors } = await openMockup(browser, server.origin, job)
      try {
        if (errors.length) {
          failures.push(`${board.file} (${look}, ${width}): ${errors.join('; ')}`)
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
          ...(await measure(page)),
          fonts,
          ms: Date.now() - started,
        })
        const note = fonts.missing.length ? ` (fallback for ${fonts.missing.join(', ')})` : ''
        console.log(`ok   ${board.file} ${look} ${width}${note}`)
      } finally {
        await context.close()
      }
    })
  } finally {
    await server.close()
  }
  return { entries, failures }
}

// A filtered run updates only its own entries in an existing manifest.
function writeManifest(outDir, entries, skips) {
  const path = join(outDir, 'manifest.json')
  let previous = []
  try {
    previous = JSON.parse(readFileSync(path, 'utf8')).renders ?? []
  } catch {
    previous = []
  }
  const key = (e) => `${e.board}|${e.look}|${e.width}`
  const fresh = new Set(entries.map(key))
  const renders = [...previous.filter((e) => !fresh.has(key(e))), ...entries].sort((a, b) =>
    key(a).localeCompare(key(b), 'en', { numeric: true }),
  )
  writeFileSync(
    path,
    `${JSON.stringify({ schema: 1, generatedAt: new Date().toISOString(), skips, renders }, null, 2)}\n`,
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
    const manifest = writeManifest(outDir, entries, plan.skips)
    for (const skip of plan.skips) console.log(`skip ${skip}`)
    const counts = {}
    for (const e of entries)
      counts[`${e.look} ${e.width}`] = (counts[`${e.look} ${e.width}`] ?? 0) + 1
    console.log(`\n${entries.length} PNGs in ${shown(outDir)}:`)
    for (const [k, n] of Object.entries(counts).sort()) console.log(`  ${k}: ${n}`)
    console.log(`manifest: ${shown(manifest)}`)
    for (const failure of failures) console.error(`error: ${failure}`)
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
