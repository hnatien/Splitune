// `pnpm contracts:gen`: Zod (packages/contracts/src) → JSON Schema (packages/contracts/schema)
// → Pydantic models (services/ml, splitune_ml_core/contracts/_generated.py).
// `pnpm contracts:check`: regenerate both into a temp dir and fail if the committed files differ.
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const contractsDir = join(root, 'packages/contracts')
const mlDir = join(root, 'services/ml')
const schemaDir = join(contractsDir, 'schema')
const pythonModule = join(
  mlDir,
  'packages/splitune_ml_core/src/splitune_ml_core/contracts/_generated.py',
)

function generate(schemaOut, pythonOut) {
  execFileSync('node', ['scripts/build-schema.ts', '--out', schemaOut], {
    cwd: contractsDir,
    stdio: 'inherit',
  })
  execFileSync(
    'uv',
    [
      'run',
      'python',
      'scripts/gen_contracts.py',
      '--schema',
      join(schemaOut, 'contracts.json'),
      '--output',
      pythonOut,
    ],
    { cwd: mlDir, stdio: 'inherit' },
  )
}

function changedFiles(tmp) {
  const pairs = [[pythonModule, join(tmp, '_generated.py')]]
  const names = new Set([...readdirSync(schemaDir), ...readdirSync(join(tmp, 'schema'))])
  for (const name of [...names].sort()) {
    pairs.push([join(schemaDir, name), join(tmp, 'schema', name)])
  }
  return pairs.filter(([committed, fresh]) => {
    if (!existsSync(committed) || !existsSync(fresh)) return true
    return !readFileSync(committed).equals(readFileSync(fresh))
  })
}

const mode = process.argv[2]
if (mode === 'gen') {
  generate(schemaDir, pythonModule)
} else if (mode === 'check') {
  const tmp = mkdtempSync(join(tmpdir(), 'splitune-contracts-'))
  try {
    generate(join(tmp, 'schema'), join(tmp, '_generated.py'))
    const changed = changedFiles(tmp)
    if (changed.length > 0) {
      console.error('\nGenerated contracts are out of date. Run `pnpm contracts:gen` and commit:')
      for (const [committed] of changed) console.error(`  ${relative(root, committed)}`)
      process.exitCode = 1
    } else {
      console.log('\nGenerated contracts are up to date.')
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }
} else {
  console.error('usage: node scripts/contracts.mjs gen|check')
  process.exitCode = 2
}
