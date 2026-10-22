// Builds dist/dsp.wasm in the pinned Emscripten image and checks it against dsp.wasm.sha256, so
// every machine and CI produce the same bytes. `--update` records a new hash after a deliberate
// change to the C++ sources, the flags or the image.
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const update = process.argv.includes('--update')
const image = `emscripten/emsdk:${readFileSync(join(root, 'emsdk-version'), 'utf8').trim()}`
const hashFile = join(root, 'dsp.wasm.sha256')

execFileSync(
  'docker',
  ['build', '--build-arg', `EMSDK_IMAGE=${image}`, '--output', 'type=local,dest=dist', '.'],
  { cwd: root, stdio: 'inherit' },
)

const hash = createHash('sha256')
  .update(readFileSync(join(root, 'dist/dsp.wasm')))
  .digest('hex')
const expected = readFileSync(hashFile, 'utf8').trim()
if (update) {
  writeFileSync(hashFile, `${hash}\n`)
  console.log(`dsp.wasm sha256 ${hash} (recorded)`)
} else if (hash !== expected) {
  console.error(
    `dsp.wasm sha256 ${hash} differs from dsp.wasm.sha256 (${expected}).\n` +
      'If the sources, flags or image changed on purpose, run `pnpm --filter @splitune/audio-dsp build --update`.',
  )
  process.exit(1)
} else {
  console.log(`dsp.wasm sha256 ${hash} (matches dsp.wasm.sha256)`)
}
