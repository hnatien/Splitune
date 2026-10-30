// `pnpm dev:all`: the local stack (docker compose, then migrations), then web, node-worker and
// ml-worker, in one dashboard with the Splitune mark, live status and logs. Without a terminal
// (piped, CI) it prints prefixed log lines instead. Stopping sends one SIGINT to each pnpm, which
// passes it on, so workers finish their running job first; a second q or Ctrl-C kills every process
// group outright. Windows has neither, so there stopping kills each process tree at once.
//
// `pnpm workers:prod` (--prod-workers): the same dashboard for a machine's production workers in
// the foreground, e.g. a Windows PC without launchd (25-personal-mode.md §6). Only the two workers,
// both reading .env.worker; .env is never loaded, because inherited variables win over an env file
// in both workers and would point them at the local stack.
//
// Split development across two machines, the stack on either one: `pnpm dev:web` (--web-only) runs
// the stack and web, and `pnpm dev:remote-workers <user@host>` on the other machine opens an SSH
// tunnel to that stack and runs the dev workers through it; or `pnpm dev:stack-workers`
// (--stack-workers) runs the stack and workers, and `pnpm dev:remote-stack <user@host>` on the
// machine you code on runs web through a tunnel to it. All on .env as in dev:all: the tunnel keeps
// the same port numbers, so .env needs no change (S3 signs the host and port) and the stack stays
// bound to 127.0.0.1.
import { execFile, execFileSync, spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { connect } from 'node:net'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { createInterface } from 'node:readline'
import { fileURLToPath } from 'node:url'
import { createTheme, parseLogLine, redrawsBar, renderFrame, visibleLogs } from './dev/render.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const prodWorkers = process.argv.includes('--prod-workers')
const webOnly = process.argv.includes('--web-only')
const stackWorkers = process.argv.includes('--stack-workers')
const remoteMode = ['--remote-workers', '--remote-stack'].find((flag) =>
  process.argv.includes(flag),
)
const remoteHost = remoteMode && process.argv[process.argv.indexOf(remoteMode) + 1]
if (remoteMode && !remoteHost) {
  throw new Error(
    `usage: pnpm dev:${remoteMode.slice(2)} <user@host of the machine running the stack>`,
  )
}
const WORKER_ENV_FILE = join(root, '.env.worker')
if (prodWorkers) {
  if (!existsSync(WORKER_ENV_FILE)) {
    throw new Error('.env.worker is missing: copy .env.worker.example and fill it in first')
  }
} else if (existsSync(join(root, '.env'))) {
  process.loadEnvFile(join(root, '.env'))
}
const MAX_LOG_LINES = 5000
const FRAME_MS = 100
// Postgres, S3 and Mailpit, forwarded to the same ports on the remote host's 127.0.0.1.
const TUNNEL_PORTS = [5432, 8333, 1025]
const TUNNEL_TIMEOUT_MS = 30_000

const PROD_WORKERS = [
  {
    id: 'node-worker',
    label: 'node-worker',
    command: ['pnpm', '--silent', '--filter', '@splitune/node-worker', 'run', 'start'],
    ready: /^worker started\b/,
  },
  {
    id: 'ml-worker',
    label: 'ml-worker',
    command: ['pnpm', '--silent', '--filter', '@splitune/ml', 'run', 'ml-worker'],
    // What the Mac's launchd agent sets (services/ml/deploy).
    env: { ML_MODE: 'local', SPLITUNE_ENV_FILE: WORKER_ENV_FILE },
    ready: /^worker started\b/,
  },
]

const SERVICES = [
  {
    id: 'stack',
    label: 'stack',
    kind: 'task',
    // --wait: migrations need Postgres healthy. Migrating here keeps the local schema in step with
    // the workers, which otherwise log failed claims against tables that don't exist yet.
    commands: [
      ['docker', 'compose', '-f', 'infra/docker-compose.yml', 'up', '-d', '--wait'],
      ['pnpm', '--silent', 'db:migrate'],
    ],
    readyDetail: 'postgres :5432 · s3 :8333 · mailpit :8025',
  },
  {
    id: 'web',
    label: 'web',
    command: ['pnpm', '--silent', '--filter', '@splitune/web', 'run', 'dev'],
    ready: /Local:\s+(\S+)/,
  },
  {
    id: 'node-worker',
    label: 'node-worker',
    command: ['pnpm', '--silent', '--filter', '@splitune/node-worker', 'run', 'dev'],
    ready: /^worker started\b/,
  },
  {
    id: 'ml-worker',
    label: 'ml-worker',
    command: ['pnpm', '--silent', '--filter', '@splitune/ml', 'run', 'ml-worker'],
    ready: /^worker started\b/,
  },
]

// BatchMode: fail at once instead of waiting for a password or host-key prompt nobody can answer.
// ExitOnForwardFailure: a port already taken here ends ssh rather than leaving a half tunnel.
const TUNNEL = {
  id: 'tunnel',
  label: 'tunnel',
  kind: 'tunnel',
  command: [
    'ssh',
    '-N',
    '-o',
    'BatchMode=yes',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ServerAliveInterval=15',
    '-o',
    'ServerAliveCountMax=3',
    ...TUNNEL_PORTS.flatMap((port) => ['-L', `${port}:127.0.0.1:${port}`]),
    remoteHost,
  ],
  readyDetail: `${remoteHost} · postgres :5432 · s3 :8333 · mailpit :1025`,
}

function selectedServices() {
  const [stack, web, ...workers] = SERVICES
  if (prodWorkers) return PROD_WORKERS
  if (remoteMode === '--remote-workers') return [TUNNEL, ...workers]
  if (remoteMode === '--remote-stack') return [TUNNEL, web]
  if (webOnly) return [stack, web]
  if (stackWorkers) return [stack, ...workers]
  return SERVICES
}

function modeName() {
  if (prodWorkers) return 'PRODUCTION workers'
  if (remoteMode === '--remote-workers') return `local dev · workers for ${remoteHost}`
  if (remoteMode === '--remote-stack') return `local dev · web on ${remoteHost}'s stack`
  if (webOnly) return 'local dev · web only'
  if (stackWorkers) return 'local dev · stack and workers'
  return 'local dev'
}

function gitBranch() {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
    }).trim()
  } catch {
    return undefined
  }
}

