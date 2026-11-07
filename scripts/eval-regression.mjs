// `pnpm eval:regression [--update-baseline] [--smoke] [--report PATH]`: the separation regression
// suite (services/ml/eval/regression.yaml; docs/specs/08 §4). Exits 1 when a value is outside its
// tolerance. Run it after changing stage_separation, config/separation.personal.yaml, the
// audio-separator or torch pins, or model weights.
import { spawnSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const mlDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'services/ml')
const result = spawnSync(
  'uv',
  ['run', '--no-sync', 'splitune-eval', 'regress', ...process.argv.slice(2)],
  { cwd: mlDir, stdio: 'inherit' },
)
process.exit(result.status ?? 1)
