// One-shot developer setup. Run with `pnpm run setup` (plain `pnpm setup` is pnpm's own built-in command).
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync } from 'node:fs'
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

// PyTorch variant: SPLITUNE_TORCH=cuda|cpu (default: none on macOS, cpu on Linux, cuda on Windows/PC)
const defaultTorch =
  process.platform === 'linux' ? 'cpu' : process.platform === 'win32' ? 'cuda' : undefined
const torchExtra = process.env.SPLITUNE_TORCH ?? defaultTorch
const mlSyncArgs = ['sync', ...(torchExtra ? ['--extra', torchExtra] : [])]

run('pnpm', ['install'])
run('uv', mlSyncArgs, join(root, 'services/ml'))
// ML worker islands: one venv each (services/ml/islands/<name>, 06-ml-pipeline-service.md §0).
run('uv', mlSyncArgs, join(root, 'services/ml/islands/torch'))
run('uv', ['sync'], join(root, 'services/ml/islands/onnx-cpu'))

const envFile = join(root, '.env')
if (existsSync(envFile)) {
  console.log('\n.env already exists; left unchanged.')
} else {
  copyFileSync(join(root, '.env.example'), envFile)
  console.log('\nCreated .env from .env.example.')
}

// Model weights (~4 GB) into ML_MODELS_DIR from .env; files already in place are kept.
process.loadEnvFile(envFile)
run('uv', ['run', '--no-sync', 'python', 'scripts/fetch_models.py'], join(root, 'services/ml'))

run('git', ['config', 'core.hooksPath', '.githooks'])
if (!hasCommand('gitleaks')) {
  console.warn(
    '\ngitleaks is not installed; the pre-commit secret scan will block commits until it is (`brew install gitleaks`).',
  )
}
if (hasCommand('docker')) {
  // The pinned Emscripten image that builds packages/audio-dsp/dist/dsp.wasm.
  const emsdk = readFileSync(join(root, 'packages/audio-dsp/emsdk-version'), 'utf8').trim()
  run('docker', ['pull', `emscripten/emsdk:${emsdk}`])
} else {
  console.warn(
    '\nDocker is not installed; `pnpm dev` needs it for Postgres, SeaweedFS and Mailpit, and the dsp.wasm build for the Emscripten image.',
  )
}

console.log('\nSetup complete. Start local services and dev servers with `pnpm dev`.')
