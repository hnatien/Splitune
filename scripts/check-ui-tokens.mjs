// Part of `pnpm lint` (docs/specs/28-ui-quality-and-design-review.md §3): colours come only
// from @splitune/ui-tokens, and focus is never removed without a replacement.
//
// Base rules, on apps/** and packages/** source outside packages/ui-tokens:
// - Raw colour literals (#hex, rgb(), hsl(), oklch()…). SVG icons use currentColor; static brand
//   files in public/ aren't source.
// - Tailwind palette classes (bg-red-500, text-white…): the palette is cleared, so they'd silently
//   produce nothing.
// - `outline-none`/`outline-hidden` in a class list without a `focus-visible:outline-*` (or
//   `focus-visible:after:outline-*`) replacement in the same list, and CSS `outline: none|0`.
// - One-off durations, delays and easings (use the --duration-*/--ease-* tokens).
//
// Raw-value rules (28 §3 "Raw values", step s33), on apps/web/app/ui/** by default:
// - Arbitrary colours: a Tailwind colour utility with an arbitrary value that is a colour literal
//   (`bg-[white]`, `text-[color:Canvas]`, `fill-[color-mix(…)]`), named or system colours in CSS
//   colour properties, and colour-mix().
// - Arbitrary radii: `rounded-[…]` (any side or corner) or a CSS / style-prop border radius with
//   a raw length. Values built only from tokens pass (`rounded-[calc(var(--r)+var(--pad))]`).
// - Arbitrary font sizes: `text-[13px]`, `text-[length:1rem]`, CSS `font-size: 13px`, a style-prop
//   fontSize. Token references pass (`text-(length:--read-tab)`), and so do em multiples, which
//   scale the token size of the text they sit in (a chord's raised quality).
// - Arbitrary shadows: `shadow-[…]`, `inset-shadow-[…]`, `drop-shadow-[…]` and CSS or style-prop
//   box-shadow values that aren't a token (`var(--…)`) or none.
// - Style-prop colour literals: `style={{ color: 'red' }}` and colour-valued JSX attributes
//   (`fill="white"`); `var(--…)`, currentColor, transparent and the CSS-wide keywords pass.
//
// Options:
//   --path <dir>   Run the raw-value rules on <dir> instead of apps/web/app/ui (repeatable), so a
//                  screen step checks its own area:
//                  node scripts/check-ui-tokens.mjs --path apps/web/app/features/library
// The base rules always run on their full scope.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')

const SCOPE = /^(apps|packages)\//
const ALLOWED = ['packages/ui-tokens/']
const SOURCE = /\.(ts|tsx|js|jsx|mjs|cjs|css)$/
export const RAW_VALUE_SCOPE = ['apps/web/app/ui/']

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

// CSS named and system colours (CSS Color 4): a raw colour as much as a hex value is.
const NAMED_COLOURS =
  'aliceblue|antiquewhite|aqua|aquamarine|azure|beige|bisque|black|blanchedalmond|blue|blueviolet|brown|burlywood|cadetblue|chartreuse|chocolate|coral|cornflowerblue|cornsilk|crimson|cyan|darkblue|darkcyan|darkgoldenrod|darkgray|darkgreen|darkgrey|darkkhaki|darkmagenta|darkolivegreen|darkorange|darkorchid|darkred|darksalmon|darkseagreen|darkslateblue|darkslategray|darkslategrey|darkturquoise|darkviolet|deeppink|deepskyblue|dimgray|dimgrey|dodgerblue|firebrick|floralwhite|forestgreen|fuchsia|gainsboro|ghostwhite|gold|goldenrod|gray|green|greenyellow|grey|honeydew|hotpink|indianred|indigo|ivory|khaki|lavender|lavenderblush|lawngreen|lemonchiffon|lightblue|lightcoral|lightcyan|lightgoldenrodyellow|lightgray|lightgreen|lightgrey|lightpink|lightsalmon|lightseagreen|lightskyblue|lightslategray|lightslategrey|lightsteelblue|lightyellow|lime|limegreen|linen|magenta|maroon|mediumaquamarine|mediumblue|mediumorchid|mediumpurple|mediumseagreen|mediumslateblue|mediumspringgreen|mediumturquoise|mediumvioletred|midnightblue|mintcream|mistyrose|moccasin|navajowhite|navy|oldlace|olive|olivedrab|orange|orangered|orchid|palegoldenrod|palegreen|paleturquoise|palevioletred|papayawhip|peachpuff|peru|pink|plum|powderblue|purple|rebeccapurple|red|rosybrown|royalblue|saddlebrown|salmon|sandybrown|seagreen|seashell|sienna|silver|skyblue|slateblue|slategray|slategrey|snow|springgreen|steelblue|tan|teal|thistle|tomato|turquoise|violet|wheat|white|whitesmoke|yellow|yellowgreen|accentcolor|accentcolortext|activetext|buttonborder|buttonface|buttontext|canvas|canvastext|field|fieldtext|graytext|highlight|highlighttext|linktext|mark|marktext|selecteditem|selecteditemtext|visitedtext'
