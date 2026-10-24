// Typed names and metadata for the "Music Stand" tokens (docs/implementation/26-design-system.md).
// CSS in this package is the source of truth; JS consumers (waveform canvas, alphaTab resources,
// meters) read live values with readToken()/readColor() and re-read them on appearance change.

export const APPEARANCES = ['light', 'dark', 'stage'] as const
export type Appearance = (typeof APPEARANCES)[number]
export type AppearanceChoice = Appearance | 'system'

export const CONTRASTS = ['normal', 'more'] as const
export type Contrast = (typeof CONTRASTS)[number]

export const DENSITIES = ['browse', 'practice'] as const
export type Density = (typeof DENSITIES)[number]

export const DISTANCES = ['desk', 'stand', 'floor'] as const
export type Distance = (typeof DISTANCES)[number]

/** Tier 2: shadcn roles plus Splitune roles, defined in every appearance. */
export const SEMANTIC_ROLES = [
  '--background',
  '--foreground',
  '--card',
  '--card-foreground',
  '--popover',
  '--popover-foreground',
  '--primary',
  '--primary-foreground',
  '--secondary',
  '--secondary-foreground',
  '--muted',
  '--muted-foreground',
  '--accent',
  '--accent-foreground',
  '--destructive',
  '--border',
  '--input',
  '--ring',
  '--success',
  '--warning',
  '--info',
  '--surface-raised',
  '--surface-sunken',
  '--success-surface',
  '--warning-surface',
  '--info-surface',
  '--destructive-surface',
  '--paper',
  '--ink',
  '--conf-medium',
  '--conf-low',
  '--stem-guitar',
  '--stem-bass',
  '--stem-drums',
  '--stem-vocals',
  '--stem-keys',
  '--stem-other',
  '--muted-foreground-more',
  '--border-more',
  '--input-more',
  '--elevation-1',
  '--elevation-2',
  '--elevation-3',
  '--read-scale',
] as const

/** Tier 2 aliases shared by every appearance. */
export const ALIAS_ROLES = [
  '--stem-mix',
  '--chart-1',
  '--chart-2',
  '--chart-3',
  '--chart-4',
  '--chart-5',
  '--sidebar',
  '--sidebar-foreground',
  '--sidebar-primary',
  '--sidebar-primary-foreground',
  '--sidebar-accent',
  '--sidebar-accent-foreground',
  '--sidebar-border',
  '--sidebar-ring',
  '--focus-width',
] as const

/** Tier 3: component tokens, defined in every appearance. */
export const COMPONENT_TOKENS = [
  '--loop-fill',
  '--loop-edge',
  '--playhead',
  '--score-loop-fill',
  '--score-loop-edge',
  '--score-playhead',
  '--staff',
  '--bar-current',
  '--key-white',
  '--key-black',
  '--key-left',
  '--key-left-fg',
  '--key-right',
  '--key-right-fg',
  '--fret-guitar',
  '--fret-bass',
  '--melody-vocals',
  '--waveform-peak',
  '--waveform-rms',
  '--waveform-played',
  '--scrim',
  '--hud-bg',
  '--hud-bg-more',
  '--hud-fg',
] as const

export const READING_TOKENS = [
  '--read-tab',
  '--read-chord-current',
  '--read-chord',
  '--read-bar-number',
  '--read-readout',
  '--read-label',
] as const

export const TARGET_TOKENS = [
  '--target-min',
  '--target-sm',
  '--target',
  '--target-practice-2',
  '--target-practice',
] as const

export const MOTION_TOKENS = [
  '--duration-fast',
  '--duration-base',
  '--duration-slow',
  '--duration-slower',
  '--stagger',
] as const

export type TokenName =
  | (typeof SEMANTIC_ROLES)[number]
  | (typeof ALIAS_ROLES)[number]
  | (typeof COMPONENT_TOKENS)[number]
  | (typeof READING_TOKENS)[number]
  | (typeof TARGET_TOKENS)[number]
  | (typeof MOTION_TOKENS)[number]
  | '--control-size'
  | '--radius'

