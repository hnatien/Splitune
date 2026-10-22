// Test helper: resolves the token CSS the way a browser would for <html>, for a given set of
// data-* attributes and media features. It models only the selector and at-rule shapes this
// package uses and throws on anything else, so an unmodelled rule can't be silently ignored.
import { readFileSync } from 'node:fs'
import Color from 'colorjs.io'

export type Media = { prefersDark?: boolean; prefersMoreContrast?: boolean }
export type Context = { attrs: Record<string, string>; media?: Media }

type Rule = { media: string | null; selectors: string[]; decls: [string, string][]; order: number }

const SOURCE_FILES = ['primitives.css', 'themes.css', 'theme.tailwind.css']

export function readSource(file: string): string {
  return readFileSync(new URL(`../${file}`, import.meta.url), 'utf8')
}

/** Parses plain rules and `@media` blocks; skips Tailwind at-rules (`@theme`, `@layer`…). */
export function parseRules(css: string, startOrder = 0): Rule[] {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  const rules: Rule[] = []
  let order = startOrder
  let i = 0
  const readBlock = (from: number): [string, number] => {
    let depth = 0
    for (let j = from; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}') {
        depth--
        if (depth === 0) return [text.slice(from + 1, j), j + 1]
      }
    }
    throw new Error('Unbalanced braces')
  }
  const parseDecls = (body: string): [string, string][] =>
    body
      .split(';')
      .map((d) => d.trim())
      .filter((d) => d.startsWith('--') || d.startsWith('color-scheme'))
      .map((d) => {
        const colon = d.indexOf(':')
        return [
          d.slice(0, colon).trim(),
          d
            .slice(colon + 1)
            .trim()
            .replace(/\s+/g, ' '),
        ]
      })
  while (i < text.length) {
    const open = text.indexOf('{', i)
    const semi = text.indexOf(';', i)
    if (open === -1) break
    if (semi !== -1 && semi < open) {
      i = semi + 1 // statement at-rule such as @custom-variant x (…);
      continue
    }
    const prelude = text.slice(i, open).trim()
    const [body, next] = readBlock(open)
    i = next
    if (prelude.startsWith('@media')) {
      const media = prelude.slice('@media'.length).trim()
      for (const inner of parseRules(body, order)) {
        if (inner.media) throw new Error(`Nested @media in ${prelude}`)
        rules.push({ ...inner, media })
        order = inner.order + 1
      }
    } else if (prelude.startsWith('@')) {
      // @theme, @layer, @custom-variant blocks: not part of the attribute cascade.
    } else {
      const selectors = prelude.split(',').map((s) => s.trim())
      rules.push({ media: null, selectors, decls: parseDecls(body), order: order++ })
    }
  }
  return rules
}

export function loadRules(files = SOURCE_FILES): Rule[] {
  const rules: Rule[] = []
  for (const file of files) rules.push(...parseRules(readSource(file), rules.length * 1000))
  return rules
}

function mediaMatches(media: string, m: Media): boolean {
  switch (media) {
    case '(prefers-color-scheme: dark)':
      return m.prefersDark === true
    case '(prefers-contrast: more)':
      return m.prefersMoreContrast === true
    case '(prefers-reduced-motion: reduce)':
    case '(forced-colors: active)':
    case '(pointer: coarse)':
      return false
    default:
      throw new Error(`Unmodelled media query ${media}`)
  }
}

/** Matches a compound selector against <html>; returns its specificity or null. */
export function matchRoot(selector: string, attrs: Record<string, string>): number | null {
  const attrMatches = (part: string) => {
    const m = /^\[([\w-]+)(?:=["']([^"']*)["'])?\]$/.exec(part)
    if (!m) throw new Error(`Unmodelled selector part ${part}`)
    const [, name, value] = m as unknown as [string, string, string | undefined]
    return value === undefined ? name in attrs : attrs[name] === value
  }
  let specificity = 0
  for (const part of selector.match(/:root|:not\(\[[^\]]+\]\)|\[[^\]]+\]/g) ?? []) {
    specificity++
    if (part === ':root') continue
    if (part.startsWith(':not(')) {
      if (attrMatches(part.slice(5, -1))) return null
    } else if (!attrMatches(part)) return null
  }
  if (selector.replace(/:root|:not\(\[[^\]]+\]\)|\[[^\]]+\]/g, '') !== '') {
    throw new Error(`Unmodelled selector ${selector}`)
  }
  return specificity
}