const COLOUR_VALUE = new RegExp(
  `(?:^|[\\s,(_:])(?:${NAMED_COLOURS})(?![\\w-])|color-mix\\(|light-dark\\(|#[0-9a-f]{3,8}\\b|\\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\\(`,
  'i',
)
/** A raw length or a bare number, as opposed to a value built from var(--…) tokens. */
const RAW_LENGTH = /(?<![\w-])-?\d*\.?\d+(?:px|rem|em|ch|ex|%|vw|vh|vmin|vmax|cqi|pt)?(?![\w-])/
const RAW_FONT_LENGTH = /(?<![\w-])-?\d*\.?\d+(?:px|rem|ch|ex|%|vw|vh|vmin|vmax|cqi|pt)?(?![\w.-])/
const COLOUR_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*(?:bg|text|border(?:-[xytrblse])?|ring|ring-offset|outline|fill|stroke|from|via|to|decoration|accent|caret|divide|placeholder|inset-ring|shadow|inset-shadow|drop-shadow)-\[([^\]\s]+)\]/g
const RADIUS_UTILITY =
  /(?<![\w-])(?:[\w-]+:)*rounded(?:-(?:[tblrse]|tl|tr|bl|br|ss|se|es|ee))?-\[([^\]\s]+)\]/g
const FONT_SIZE_UTILITY = /(?<![\w-])(?:[\w-]+:)*text-\[(?:length:)?([^\]\s]+)\]/g
const SHADOW_UTILITY = /(?<![\w-])(?:[\w-]+:)*(?:inset-shadow|drop-shadow|shadow)-\[([^\]\s]+)\]/g
const CSS_DECLARATION =
  /(?<![\w-])(color|background(?:-color)?|border(?:-(?:top|right|bottom|left|block|inline))?-color|outline-color|fill|stroke|caret-color|accent-color|text-decoration-color|border(?:-(?:top|bottom)-(?:left|right))?-radius|font-size|box-shadow)\s*:\s*([^;}]+)/g