/**
 * Contrast pairs checked in every appearance × contrast context (doc 26 §4.6, 28 §3):
 * [foreground, background, WCAG minimum]. The token tests enforce them; Foundations shows them live.
 */
export const CONTRAST_PAIRS: [TokenName, TokenName, number][] = [
  // §4.6 baseline
  ['--foreground', '--background', 7],
  ['--muted-foreground', '--card', 4.5],
  ['--primary-foreground', '--primary', 4.5],
  ['--ring', '--background', 3],
  ['--input', '--card', 3],
  ['--destructive', '--card', 4.5],
  ['--success', '--card', 4.5],
  ['--warning', '--card', 4.5],
  ['--info', '--card', 4.5],
  ['--ink', '--paper', 7],
  ['--conf-medium', '--paper', 4.5],
  ['--conf-low', '--paper', 4.5],
  ['--score-loop-edge', '--paper', 3],
  ['--score-playhead', '--paper', 3],
  ['--staff', '--paper', 3],
  ['--staff', '--score-loop-fill', 3],
  ['--stem-guitar', '--card', 3],
  ['--stem-bass', '--card', 3],
  ['--stem-drums', '--card', 3],
  ['--stem-vocals', '--card', 3],
  ['--stem-keys', '--card', 3],
  ['--stem-other', '--card', 3],
  ['--stem-mix', '--card', 3],
  // Every *-foreground on its surface, and text on the other surfaces it sits on
  ['--foreground', '--card', 7],
  ['--foreground', '--muted', 4.5],
  ['--card-foreground', '--card', 4.5],
  ['--popover-foreground', '--popover', 4.5],
  ['--secondary-foreground', '--secondary', 4.5],
  ['--accent-foreground', '--accent', 4.5],
  ['--sidebar-foreground', '--sidebar', 4.5],
  ['--sidebar-primary-foreground', '--sidebar-primary', 4.5],
  ['--sidebar-accent-foreground', '--sidebar-accent', 4.5],
  ['--muted-foreground', '--background', 4.5],
  ['--muted-foreground', '--muted', 4.5],
  ['--primary', '--background', 4.5],
  ['--primary', '--card', 4.5],
  ['--primary', '--accent', 4.5],
  ['--input', '--background', 3],
  ['--ring', '--card', 3],
  ['--destructive', '--background', 4.5],
  // Score: digits over the loop band and the current bar, staff on the current bar
  ['--ink', '--score-loop-fill', 7],
  ['--conf-low', '--score-loop-fill', 4.5],
  ['--ink', '--bar-current', 7],
  ['--conf-low', '--bar-current', 4.5],
  ['--staff', '--bar-current', 3],
  // Keyboard diagram: hands against both key colours, their letters on them
  ['--key-black', '--key-white', 3],
  ['--key-left', '--key-white', 3],
  ['--key-left', '--key-black', 3],
  ['--key-right', '--key-white', 3],
  ['--key-right', '--key-black', 3],
  ['--key-left-fg', '--key-left', 4.5],
  ['--key-right-fg', '--key-right', 4.5],
  ['--staff', '--key-white', 3],
  // Falling notes: bar numbers over the loop band (notes are outlined in --staff or --ink)
  ['--conf-medium', '--score-loop-fill', 4.5],
  // Guitar and bass Notes: sustain tails and finger rings on the paper and the loop band (the
  // note heads are outlined in --ink; their tint is tested in contrast.test.ts)
  ['--fret-guitar', '--paper', 3],
  ['--fret-guitar', '--score-loop-fill', 3],
  ['--fret-bass', '--paper', 3],
  ['--fret-bass', '--score-loop-fill', 3],
  // Vocal Melody: the note being sung and the rail's pitch now on the paper and the loop band (note
  // outlines are --ink; their tint is tested in contrast.test.ts)
  ['--melody-vocals', '--paper', 3],
  ['--melody-vocals', '--score-loop-fill', 3],
  // Timeline chrome
  ['--loop-edge', '--card', 3],
  ['--playhead', '--card', 3],
  ['--playhead', '--loop-fill', 3],
  ['--foreground', '--loop-fill', 4.5],
  ['--waveform-peak', '--card', 3],
  ['--waveform-rms', '--card', 3],
  // Surfaces and status surfaces (§4.8): text on raised and sunken, status colour on its own tint
  ['--foreground', '--surface-raised', 4.5],
  ['--foreground', '--surface-sunken', 4.5],
  ['--muted-foreground', '--surface-raised', 4.5],
  ['--muted-foreground', '--surface-sunken', 4.5],
  ['--primary', '--surface-raised', 4.5],
  ['--input', '--surface-raised', 3],
  ['--input', '--surface-sunken', 3],
  ['--foreground', '--success-surface', 4.5],
  ['--foreground', '--warning-surface', 4.5],
  ['--foreground', '--info-surface', 4.5],
  ['--foreground', '--destructive-surface', 4.5],
  ['--success', '--success-surface', 4.5],
  ['--warning', '--warning-surface', 4.5],
  ['--info', '--info-surface', 4.5],
  ['--destructive', '--destructive-surface', 4.5],
]