/** Declared (unresolved) values for every custom property on <html> in this context. */
export function cascade(rules: Rule[], context: Context): Map<string, string> {
  const winners = new Map<string, { specificity: number; order: number; value: string }>()
  for (const rule of rules) {
    if (rule.media && !mediaMatches(rule.media, context.media ?? {})) continue
    const specificity = Math.max(
      -1,
      ...rule.selectors.map((s) => matchRoot(s, context.attrs) ?? -1),
    )
    if (specificity < 0) continue
    for (const [name, value] of rule.decls) {
      const current = winners.get(name)
      if (
        !current ||
        specificity > current.specificity ||
        (specificity === current.specificity && rule.order >= current.order)
      ) {
        winners.set(name, { specificity, order: rule.order, value })
      }
    }
  }
  return new Map([...winners].map(([name, w]) => [name, w.value]))
}

/** Substitutes var() references, like the computed value of a custom property. */
export function resolveValue(
  declared: Map<string, string>,
  value: string,
  seen = new Set<string>(),
): string {
  return value.replace(/var\((--[\w-]+)\)/g, (_, name: string) => {
    if (seen.has(name)) throw new Error(`Cycle through ${name}`)
    const inner = declared.get(name)
    if (inner === undefined) throw new Error(`Undefined ${name}`)
    return resolveValue(declared, inner, new Set([...seen, name]))
  })
}

/** Parses a resolved colour value, including `color-mix(in oklab, X P%, transparent|Y)`. */
export function toColor(value: string): Color {
  const mix = /^color-mix\(in oklab, (.+) (\d+(?:\.\d+)?)%, (.+)\)$/.exec(value)
  if (mix) {
    const [, a, pct, b] = mix as unknown as [string, string, string, string]
    const p = Number(pct) / 100
    if (b === 'transparent') {
      const color = toColor(a).clone()
      color.alpha = p
      return color
    }
    return toColor(a).mix(toColor(b), 1 - p, { space: 'oklab' })
  }
  return new Color(value)
}

export type Tokens = {
  raw: (name: string) => string
  color: (name: string) => Color
}

export function tokensFor(rules: Rule[], context: Context): Tokens {
  const declared = cascade(rules, context)
  return {
    raw: (name) => {
      const value = declared.get(name)
      if (value === undefined) throw new Error(`Undefined ${name}`)
      return resolveValue(declared, value)
    },
    color: (name) => {
      const value = declared.get(name)
      if (value === undefined) throw new Error(`Undefined ${name}`)
      return toColor(resolveValue(declared, value))
    },
  }
}

/** Composites a translucent colour over an opaque backdrop in sRGB. */
export function over(top: Color, backdrop: Color): Color {
  const a = top.alpha
  const t = top.to('srgb').coords
  const b = backdrop.to('srgb').coords
  return new Color(
    'srgb',
    [0, 1, 2].map((i) => (t[i] ?? 0) * a + (b[i] ?? 0) * (1 - a)) as [number, number, number],
  )
}

export function contrast(fg: Color, bg: Color): number {
  const backdrop = bg.alpha < 1 ? over(bg, new Color('white')) : bg
  const top = fg.alpha < 1 ? over(fg, backdrop) : fg
  return top.contrast(backdrop, 'WCAG21')
}

/** Every appearance × contrast context, with attributes set as the appearance script sets them. */
export const CONTEXTS: { name: string; context: Context }[] = [
  ...(['light', 'dark', 'stage'] as const).flatMap((appearance) =>
    (['normal', 'more'] as const).map((contrastMode) => ({
      name: `${appearance}/${contrastMode}`,
      context: { attrs: { 'data-appearance': appearance, 'data-contrast': contrastMode } },
    })),
  ),
  // Dark with the score matching the appearance (26 §2).
  ...(['normal', 'more'] as const).map((contrastMode) => ({
    name: `dark+match/${contrastMode}`,
    context: {
      attrs: { 'data-appearance': 'dark', 'data-contrast': contrastMode, 'data-score': 'match' },
    },
  })),
]
