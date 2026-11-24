// Typed names and metadata for the design tokens (docs/specs/26-design-system.md).
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

/** The neutral ramp (§4.1): twelve steps numbered by job, bound per appearance. */
export const RAMP_STEPS = [
  '--gray-1',
  '--gray-2',
  '--gray-3',
  '--gray-4',
  '--gray-5',
  '--gray-6',
  '--gray-7',
  '--gray-8',
  '--gray-9',
  '--gray-10',
  '--gray-11',
  '--gray-12',
] as const

/**
 * The job of each ramp step (§4.1): which roles read it. It is the same table in Dark and Light;
 * tokens.test.ts holds the CSS to it and Foundations draws it.
 */
export const ROLE_STEPS = {
  '--background': 1,
  '--primary-foreground': 1,
  '--destructive-foreground': 1,
  '--panel': 2,
  '--raised': 3,
  '--hover': 4,
  '--wash': 4,
  '--pressed': 5,
  '--border': 6,
  '--border-strong': 7,
  '--border-more': 7,
  '--edge': 8,
  '--border-strong-more': 8,
  '--faint-foreground': 9,
  '--edge-more': 9,
  '--muted-foreground': 10,
  '--faint-foreground-more': 10,
  '--primary-hover': 11,
  '--muted-foreground-more': 11,
  '--foreground': 12,
  '--primary': 12,
  '--selected': 12,
  '--signal': 12,
  '--ring': 12,
} as const

/** Tier 2: the semantic roles (§3), defined in every appearance. */
export const SEMANTIC_ROLES = [
  '--background',
  '--panel',
  '--raised',
  '--hover',
  '--wash',
  '--pressed',
  '--border',
  '--border-strong',
  '--edge',
  '--faint-foreground',
  '--muted-foreground',
  '--primary-hover',
  '--foreground',
  '--primary',
  '--primary-foreground',
  '--selected',
  '--signal',
  '--ring',
  '--border-more',
  '--border-strong-more',
  '--edge-more',
  '--faint-foreground-more',
  '--muted-foreground-more',
  '--destructive',
  '--destructive-foreground',
  '--destructive-surface',
  '--success',
  '--success-surface',
  '--unsure',
  '--unsure-surface',
  '--edited',
  '--paper',
  '--ink',
  '--conf-medium',
  '--conf-medium-edge',
  '--conf-low',
  '--conf-low-edge',
  '--stem-guitar',
  '--stem-bass',
  '--stem-drums',
  '--stem-vocals',
  '--stem-keys',
  '--stem-other',
  '--elevation-popover',
  '--elevation-dialog',
  '--read-scale',
] as const

/** Tier 2 aliases shared by every appearance. */
export const ALIAS_ROLES = ['--stem-mix', '--focus-width'] as const

/** Tier 3: component tokens (§4.7), defined in every appearance. */
export const COMPONENT_TOKENS = [
  '--bar-current',
  '--loop-fill',
  '--score-loop-fill',
  '--loop-edge',
  '--playhead',
  '--score-loop-edge',
  '--score-playhead',
  '--now-line',
  '--staff',
  '--staff-more',
  '--waveform-peak',
  '--waveform-peak-more',
  '--waveform-rms',
  '--waveform-played',
  '--waveform-loop',
  '--hatch',
  '--beat-now',
  '--beat-done',
  '--beat-slot',
  '--key-white',
  '--key-black',
  '--key-left',
  '--key-left-fg',
  '--key-right',
  '--key-right-fg',
  '--fret-guitar',
  '--fret-bass',
  '--melody-vocals',
  '--tile-foreground',
  '--scrim',
  '--hud-bg',
  '--hud-fg',
] as const

export const READING_TOKENS = [
  '--read-tab',
  '--read-chord-current',
  '--read-chord-next',
  '--read-chord-sheet',
  '--read-chord',
  '--read-bar-number',
  '--read-readout',
  '--read-label',
] as const

export const TARGET_TOKENS = [
  '--target-min',
  '--target',
  '--target-practice',
  '--target-play',
  '--target-stand',
] as const

export const MOTION_TOKENS = [
  '--duration-fast',
  '--duration-base',
  '--duration-slow',
  '--duration-slower',
  '--stagger',
] as const