const state = {
  services: selectedServices().map((def) => ({
    ...def,
    status: 'pending',
    detail: undefined,
    pid: undefined,
    startedAt: undefined,
    exitCode: undefined,
  })),
  logs: [],
  focus: null,
  scroll: 0,
  tick: 0,
  now: Date.now(),
  quitting: false,
  logHeight: 0,
  mode: modeName(),
  branch: gitBranch(),
  cwd: root.startsWith(homedir()) ? `~${root.slice(homedir().length)}` : root,
}
const children = new Map()
const interactive = process.stdout.isTTY && process.stdin.isTTY
// Piped output only: each service's latest progress bar, or undefined after any other line.
const lastProgress = new Map()

function log(serviceId, raw) {
  const parsed = parseLogLine(raw, { root })
  if (!parsed?.text) return
  const { level, text, detail, progress } = parsed
  const service = state.services.find((s) => s.id === serviceId)
  if (service.ready && service.status === 'starting') {
    const match = service.ready.exec(text)
    if (match) {
      service.status = 'ready'
      service.detail = match[1]
    }
  }
  // Web and the tunnel keep their own detail; the workers show what they did last.
  if (!service.kind && service.id !== 'web' && service.status === 'ready') service.detail = text
  const lines = [text, ...detail.map((line) => `  ${line}`)]
  if (interactive) {
    // A progress bar redraws in place while it is still the service's latest line; a finished bar
    // stays, so the next one starts a line of its own.
    const previous = progress && state.logs.findLast((entry) => entry.service === serviceId)
    if (redrawsBar(previous?.progress, progress)) {
      Object.assign(previous, { level, text, progress })
      return
    }
    for (const line of lines) state.logs.push({ service: serviceId, level, text: line, progress })
    if (state.logs.length > MAX_LOG_LINES) state.logs.splice(0, state.logs.length - MAX_LOG_LINES)
    // Keep a scrolled view anchored on the same lines while new ones arrive.
    if (state.scroll > 0 && (!state.focus || state.focus === serviceId))
      state.scroll += lines.length
  } else {
    // Piped output can't redraw, so a bar prints once, when it finishes.
    const previous = lastProgress.get(serviceId)
    lastProgress.set(serviceId, progress)
    const repeat = previous?.percent === 100 && redrawsBar(previous, progress)
    if (progress && (progress.percent < 100 || repeat)) return
    for (const line of lines) process.stdout.write(`${serviceId.padEnd(12)}│ ${line}\n`)
  }
}

