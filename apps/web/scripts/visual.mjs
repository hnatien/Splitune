// Visual regression (28 §4): `node scripts/visual.mjs --image <playwright image> [--update]
// [--no-build] [playwright args…]`. Builds Storybook, starts a Playwright server inside the pinned
// Linux image (so every machine renders the same pixels), and runs playwright.visual.config.ts
// against it; the browsers reach the static Storybook on this machine through Playwright's
// loopback tunnel. PW_VISUAL_WS_ENDPOINT skips the container (a server already running).
import { execFileSync, spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startPlaywrightServer, takeImage } from './playwright-server.mjs'

const WEB = fileURLToPath(new URL('..', import.meta.url))
const PORT = 3334

const args = process.argv.slice(2)
const take = (flag) => {
  const i = args.indexOf(flag)
  if (i < 0) return false
  args.splice(i, 1)
  return true
}
const image = takeImage(args)
const update = take('--update')
const build = !take('--no-build')

let endpoint = process.env.PW_VISUAL_WS_ENDPOINT
let server

let code = 1
try {
  if (build) execFileSync('pnpm', ['run', 'storybook:build'], { cwd: WEB, stdio: 'inherit' })
  if (!endpoint) {
    server = await startPlaywrightServer({ image, prefix: 'splitune-visual', port: PORT })
    endpoint = server.endpoint
  }
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
  server?.stop()
}
process.exit(code)