export type TokenName =
  | (typeof RAMP_STEPS)[number]
  | (typeof SEMANTIC_ROLES)[number]
  | (typeof ALIAS_ROLES)[number]
  | (typeof COMPONENT_TOKENS)[number]
  | (typeof READING_TOKENS)[number]
  | (typeof TARGET_TOKENS)[number]
  | (typeof MOTION_TOKENS)[number]
  | '--control-size'

/**
 * Contrast pairs checked in every appearance × contrast context (doc 26 §4.6, 28 §3):
 * [foreground, background, WCAG minimum]. Every background is opaque. The token tests enforce
 * them; Foundations shows them live.
 */
export const CONTRAST_PAIRS: [TokenName, TokenName, number][] = [
  // Text on every surface it sits on: ink and secondary text at 7:1 on the page, 4.5:1 elsewhere
  ['--foreground', '--background', 7],
  ['--foreground', '--panel', 7],
  ['--foreground', '--raised', 7],
  ['--foreground', '--hover', 7],
  ['--foreground', '--pressed', 4.5],
  ['--muted-foreground', '--background', 7],
  ['--muted-foreground', '--panel', 4.5],
  ['--muted-foreground', '--raised', 4.5],
  ['--muted-foreground', '--hover', 4.5],
  ['--faint-foreground', '--background', 4.5],
  ['--faint-foreground', '--panel', 4.5],
  ['--faint-foreground', '--raised', 4.5],
  ['--faint-foreground', '--hover', 4.5],
  // The filled ink control, and an inverted "on" toggle against what it sits on
  ['--primary-foreground', '--primary', 4.5],
  ['--primary-foreground', '--primary-hover', 4.5],
  ['--primary', '--background', 3],
  ['--primary', '--panel', 3],
  ['--primary', '--raised', 3],
  // A control's only boundary
  ['--edge', '--background', 3],
  ['--edge', '--panel', 3],
  ['--edge', '--raised', 3],
  ['--edge', '--hover', 3],
  // Selected and current (an ink edge or line), focus, and "now"
  ['--selected', '--background', 3],
  ['--selected', '--panel', 3],
  ['--selected', '--raised', 3],
  ['--selected', '--hover', 3],
  ['--selected', '--wash', 3],
  ['--ring', '--background', 3],
  ['--ring', '--panel', 3],
  ['--ring', '--raised', 3],
  ['--ring', '--hover', 3],
  ['--ring', '--pressed', 3],
  ['--signal', '--background', 3],
  ['--signal', '--panel', 3],
  ['--signal', '--raised', 3],
  ['--signal', '--wash', 3],
  ['--signal', '--bar-current', 3],
  ['--signal', '--score-loop-fill', 3],
  // Status: its colour on the surfaces it sits on and on its own tint
  ['--destructive', '--background', 4.5],
  ['--destructive', '--panel', 4.5],
  ['--destructive', '--raised', 4.5],
  ['--destructive', '--destructive-surface', 4.5],
  ['--destructive-foreground', '--destructive', 4.5],
  ['--foreground', '--destructive-surface', 4.5],
  ['--success', '--background', 4.5],
  ['--success', '--panel', 4.5],
  ['--success', '--raised', 4.5],
  ['--success', '--success-surface', 4.5],
  ['--foreground', '--success-surface', 4.5],
  ['--unsure', '--background', 4.5],
  ['--unsure', '--panel', 4.5],
  ['--unsure', '--raised', 4.5],
  ['--unsure', '--unsure-surface', 4.5],
  ['--foreground', '--unsure-surface', 4.5],
  // Score: every digit is ink; an unsure note's box and "?" carry the unsure hue (§5)
  ['--ink', '--paper', 7],
  ['--ink', '--score-loop-fill', 7],
  ['--ink', '--bar-current', 7],
  ['--conf-medium', '--paper', 7],
  ['--conf-medium', '--score-loop-fill', 7],
  ['--conf-low', '--paper', 7],
  ['--conf-low', '--bar-current', 7],
  ['--conf-low', '--unsure-surface', 4.5],
  ['--conf-medium-edge', '--paper', 3],
  ['--conf-low-edge', '--paper', 4.5],
  ['--conf-low-edge', '--bar-current', 4.5],
  ['--conf-low-edge', '--score-loop-fill', 4.5],
  ['--edited', '--paper', 4.5],
  ['--score-loop-edge', '--paper', 3],
  ['--score-playhead', '--paper', 3],
  ['--score-playhead', '--bar-current', 3],
  ['--staff', '--paper', 3],
  ['--staff', '--score-loop-fill', 3],
  ['--staff', '--bar-current', 3],
  ['--staff', '--raised', 3],
  ['--staff', '--unsure-surface', 3],
  // Stems: the rule beside a stem's name, on the panel and on a sheet
  ['--stem-guitar', '--panel', 3],
  ['--stem-bass', '--panel', 3],
  ['--stem-drums', '--panel', 3],
  ['--stem-vocals', '--panel', 3],
  ['--stem-keys', '--panel', 3],
  ['--stem-other', '--panel', 3],
  ['--stem-mix', '--panel', 3],
  ['--stem-guitar', '--raised', 3],
  ['--stem-bass', '--raised', 3],
  ['--stem-drums', '--raised', 3],
  ['--stem-vocals', '--raised', 3],
  ['--stem-keys', '--raised', 3],
  ['--stem-other', '--raised', 3],
  ['--stem-mix', '--raised', 3],
  // Keyboard diagram: hands against both key colours, their letters on them
  ['--key-black', '--key-white', 3],
  ['--key-left', '--key-white', 3],
  ['--key-left', '--key-black', 3],
  ['--key-right', '--key-white', 3],
  ['--key-right', '--key-black', 3],
  ['--key-left-fg', '--key-left', 4.5],
  ['--key-right-fg', '--key-right', 4.5],
  ['--staff', '--key-white', 3],
  // Guitar and bass Notes: sustain tails and finger rings on the paper and the loop band (the
  // note heads are outlined in --ink; their tint is tested in contrast.test.ts)
  ['--fret-guitar', '--paper', 3],
  ['--fret-guitar', '--score-loop-fill', 3],
  ['--fret-bass', '--paper', 3],
  ['--fret-bass', '--score-loop-fill', 3],
  // Vocal Melody: the note being sung and the rail's pitch now on the paper and the loop band
  ['--melody-vocals', '--paper', 3],
  ['--melody-vocals', '--score-loop-fill', 3],
  // Stem marks: their letters on every stem colour
  ['--tile-foreground', '--stem-guitar', 4.5],
  ['--tile-foreground', '--stem-bass', 4.5],
  ['--tile-foreground', '--stem-drums', 4.5],
  ['--tile-foreground', '--stem-vocals', 4.5],
  ['--tile-foreground', '--stem-keys', 4.5],
  ['--tile-foreground', '--stem-other', 4.5],
  // Song map
  ['--loop-edge', '--background', 3],
  ['--loop-edge', '--panel', 3],
  ['--playhead', '--background', 3],
  ['--playhead', '--loop-fill', 3],
  ['--foreground', '--loop-fill', 4.5],
  ['--waveform-peak', '--background', 3],
  ['--waveform-peak', '--panel', 3],
  ['--waveform-peak', '--loop-fill', 3],
  ['--waveform-rms', '--background', 3],
  ['--waveform-loop', '--loop-fill', 3],
  // Beats
  ['--beat-now', '--background', 3],
  ['--beat-done', '--background', 3],
  ['--beat-slot', '--background', 3],
  ['--beat-slot', '--panel', 3],
  // PedalHud
  ['--hud-fg', '--hud-bg', 4.5],
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
 * Confidence encoding (§5): shape first, colour last. Every digit and chord name stays ink.
 * "Probably" adds a dotted outline in --conf-medium-edge; "Unsure" adds a dashed outline and a "?"
 * in --conf-low-edge, the only place the unsure hue appears. Bands come from
 * docs/specs/05-analysis-schema.md.
 */
export const CONFIDENCE = {
  high: { ink: '--ink', outline: 'none', edge: null, glyph: null },
  medium: { ink: '--conf-medium', outline: 'dotted', edge: '--conf-medium-edge', glyph: null },
  low: { ink: '--conf-low', outline: 'dashed', edge: '--conf-low-edge', glyph: '?' },
} as const satisfies Record<
  string,
  {
    ink: TokenName
    outline: 'none' | 'dotted' | 'dashed'
    edge: TokenName | null
    glyph: string | null
  }
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
 * the web app manifest and `<meta name="theme-color">` (§11). Keyed by appearance id;
 * tokens.test.ts checks them against the CSS.
 */
export const BACKGROUND_HEX = { light: '#fbfbfb', dark: '#0f0f0f' } as const