const STYLE_COLOUR =
  /(?<![\w-])(color|background|backgroundColor|border(?:Top|Right|Bottom|Left|Block|Inline)?Color|outlineColor|fill|stroke|caretColor|accentColor|textDecorationColor|stopColor|floodColor|lightingColor)\s*:\s*(["'`])((?:\\.|(?!\2)[^\\])*)\2/g
const STYLE_LENGTH =
  /(?<![\w-])(fontSize|borderRadius|border(?:Top|Bottom)(?:Left|Right)Radius|boxShadow)\s*:\s*(["'`]((?:\\.|(?!["'`])[^\\])*)["'`]|-?\d*\.?\d+)/g
const JSX_COLOUR_ATTRIBUTE =
  /(?<![\w-])(fill|stroke|color|stopColor|floodColor|lightingColor)=(["'])([^"']*)\2/g
const KEYWORD = /^(?:var\(--[\w-]+\)|currentcolor|transparent|inherit|initial|unset|revert|none)$/i

const tokenOnly = (value) => /^var\(--[\w-]+\)$/.test(value.trim())
const fromTokens = (value) =>
  /var\(--/.test(value) && !RAW_LENGTH.test(value.replace(/var\(--[\w-]+\)/g, ''))
const lineOf = (text, index) => text.slice(0, index).split('\n').length

/** The `{{ … }}` bodies of JSX style props. */
function styleProps(text) {
  const bodies = []
  for (const match of text.matchAll(/style=\{\{/g)) {
    let depth = 2
    let end = match.index + match[0].length
    while (end < text.length && depth > 0) {
      if (text[end] === '{') depth += 1
      else if (text[end] === '}') depth -= 1
      end += 1
    }
    bodies.push({ index: match.index, body: text.slice(match.index, end) })
  }
  return bodies
}

/** The base rules: raw colour literals, palette classes, bare outline-none, one-off motion. */
export function checkBase(file, text) {
  const violations = []
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
  return violations
}

/** The 28 §3 raw-value rules: arbitrary colours, radii, font sizes, shadows; style-prop colours. */
export function checkRawValues(file, text) {
  const violations = []
  const at = (index, message) => violations.push(`${file}:${lineOf(text, index)}: ${message}`)
  const css = file.endsWith('.css')
  if (!css) {
    for (const match of text.matchAll(COLOUR_UTILITY)) {
      const value = (match[1] ?? '').replace(/^color:/, '')
      if (COLOUR_VALUE.test(value)) at(match.index, `arbitrary colour ${match[0]} — use a token`)
    }
    for (const match of text.matchAll(RADIUS_UTILITY)) {
      const value = match[1] ?? ''
      if (value !== 'inherit' && !fromTokens(value))
        at(match.index, `arbitrary radius ${match[0]} — use the rounded-* scale (26 §9)`)
    }
    for (const match of text.matchAll(FONT_SIZE_UTILITY)) {
      const value = match[1] ?? ''
      if (/^color:/.test(value) || COLOUR_VALUE.test(value)) continue
      const withoutTokens = value.replace(/var\(--[\w-]+\)/g, '')
      if (RAW_FONT_LENGTH.test(withoutTokens))
        at(match.index, `arbitrary font size ${match[0]} — use a text-* token (26 §6)`)
    }
    for (const match of text.matchAll(SHADOW_UTILITY)) {
      const value = match[1] ?? ''
      if (!tokenOnly(value) && !COLOUR_VALUE.test(value))
        at(match.index, `arbitrary shadow ${match[0]} — use shadow-1…3 or --glow (26 §9)`)
    }
    for (const { index, body } of styleProps(text)) {
      for (const match of body.matchAll(STYLE_COLOUR)) {
        const value = (match[3] ?? '').trim()
        if (!KEYWORD.test(value) && !/^var\(/.test(value))
          at(index + (match.index ?? 0), `style-prop colour ${match[1]}: ${value} — use a token`)
      }
      for (const match of body.matchAll(STYLE_LENGTH)) {
        const value = (match[3] ?? match[2] ?? '').trim()
        if (/^var\(--[\w-]+\)$/.test(value) || /^none$/.test(value)) continue
        at(index + (match.index ?? 0), `style-prop ${match[1]}: ${value} — use a token`)
      }
    }
    for (const match of text.matchAll(JSX_COLOUR_ATTRIBUTE)) {
      const value = (match[3] ?? '').trim()
      if (!KEYWORD.test(value) && !/^url\(/.test(value) && COLOUR_VALUE.test(` ${value}`))
        at(match.index, `colour attribute ${match[1]}="${value}" — use currentColor or a token`)
    }
  } else {
    for (const match of text.matchAll(CSS_DECLARATION)) {
      const [, property = '', raw = ''] = match
      const value = raw.trim()
      if (/radius$/.test(property)) {
        if (!fromTokens(value) && RAW_LENGTH.test(value) && value !== '0')
          at(match.index, `radius ${property}: ${value} — use the radius scale (26 §9)`)
      } else if (property === 'font-size') {
        if (RAW_FONT_LENGTH.test(value.replace(/var\(--[\w-]+\)/g, '')))
          at(match.index, `font size ${value} — use a text-* token (26 §6)`)
      } else if (property === 'box-shadow') {
        if (!tokenOnly(value) && value !== 'none')
          at(match.index, `box-shadow ${value} — use --elevation-* or --glow (26 §9)`)
      } else if (COLOUR_VALUE.test(` ${value}`)) {
        at(match.index, `colour ${property}: ${value} — use a token`)
      }
    }
  }
  return violations
}

function parseArgs(argv) {
  const paths = []
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--path') {
      const dir = argv[i + 1]
      if (!dir) throw new Error('--path needs a directory')
      paths.push(`${dir.replace(/\\/g, '/').replace(/\/+$/, '')}/`)
      i += 1
    } else {
      throw new Error(`unknown argument ${argv[i]}`)
    }
  }
  return { rawValueScope: paths.length > 0 ? paths : RAW_VALUE_SCOPE }
}

function main() {
  let rawValueScope
  try {
    ;({ rawValueScope } = parseArgs(process.argv.slice(2)))
  } catch (error) {
    console.error(`check-ui-tokens: ${error.message} (usage: [--path <dir>]…)`)
    process.exit(1)
  }
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
  let rawValueFiles = 0
  for (const file of files) {
    let text
    try {
      text = readFileSync(join(root, file), 'utf8')
    } catch {
      continue // listed by git but deleted in the working tree
    }
    violations.push(...checkBase(file, text))
    if (rawValueScope.some((prefix) => file.startsWith(prefix))) {
      rawValueFiles += 1
      violations.push(...checkRawValues(file, text))
    }
  }

  if (violations.length > 0) {
    console.error('UI token violations (docs/specs/26-design-system.md §3, §6, §9, §10):')
    for (const violation of violations) console.error(`  ${violation}`)
    process.exit(1)
  }
  console.log(
    `check-ui-tokens: ${files.length} files, no raw colours, palette classes, bare outline-none or one-off motion; ${rawValueFiles} files in ${rawValueScope.join(', ')} with no arbitrary colours, radii, font sizes, shadows or style-prop colours.`,
  )
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main()
