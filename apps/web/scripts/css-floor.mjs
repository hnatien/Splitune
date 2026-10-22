// CSS floor check (24 §2, 26 §3): the built stylesheets use nothing above Safari 16.4 /
// Chrome 111 / Firefox 128 that would break rendering there. Fails on light-dark() (Safari 17.5),
// relative colour syntax (Safari 18), @scope (Safari 17.4, Firefox —) and native nesting (Chrome
// 112, Safari 16.5): those browsers drop the whole declaration or rule. Tailwind compiles nesting
// away; this guards hand-written CSS and new plugins. Run after `pnpm --filter @splitune/web build`.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ASSETS = fileURLToPath(new URL('../.output/public/assets/', import.meta.url))

const RULES = [
  { name: 'light-dark()', pattern: /\blight-dark\(/g },
  {
    name: 'relative colour syntax',
    pattern: /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(\s*from\s/g,
  },
  { name: '@scope', pattern: /@scope\b/g },
  // A rule starting with & right after { or ; (escaped class names such as .\[\&_svg\] don't).
  { name: 'native nesting', pattern: /[{;]\s*&(?=[\w.:#[\s>+~-])/g },
]

const sheets = readdirSync(ASSETS).filter((name) => name.endsWith('.css'))
if (sheets.length === 0) throw new Error(`no CSS in ${ASSETS} — build the app first`)

let failures = 0
for (const sheet of sheets) {
  // @supports conditions may name newer syntax to test for it (Tailwind's own feature queries).
  const css = readFileSync(join(ASSETS, sheet), 'utf8').replace(/@supports[^{]*/g, '@supports ')
  for (const { name, pattern } of RULES) {
    for (const match of css.matchAll(pattern)) {
      failures++
      const at = match.index ?? 0
      process.stdout.write(`${sheet}: ${name}: …${css.slice(Math.max(0, at - 60), at + 60)}…\n`)
    }
  }
}
process.stdout.write(
  `CSS floor: ${sheets.length} stylesheet(s), ${failures === 0 ? 'nothing above the floor' : `${failures} problem(s)`}\n`,
)
if (failures > 0) process.exit(1)
