// `pnpm workers <install|restart|status|uninstall>`: the Mac's production workers (node-worker and
// ml-worker) as launchd agents of the signed-in user (25-personal-mode.md §6): started at login,
// restarted on crash, logging to ~/Library/Logs/Splitune/. Both read .env.worker only, so they are
// the only processes on the Mac that reach production.
import { execFileSync, spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { homedir, userInfo } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { renderPlist } from './workers/plist.mjs'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const home = homedir()
const AGENTS_DIR = join(home, 'Library/LaunchAgents')
const LOGS_DIR = join(home, 'Library/Logs/Splitune')
const ENV_FILE = join(root, '.env.worker')
const DOMAIN = `gui/${userInfo().uid}`
const AGENTS = [
  { label: 'com.splitune.node-worker', template: 'apps/node-worker/deploy' },
  { label: 'com.splitune.ml-worker', template: 'services/ml/deploy' },
]

const plistPath = (label) => join(AGENTS_DIR, `${label}.plist`)
const loaded = (label) =>
  spawnSync('launchctl', ['print', `${DOMAIN}/${label}`], { stdio: 'ignore' }).status === 0
const launchctl = (...args) => execFileSync('launchctl', args, { stdio: 'inherit' })

function install() {
  if (!existsSync(ENV_FILE)) {
    throw new Error('.env.worker is missing: copy .env.worker.example and fill it in first')
  }
  if ((statSync(ENV_FILE).mode & 0o077) !== 0) {
    throw new Error('.env.worker is readable by other users: run `chmod 600 .env.worker`')
  }
  mkdirSync(AGENTS_DIR, { recursive: true })
  mkdirSync(LOGS_DIR, { recursive: true })
  for (const { label, template } of AGENTS) {
    const source = readFileSync(join(root, template, `${label}.plist`), 'utf8')
    const plist = renderPlist(source, { REPO: root, USER_HOME: home, NODE: process.execPath })
    if (loaded(label)) launchctl('bootout', `${DOMAIN}/${label}`)
    writeFileSync(plistPath(label), plist)
    launchctl('bootstrap', DOMAIN, plistPath(label))
    console.log(`${label}: installed, logs in ${LOGS_DIR}`)
  }
}

function restart() {
  for (const { label } of AGENTS) launchctl('kickstart', '-k', `${DOMAIN}/${label}`)
}

function status() {
  for (const { label } of AGENTS) {
    if (!loaded(label)) {
      console.log(`${label}: not installed`)
      continue
    }
    const info = execFileSync('launchctl', ['print', `${DOMAIN}/${label}`], { encoding: 'utf8' })
    const field = (name) => info.match(new RegExp(`^\\s*${name} = (.+)$`, 'm'))?.[1] ?? '-'
    console.log(
      `${label}: ${field('state')}, pid ${field('pid')}, runs ${field('runs')}, last exit ${field('last exit code')}`,
    )
  }
}

function uninstall() {
  for (const { label } of AGENTS) {
    if (loaded(label)) launchctl('bootout', `${DOMAIN}/${label}`)
    rmSync(plistPath(label), { force: true })
    console.log(`${label}: removed`)
  }
}

const commands = { install, restart, status, uninstall }
const command = commands[process.argv[2] ?? '']
if (!command) {
  console.error('usage: pnpm workers <install|restart|status|uninstall>')
  process.exit(2)
}
command()