/** Stems in mixer order after "Your part"; each has a fixed colour token and a second cue (§4.4). */
export const STEMS = {
  guitar: { token: '--stem-guitar', icon: 'guitar' },
  bass: { token: '--stem-bass', icon: 'guitar' },
  drums: { token: '--stem-drums', icon: 'drum' },
  vocals: { token: '--stem-vocals', icon: 'mic' },
  keys: { token: '--stem-keys', icon: 'piano' },
  other: { token: '--stem-other', icon: 'audio-waveform' },
  mix: { token: '--stem-mix', icon: 'audio-waveform' },
} as const satisfies Record<string, { token: TokenName; icon: string }>
export type StemKind = keyof typeof STEMS

/**
 * Confidence encoding (§5): ordinal, never hue. Ink value → dashed outline → "?" glyph.
 * Bands come from docs/implementation/05-analysis-schema.md.
 */
export const CONFIDENCE = {
  high: { ink: '--ink', outline: 'none', glyph: null },
  medium: { ink: '--conf-medium', outline: 'dashed', glyph: null },
  low: { ink: '--conf-low', outline: 'dashed', glyph: '?' },
} as const satisfies Record<
  string,
  { ink: TokenName; outline: 'none' | 'dashed'; glyph: string | null }
>
export type ConfidenceLevel = keyof typeof CONFIDENCE

/** Width of confidence outlines and the timing underline, in CSS px (§5). */
export const CONFIDENCE_OUTLINE_PX = 1.5

/** Flashing elements are capped at 3 flashes per second regardless of tempo (§10). */
export const MAX_FLASHES_PER_SECOND = 3

/** Reads a token's computed value (e.g. `24px`, `oklch(…)`, `var()` already substituted). */
export function readToken(name: TokenName, element: Element = document.documentElement): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

let probe: { element: HTMLSpanElement; context: CanvasRenderingContext2D } | undefined

/**
 * Reads a colour token as `rgba(r, g, b, a)` for consumers that can't parse OKLCH or
 * `color-mix()` (canvas in older engines, alphaTab resources). Resolves through the cascade of
 * `element`, so it follows the current appearance and contrast.
 */
export function readColor(name: TokenName, element: Element = document.documentElement): string {
  if (!probe) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('readColor needs a 2D canvas context')
    probe = { element: document.createElement('span'), context }
    probe.element.style.display = 'none'
  }
  const { element: span, context } = probe
  span.style.color = `var(${name})`
  element.appendChild(span)
  const computed = getComputedStyle(span).color
  span.remove()
  context.clearRect(0, 0, 1, 1)
  context.fillStyle = computed
  context.fillRect(0, 0, 1, 1)
  const [r, g, b, a] = context.getImageData(0, 0, 1, 1).data
  return `rgba(${r}, ${g}, ${b}, ${Math.round(((a ?? 255) / 255) * 1000) / 1000})`
}

/**
 * The Light and Dark page backgrounds (--background) as sRGB hex, for what takes no CSS variable:
 * the web app manifest and `<meta name="theme-color">`. tokens.test.ts checks them against
 * primitives.css.
 */
export const BACKGROUND_HEX = { light: '#f7f6f2', dark: '#181612' } as const
