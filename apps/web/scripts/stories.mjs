// Story tests (28 §2): `node scripts/stories.mjs --image <playwright image> [vitest args…]` runs
// the stories in Chromium, then in WebKit; `--project=storybook` or `--project=storybook-webkit`
// picks one of them, and the other arguments (story files, `-t`, reporters) go to Vitest.
//
// Playwright's WebKit build for Windows has no Web Audio, so the practice stories cannot play in
// it. Where the local build cannot play, WebKit runs in a Playwright server inside the pinned
// Linux image instead (PW_WEBKIT_WS_ENDPOINT skips the check and the container: a server already
// running). That build's content process dies at random once one page has run a hundred or more
// practice-screen stories (SIGSEGV at one address in libWPEWebKit, or SIGABRT; not memory, open
// files, the missing sound device or how the engine closes its context: all four were ruled out).
// A file on its own page seldom gets that far, so there each story file is its own run, and a
// run whose page crashed gave no verdict and is started again, three attempts in all. A story
// that fails is a failure and is never run again.
import { spawn } from 'node:child_process'
import { globSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { startPlaywrightServer, takeImage } from './playwright-server.mjs'
import { localWebKitPlays } from './stories-webkit.mjs'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const ATTEMPTS = 3
const CRASH = 'page crashed while running tests'
// Where .storybook/main.ts finds stories.
const STORIES = ['app/**/*.stories.tsx', '.storybook/*.stories.tsx']
// The reporter's colour codes.
const COLOUR = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g')
// Vitest flags whose value is the next argument, so it is not taken for a story file.
const VALUE_FLAGS = ['-t', '--testNamePattern', '--reporter', '--outputFile']

const args = process.argv.slice(2)
const image = takeImage(args)
const named = []
const flags = []
const filters = []
for (let i = 0; i < args.length; i++) {
  const arg = args[i]
  if (arg === '--project') named.push(args[++i] ?? '')
  else if (arg.startsWith('--project=')) named.push(arg.slice('--project='.length))
  else if (VALUE_FLAGS.includes(arg)) flags.push(arg, args[++i] ?? '')
  else if (arg.startsWith('-')) flags.push(arg)
  else filters.push(arg)
}
const both = named.length === 0 || named.some((name) => name.includes('*'))
const webkit = both || named.some((name) => name.includes('webkit'))
const chromium = both || named.some((name) => !name.includes('webkit'))

let server
const stop = () => {
  server?.stop()
  server = undefined
}
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop()
    process.exit(1)
  })
}

/** Runs one project; resolves to its exit code, whether its page crashed and its test counts. */
function run(project, files, env = {}) {
  return new Promise((resolve) => {
    const child = spawn(
      'pnpm',
      ['exec', 'vitest', 'run', `--project=${project}`, ...flags, ...files],
      {
        cwd: WEB,
        stdio: ['inherit', 'pipe', 'pipe'],
        env: { ...process.env, ...(process.stdout.isTTY ? { FORCE_COLOR: '1' } : {}), ...env },
      },
    )
    let output = ''
    for (const [from, to] of [
      [child.stdout, process.stdout],
      [child.stderr, process.stderr],
    ]) {
      from.on('data', (chunk) => {
        output += chunk
        to.write(chunk)
      })
    }
    child.on('exit', (status) => {
      const summary = output.replace(COLOUR, '').match(/^\s*Tests\s+(.*)$/m)?.[1] ?? ''
      const count = (word) => Number(summary.match(new RegExp(`(\\d+) ${word}`))?.[1] ?? 0)
      resolve({
        code: status ?? 1,
        crashed: output.includes(CRASH),
        passed: count('passed'),
        failed: count('failed'),
      })
    })
  })
}

async function startServer() {
  try {
    server = await startPlaywrightServer({ image, prefix: 'splitune-stories' })
  } catch (error) {
    throw new Error(
      'The WebKit stories need Docker on this machine and its server did not start.',
      {
        cause: error,
      },
    )
  }
}

/** WebKit in the Linux image: a run for each story file, a crashed run started again. */
async function inLinuxImage() {
  const files = globSync(STORIES, { cwd: WEB })
    .map((file) => file.replaceAll('\\', '/'))
    .filter((file) => filters.length === 0 || filters.some((filter) => file.includes(filter)))
    .sort()
  if (files.length === 0) {
    console.error(`No story file matches ${filters.join(', ')}.`)
    return 1
  }
  console.log(
    `This machine's WebKit has no Web Audio: running ${files.length} story files in WebKit in the Linux Playwright image, one run each.`,
  )
  const total = { passed: 0, failed: 0 }
  const unfinished = []
  const errored = []
  for (const file of files) {
    for (let attempt = 1; ; attempt++) {
      if (!server) await startServer()
      const result = await run('storybook-webkit', [file], {
        PW_WEBKIT_WS_ENDPOINT: server.endpoint,
      })
      if (!result.crashed) {
        total.passed += result.passed
        total.failed += result.failed
        // Vitest also fails a run for an error thrown outside any story.
        if (result.code !== 0 && result.failed === 0) errored.push(file)
        break
      }
      // A server whose browser died is not used again.
      stop()
      if (attempt === ATTEMPTS) {
        unfinished.push(file)
        break
      }
      console.log(
        `WebKit's page crashed in ${file}, which leaves its stories without a result: running it again (attempt ${attempt + 1} of ${ATTEMPTS}).`,
      )
    }
  }
  stop()
  console.log(
    [
      `\nWebKit stories: ${total.passed} passed, ${total.failed} failed in ${files.length} files.`,
      ...(errored.length > 0 ? [`Errors outside a story in: ${errored.join(', ')}.`] : []),
      ...(unfinished.length > 0 ? [`Without a result: ${unfinished.join(', ')}.`] : []),
    ].join(' '),
  )
  return total.failed + errored.length + unfinished.length > 0 ? 1 : 0
}

let code = 0
try {
  if (chromium) code = (await run('storybook', filters)).code
  if (webkit) {
    // WebKit runs whatever Chromium's verdict was.
    const local = process.env.PW_WEBKIT_WS_ENDPOINT || (await localWebKitPlays())
    const webkitCode = local ? (await run('storybook-webkit', filters)).code : await inLinuxImage()
    code ||= webkitCode
  }
} catch (error) {
  stop()
  throw error
}
process.exit(code)
