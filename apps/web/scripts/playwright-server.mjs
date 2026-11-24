// A Playwright server inside the pinned Linux image, for runs whose browsers must not be this
// machine's own: the visual suite (the same pixels everywhere, scripts/visual.mjs) and the WebKit
// stories where the local build has no Web Audio (scripts/stories.mjs). The browsers reach servers
// on this machine through Playwright's loopback tunnel (`exposeNetwork: '<loopback>'`).
import { execFileSync, spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const SERVER_PORT = 3333

export const playwrightVersion = JSON.parse(
  readFileSync(new URL('../node_modules/@playwright/test/package.json', import.meta.url), 'utf8'),
).version

/** Removes `--image <image>` from `args` and returns the image, if it was there. */
export function takeImage(args) {
  const at = args.indexOf('--image')
  return at >= 0 ? args.splice(at, 2)[1] : undefined
}

function alive(pid) {
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

// A run that was killed could not stop its container: stop the ones whose runner is gone, so they
// neither pile up nor hold a fixed port.
function stopOrphans(prefix) {
  const listed = spawnSync(
    'docker',
    ['ps', '--filter', `name=^${prefix}-`, '--format', '{{.Names}}'],
    {
      encoding: 'utf8',
    },
  )
  for (const name of (listed.stdout ?? '').split('\n').filter(Boolean)) {
    const pid = Number(name.slice(prefix.length + 1))
    if (Number.isInteger(pid) && !alive(pid))
      spawnSync('docker', ['stop', name], { stdio: 'ignore' })
  }
}

// The container has no sound device. Chromium and WebKit fall back to a silent one of their own;
// Firefox's AudioContext never starts without an output, so `audio` gives it a PulseAudio null
// sink, as CI does (18, step 12 notes).
const NULL_SINK = [
  'apt-get update -qq',
  'apt-get install -y -qq --no-install-recommends pulseaudio',
  'pulseaudio --start --exit-idle-time=-1',
  'pactl load-module module-null-sink sink_name=null',
  'pactl set-default-sink null',
].join(' && ')

/**
 * Starts the server and resolves to its endpoint and a `stop()`. `prefix` names the container
 * (`<prefix>-<pid>`); `port` fixes the port on this machine, and without it Docker picks a free
 * one, so runs in several worktrees do not collide; `audio` adds a silent sound device.
 */
export async function startPlaywrightServer({ image, prefix, port, audio = false }) {
  if (!image) throw new Error('--image <mcr.microsoft.com/playwright:vX.Y.Z-noble> is required')
  // The server and the test runner must be the same Playwright release.
  if (!image.includes(`:v${playwrightVersion}-`)) {
    throw new Error(`${image} does not match @playwright/test ${playwrightVersion}`)
  }
  stopOrphans(prefix)
  const container = `${prefix}-${process.pid}`
  const stop = () => {
    spawnSync('docker', ['stop', container], { stdio: 'ignore' })
  }
  execFileSync('docker', [
    'run',
    '-d',
    '--rm',
    '--init',
    // One architecture everywhere (CI runners are amd64): anti-aliasing may differ between builds.
    '--platform',
    'linux/amd64',
    // No core dumps. Under Docker Desktop on Windows the kernel pipes a crashed process to WSL's
    // crash capture, which writes the whole process to %TEMP%\wsl-crashes: WebKit's content
    // process dying six times left 44 GB there and filled the disk. The kernel skips a piped
    // handler only at a limit of exactly 1 byte (0, Docker's default, still dumps).
    '--ulimit',
    'core=1',
    '--name',
    container,
    '-p',
    `127.0.0.1:${port ?? ''}:${SERVER_PORT}`,
    image,
    'sh',
    '-c',
    `${audio ? `${NULL_SINK} >/dev/null 2>&1 && ` : ''}cd /tmp && npx -y playwright@${playwrightVersion} run-server --port ${SERVER_PORT} --host 0.0.0.0`,
  ])
  try {
    const until = Date.now() + 180_000
    while (Date.now() < until) {
      const logs = spawnSync('docker', ['logs', container], { encoding: 'utf8' })
      if (logs.status !== 0) throw new Error(`Playwright server container exited:\n${logs.stderr}`)
      if (`${logs.stdout}${logs.stderr}`.includes('Listening on')) {
        const mapped = execFileSync('docker', ['port', container, `${SERVER_PORT}/tcp`], {
          encoding: 'utf8',
        })
        return { endpoint: `ws://127.0.0.1:${mapped.trim().split(':').pop()}/`, stop }
      }
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
    throw new Error('Playwright server did not start within 3 minutes')
  } catch (error) {
    stop()
    throw error
  }
}
