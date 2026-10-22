// Part of `pnpm lint` (docs/implementation/28-ui-quality-and-design-review.md §3): colours come only
// from @splitune/ui-tokens, and focus is never removed without a replacement.
// - Raw colour literals (#hex, rgb(), hsl(), oklch()…) in apps/** and packages/** source outside
//   packages/ui-tokens. SVG icons use currentColor; static brand files in public/ aren't source.
// - Tailwind palette classes (bg-red-500, text-white…): the palette is cleared, so they'd silently
//   produce nothing.
// - `outline-none`/`outline-hidden` in a class list without a `focus-visible:outline-*` (or
//   `focus-visible:after:outline-*`) replacement in the same list, and CSS `outline: none|0`.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCOPE = /^(apps|packages)\//
const ALLOWED = ['packages/ui-tokens/']
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/

const COLOUR_FUNCTION = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(/g
// A hex colour starts a token: after a quote, space, colon, comma, paren, bracket or equals sign,
// but not a link fragment (href="#add").
const HEX =
  /(?<!(?:href|to)=["'`])(?<=["'`\s:,([=])#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})(?![\w-])/g
const PALETTE =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|border|ring|outline|fill|stroke|from|via|to|shadow|decoration|accent|caret|divide|placeholder)-(?:(?:slate|gray|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose)-\d{2,3}|white|black)(?![\w-])/g
const STRING = /(["'`])((?:\\.|(?!\1)[^\\])*)\1/g
const OUTLINE_REMOVED = /(?<![\w-])(?:[\w-]+:)*outline-(?:none|hidden)(?![\w-])/
const OUTLINE_REPLACED =
  /(?<![\w-])focus-visible:(?:after:|before:)?-?outline-(?!none|hidden)[\w(-]/
const CSS_OUTLINE_NONE = /outline\s*:\s*(?:none|0)\s*[;}]/g
const MOTION =
  /(?<![\w-])(?:[\w-]+:)*(?:(?:duration|delay)-(?:(?!0(?![\w-]))\d+|\[[^\]]*\d+m?s[^\]]*\])|ease-(?:in|out|in-out|linear|\[[^\]]*\])|\[transition:[^\]]*\d+m?s[^\]]*\])(?![\w-])/g

const files = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
  cwd: root,
  encoding: 'utf8',
})
  .split('\n')
  .filter(
    (file) =>
      SCOPE.test(file) && SOURCE.test(file) && !ALLOWED.some((prefix) => file.startsWith(prefix)),
  )

const violations = []
const lineOf = (text, index) => text.slice(0, index).split('\n').length

for (const file of files) {
  let text
  try {
    text = readFileSync(join(root, file), 'utf8')
  } catch {
    continue // listed by git but deleted in the working tree
  }
  for (const pattern of [COLOUR_FUNCTION, HEX]) {
    for (const match of text.matchAll(pattern)) {
      violations.push(`${file}:${lineOf(text, match.index)}: raw colour ${match[0]} — use a token`)
    }
  }
  if (!file.endsWith('.css')) {
    for (const match of text.matchAll(MOTION)) {
      violations.push(
        `${file}:${lineOf(text, match.index)}: motion ${match[0]} — use --duration-*/--ease-* tokens`,
      )
    }
  }
  for (const match of text.matchAll(PALETTE)) {
    violations.push(
      `${file}:${lineOf(text, match.index)}: palette class ${match[0]} — use a semantic colour`,
    )
  }
  if (file.endsWith('.css')) {
    for (const match of text.matchAll(CSS_OUTLINE_NONE)) {
      violations.push(
        `${file}:${lineOf(text, match.index)}: outline removed — keep the focus outline`,
      )
    }
  } else {
    for (const match of text.matchAll(STRING)) {
      const classes = match[2] ?? ''
      if (OUTLINE_REMOVED.test(classes) && !OUTLINE_REPLACED.test(classes)) {
        violations.push(
          `${file}:${lineOf(text, match.index)}: outline-none without focus-visible:outline-* in the same class list`,
        )
      }
    }
  }
}

if (violations.length > 0) {
  console.error('UI token violations (docs/implementation/26-design-system.md §3, §9, §10):')
  for (const violation of violations) console.error(`  ${violation}`)
  process.exit(1)
}
console.log(
  `check-ui-tokens: ${files.length} files, no raw colours, palette classes, bare outline-none or one-off motion.`,
)