async function start(service) {
  service.status = 'starting'
  service.detail = undefined
  service.exitCode = undefined
  service.startedAt = Date.now()
  if (service.kind === 'tunnel') return openTunnel(service)
  if (!service.commands) return run(service, service.command)
  // A task's commands run in order and stop at the first failure.
  for (const command of service.commands) {
    if (state.quitting || !(await run(service, command))) return false
  }
  service.status = 'ready'
  service.detail = service.readyDetail
  return true
}

function accepts(port) {
  return new Promise((resolve) => {
    const socket = connect({ host: '127.0.0.1', port, timeout: 1000 })
    const done = (open) => {
      socket.destroy()
      resolve(open)
    }
    socket.once('connect', () => done(true))
    socket.once('error', () => done(false))
    socket.once('timeout', () => done(false))
  })
}

const allAccept = async () => (await Promise.all(TUNNEL_PORTS.map(accepts))).every(Boolean)

// ssh only listens on the forwarded ports once it has signed in, so the tunnel is up when all of them
// accept; ports taken before it starts would make that check pass against something else.
async function openTunnel(service) {
  const taken = []
  for (const port of TUNNEL_PORTS) if (await accepts(port)) taken.push(port)
  if (taken.length > 0) {
    log(service.id, `port ${taken.join(', ')} already in use here: stop the local stack first`)
    log(service.id, '(docker compose -f infra/docker-compose.yml stop)')
    service.status = 'failed'
    return false
  }
  const exited = run(service, service.command)
  const deadline = Date.now() + TUNNEL_TIMEOUT_MS
  while (children.has(service.id) && Date.now() < deadline) {
    if (await allAccept()) {
      service.status = 'ready'
      service.detail = service.readyDetail
      return true
    }
    await new Promise((resolve) => setTimeout(resolve, 250))
  }
  if (children.has(service.id)) {
    log(service.id, `no tunnel after ${TUNNEL_TIMEOUT_MS / 1000} s; is the remote stack up?`)
    signal(service, 'SIGTERM')
    await exited
    service.status = 'failed'
  }
  return false
}

