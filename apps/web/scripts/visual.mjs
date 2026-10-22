// Visual regression (28 §4): `node scripts/visual.mjs --image <playwright image> [--update]
// [--no-build] [playwright args…]`. Builds Storybook, starts a Playwright server inside the pinned
// Linux image (so every machine renders the same pixels), and runs playwright.visual.config.ts
// against it; the browsers reach the static Storybook on this machine through Playwright's
// loopback tunnel. PW_VISUAL_WS_ENDPOINT skips the container (a server already running).
import { execFileSync, spawn, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const PORT = 3334

const args = process.argv.slice(2)
const take = (flag) => {
  const i = args.indexOf(flag)
  if (i < 0) return false
  args.splice(i, 1)
  return true
}
const imageAt = args.indexOf('--image')
const image = imageAt >= 0 ? args.splice(imageAt, 2)[1] : undefined
const update = take('--update')
const build = !take('--no-build')

const version = JSON.parse(
  readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'),
).version
let endpoint = process.env.PW_VISUAL_WS_ENDPOINT
let container

function stop() {
  if (container) spawnSync('docker', ['stop', container], { stdio: 'ignore' })
}

async function startServer() {
  if (!image) throw new Error('--image <mcr.microsoft.com/playwright:vX.Y.Z-noble> is required')
  // The server and the test runner must be the same Playwright release.
  if (!image.includes(`:v${version}-`)) {
    throw new Error(`${image} does not match @playwright/test ${version}`)
  }
  container = `splitune-visual-${process.pid}`
  execFileSync('docker', [
    'run',
    '-d',
    '--rm',
    '--init',
    // One architecture everywhere (CI runners are amd64): anti-aliasing may differ between builds.
    '--platform',
    'linux/amd64',
    '--name',
    container,
    '-p',
    `127.0.0.1:${PORT}:${PORT}`,
    image,
    'sh',
    '-c',
    `cd /tmp && npx -y playwright@${version} run-server --port ${PORT} --host 0.0.0.0`,
  ])
  const until = Date.now() + 180_000
  while (Date.now() < until) {
    const logs = spawnSync('docker', ['logs', container], { encoding: 'utf8' })
    if (`${logs.stdout}${logs.stderr}`.includes('Listening on')) return `ws://127.0.0.1:${PORT}/`
    if (logs.status !== 0) throw new Error(`Playwright server container exited:\n${logs.stderr}`)
    await new Promise((resolve) => setTimeout(resolve, 500))
  }
  throw new Error('Playwright server did not start within 3 minutes')
}

let code = 1
try {
  if (build) execFileSync('pnpm', ['run', 'storybook:build'], { cwd: WEB, stdio: 'inherit' })
  endpoint ??= await startServer()
  code = await new Promise((resolve) => {
    const run = spawn(
      'pnpm',
      [
        'exec',
        'playwright',
        'test',
        '-c',
        'playwright.visual.config.ts',
        ...(update ? ['--update-snapshots'] : []),
        ...args,
      ],
      { cwd: WEB, stdio: 'inherit', env: { ...process.env, PW_VISUAL_WS_ENDPOINT: endpoint } },
    )
    run.on('exit', (status) => resolve(status ?? 1))
  })
} finally {
  stop()
}
process.exit(code)
