// E2E for the engines this machine cannot run itself: `node scripts/e2e-linux.mjs --image
// <playwright image> [playwright args…]`, e.g. `--project firefox --project webkit`. Firefox
// doesn't start on macOS 27 and Playwright's WebKit for Windows has no Web Audio, so both run in
// a Playwright server inside the pinned Linux image, with a silent sound device for Firefox, and
// reach the app on this machine through Playwright's loopback tunnel (playwright.config.ts).
// Projects that are not Firefox or WebKit still use this machine's own browsers.
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { startPlaywrightServer, takeImage } from './playwright-server.mjs'

const WEB = fileURLToPath(new URL('..', import.meta.url))

const args = process.argv.slice(2)
const image = takeImage(args)

let server
const stop = () => server?.stop()
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    stop()
    process.exit(1)
  })
}

let code = 1
try {
  server = await startPlaywrightServer({ image, prefix: 'splitune-e2e', audio: true })
  code = await new Promise((resolve) => {
    const run = spawn('pnpm', ['exec', 'playwright', 'test', ...args], {
      cwd: WEB,
      stdio: 'inherit',
      env: {
        PW_FIREFOX_WS_ENDPOINT: server.endpoint,
        PW_WEBKIT_WS_ENDPOINT: server.endpoint,
        ...process.env,
      },
    })
    run.on('exit', (status) => resolve(status ?? 1))
  })
} finally {
  stop()
}
process.exit(code)