function run(service, [command, ...args]) {
  // detached: its own process group, so a forced quit can kill pnpm and everything it started. Not
  // on Windows, where it leaves pnpm without a console and each cmd.exe under it opens a window;
  // windowsHide gives the tree one hidden console instead (taskkill needs no group).
  const child = spawn(command, args, {
    cwd: root,
    detached: process.platform !== 'win32',
    windowsHide: true,
    env: { ...process.env, ...service.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  service.pid = child.pid
  children.set(service.id, child)
  for (const stream of [child.stdout, child.stderr])
    createInterface({ input: stream }).on('line', (line) => log(service.id, line))
  return new Promise((resolve) => {
    child.on('error', (error) => {
      log(service.id, `${error.message}`)
      service.status = 'failed'
      children.delete(service.id)
      resolve(false)
    })
    child.on('exit', (code, signal) => {
      children.delete(service.id)
      service.pid = undefined
      service.exitCode = code ?? signal
      // A task step that succeeded stays starting: start() marks the task ready after its last one.
      if (service.kind !== 'task' || code !== 0) {
        // While quitting, a child may exit before stop() marks it (a console Ctrl-C reaches it too).
        const stopping = service.status === 'stopping' || state.quitting
        service.status = code === 0 || stopping ? 'stopped' : 'failed'
      }
      resolve(code === 0)
    })
  })
}

// SIGINT goes to pnpm alone: pnpm and uv each forward it, so signalling the whole group would reach
// the ML worker twice, and its second-signal handler exits at once without finishing the job.
// On Windows process.kill terminates pnpm alone and orphans the worker under it, so taskkill ends
// the whole tree instead; a job it interrupts is reclaimed once its heartbeat goes stale.
function signal(service, name, { group = false } = {}) {
  const child = children.get(service.id)
  if (!child?.pid) return
  if (process.platform === 'win32') {
    execFile('taskkill', ['/pid', String(child.pid), '/t', '/f'], () => {})
    return
  }
  try {
    process.kill(group ? -child.pid : child.pid, name)
  } catch (error) {
    if (error.code !== 'ESRCH') throw error
  }
}

function stop(service) {
  const child = children.get(service.id)
  if (!child) return Promise.resolve()
  service.status = 'stopping'
  const exited = new Promise((resolve) => child.once('exit', resolve))
  signal(service, 'SIGINT')
  return exited
}

// Runs the stack or opens the tunnel (if any), then starts whichever services aren't already up
// (all of them the first time).
async function startAll() {
  const stack = state.services.find((s) => s.kind === 'task' || s.kind === 'tunnel')
  const apps = state.services.filter((s) => s !== stack)
  for (const service of apps) if (!children.has(service.id)) service.detail = undefined
  if (stack && !children.has(stack.id) && !(await start(stack))) {
    for (const service of apps)
      if (!children.has(service.id)) service.detail = `${stack.label} did not start; see its log`
    return
  }
  if (state.quitting) return
  for (const service of apps) if (!children.has(service.id)) start(service)
}

// One restart at a time, so a repeated r doesn't signal pnpm twice or run the stack twice.
let restarting = false
async function restart(service) {
  if (state.quitting || restarting) return
  restarting = true
  if (service) await stop(service)
  else await Promise.all(state.services.map(stop))
  restarting = false
  if (state.quitting) return
  if (!service || service.kind === 'task') startAll()
  else start(service)
}

let forced = false
async function quit() {
  if (state.quitting) {
    forced = true
    for (const service of state.services) signal(service, 'SIGKILL', { group: true })
    return
  }
  state.quitting = true
  await Promise.all(state.services.map(stop))
  finish()
}

// Dashboard
let lastFrame = ''
let timer
const theme = createTheme(interactive ? process.stdout.getColorDepth() : 1)

function draw() {
  state.tick++
  state.now = Date.now()
  const { lines, logHeight } = renderFrame(state, {
    cols: process.stdout.columns || 80,
    rows: process.stdout.rows || 24,
    theme,
  })
  state.logHeight = logHeight
  const frame = lines.map((line) => `${line}\x1b[K`).join('\r\n')
  if (frame === lastFrame) return
  lastFrame = frame
  process.stdout.write(`\x1b[H${frame}\x1b[J`)
}

function restoreTerminal() {
  if (!interactive) return
  clearInterval(timer)
  process.stdin.setRawMode(false)
  process.stdout.write('\x1b[?25h\x1b[?1049l')
}

function finish() {
  restoreTerminal()
  // The alternate screen is gone: repeat anything that failed so its error isn't lost.
  for (const service of state.services) {
    if (service.status !== 'failed') continue
    process.stderr.write(`\n${service.label} exited ${service.exitCode ?? ''}; last lines:\n`)
    for (const entry of state.logs.filter((e) => e.service === service.id).slice(-15))
      process.stderr.write(`  ${entry.text}\n`)
  }
  const failed = state.services.some((s) => s.status === 'failed')
  process.exit(forced || failed ? 1 : 0)
}

function onKey(key) {
  const logHeight = Math.max(1, state.logHeight)
  if (key === '\x03' || key === 'q') {
    quit()
  } else if (key === '\x1b[D' || key === 'h' || key === '\x1b[C' || key === 'l') {
    // Tabs run all, then each service, wrapping at both ends.
    const tabs = [null, ...state.services.map((s) => s.id)]
    const step = key === '\x1b[D' || key === 'h' ? -1 : 1
    state.focus = tabs[(tabs.indexOf(state.focus) + step + tabs.length) % tabs.length]
    state.scroll = 0
  } else if (key === 'r') {
    // The all tab restarts everything; a service's tab restarts just that service.
    restart(state.services.find((s) => s.id === state.focus))
  } else if (key === '\x1b[A' || key === 'k') {
    state.scroll = Math.min(state.scroll + 1, visibleLogs(state, logHeight).maxScroll)
  } else if (key === '\x1b[B' || key === 'j') {
    state.scroll = Math.max(0, state.scroll - 1)
  } else if (key === '\x1b[5~') {
    state.scroll = Math.min(state.scroll + logHeight, visibleLogs(state, logHeight).maxScroll)
  } else if (key === '\x1b[6~') {
    state.scroll = Math.max(0, state.scroll - logHeight)
  } else if (key === '\x1b[F' || key === '\x1b[4~' || key === 'G') {
    state.scroll = 0
  }
  draw()
}

if (interactive) {
  process.stdout.write('\x1b[?1049h\x1b[?25l')
  process.stdin.setRawMode(true)
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', onKey)
  process.stdout.on('resize', () => {
    lastFrame = ''
    draw()
  })
  process.on('uncaughtException', (error) => {
    restoreTerminal()
    for (const service of state.services) signal(service, 'SIGINT')
    process.stderr.write(`${error.stack}\n`)
    process.exit(1)
  })
  timer = setInterval(draw, FRAME_MS)
  draw()
}
for (const signal of ['SIGINT', 'SIGTERM', 'SIGHUP']) process.on(signal, quit)

startAll()
