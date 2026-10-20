// One-shot developer setup. Run with `pnpm run setup` (plain `pnpm setup` is pnpm's own built-in command).
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

function run(command, args, cwd = root) {
  console.log(`\n> ${command} ${args.join(' ')}`)
  execFileSync(command, args, { cwd, stdio: 'inherit' })
}

function hasCommand(command) {
  try {
    execFileSync(command, ['--version'], { stdio: 'ignore' })
    return true
  } catch {
    return false
  }
}

if (!hasCommand('uv')) {
  console.error('uv is required for services/ml. Install it with `brew install uv`.')
  process.exit(1)
}

run('pnpm', ['install'])
run('uv', ['sync'], join(root, 'services/ml'))
// ML worker islands: one venv each (services/ml/islands/<name>, 06-ml-pipeline-service.md §0).
for (const island of ['torch', 'onnx-cpu'])
  run('uv', ['sync'], join(root, 'services/ml/islands', island))

const envFile = join(root, '.env')
if (existsSync(envFile)) {
  console.log('\n.env already exists; left unchanged.')
} else {
  copyFileSync(join(root, '.env.example'), envFile)
  console.log('\nCreated .env from .env.example.')
}

run('git', ['config', 'core.hooksPath', '.githooks'])
if (!hasCommand('gitleaks')) {
  console.warn(
    '\ngitleaks is not installed; the pre-commit secret scan will block commits until it is (`brew install gitleaks`).',
  )
}
if (!hasCommand('docker')) {
  console.warn(
    '\nDocker is not installed; `pnpm dev` needs it for Postgres, SeaweedFS and Mailpit.',
  )
}

console.log('\nSetup complete. Start local services and dev servers with `pnpm dev`.')
