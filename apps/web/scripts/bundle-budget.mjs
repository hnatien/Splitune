// Practice route JS budget (10-web-app-architecture.md §9: ≤ 302 KB gzip, alphaTab and WASM
// excluded; 300 KB until step 15's product events, raised by the owner on 2026-10-22): the entry
// chunk plus the practice route's chunk and every chunk they import statically, gzip-compressed, from the production build in .output/public/assets.
// Reports by default; `--enforce` fails over budget (enforced from step 12, when the practice
// screen exists).
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gzipSync } from 'node:zlib'

const BUDGET_BYTES = 302 * 1024
const ASSETS = fileURLToPath(new URL('../.output/public/assets/', import.meta.url))
const IMPORT = /(?:import|from)\s*["']\.\/([^"']+\.js)["']/g

const chunks = readdirSync(ASSETS).filter((name) => name.endsWith('.js'))
const find = (prefix) => {
  const match = chunks.find((name) => name.startsWith(prefix))
  if (!match) throw new Error(`no chunk starting with ${prefix} in ${ASSETS} — build the app first`)
  return match
}

const seen = new Set()
const visit = (name) => {
  if (seen.has(name)) return
  seen.add(name)
  for (const [, dep] of readFileSync(join(ASSETS, name), 'utf8').matchAll(IMPORT)) visit(dep)
}
visit(find('index-'))
visit(find('_songId.practice-'))

const sizes = [...seen].map((name) => ({
  name,
  gzip: gzipSync(readFileSync(join(ASSETS, name))).length,
}))
const total = sizes.reduce((sum, chunk) => sum + chunk.gzip, 0)
const kb = (bytes) => `${(bytes / 1024).toFixed(1)} KB`
for (const chunk of sizes.sort((a, b) => b.gzip - a.gzip)) {
  process.stdout.write(`${kb(chunk.gzip).padStart(9)}  ${chunk.name}\n`)
}
const over = total > BUDGET_BYTES
process.stdout.write(
  `practice route JS: ${kb(total)} gzip of ${kb(BUDGET_BYTES)} budget${over ? ' — OVER BUDGET' : ''}\n`,
)
if (over && process.argv.includes('--enforce')) process.exit(1)
