import * as alphaTab from '@coderline/alphatab'
import type { InkColors } from './score.ts'
import type { ConfidenceLevel } from './types.ts'

// Fonts and colours of the rendered score from the Night Rehearsal tokens (12 §3, 26 §4.7, §6): the
// tab digits in the reading mono family at the distance preset's size, chord names over the bars at
// `--read-chord`, bar numbers in mono, light ink on the page in both themes, staff lines and bar
// lines in `--staff`, rhythm stems and beams (stamped per beat, score.ts) in `--faint-foreground`.
// Re-applied when the appearance, contrast, distance or reading font changes.

export interface ScoreTheme {
  /** Reading family stack for tab digits, e.g. `"JetBrains Mono", ui-monospace`. */
  family: string
  /** Mono family for bar numbers (defaults to `family`). */
  monoFamily?: string
  /** Fret digit size in CSS px (--read-tab). */
  tabPx: number
  /** Chord names over the bars in CSS px (--read-chord; 0.75 × the digits without it). */
  chordPx?: number
  /** Bar number size in CSS px (--read-bar-number). */
  barNumberPx: number
  /** CSS colours (readColor), per confidence level, and for notes the learner edited. */
  ink: Record<ConfidenceLevel, string> & { edited?: string }
  staff: string
  /** Rhythm stems and beams under the tab (--faint-foreground; the ink without it). */
  rhythm?: string
}

const toColor = (css: string) =>
  alphaTab.model.Color.fromJson(css) ?? new alphaTab.model.Color(0, 0, 0)

/** The theme's ink as alphaTab colours, for NoteStyle and BeatStyle (applyInk). */
export function inkColors(theme: ScoreTheme): InkColors {
  return {
    high: toColor(theme.ink.high),
    medium: toColor(theme.ink.medium),
    low: toColor(theme.ink.low),
    ...(theme.ink.edited ? { edited: toColor(theme.ink.edited) } : {}),
    ...(theme.rhythm ? { rhythm: toColor(theme.rhythm) } : {}),
  }
}

const font = (family: string, px: number, weight = alphaTab.model.FontWeight.Bold) => {
  const value = new alphaTab.model.Font(family, px, alphaTab.model.FontStyle.Plain, weight)
  value.families = family.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))
  return value
}

/** Inter's digits are about 0.73 em tall: 0.92 em lines leave ~2 px above and below each digit. */
const TAB_LINE_RATIO = 0.92

/**
 * Tab line spacing for a fret-digit size, so a stacked chord keeps a gap between its digits.
 * Bravura's default (1.5 staff spaces) suits small digits; at reading sizes they overlapped.
 */
export function tabLineSpacing(tabPx: number): number {
  return Math.max(
    alphaTab.EngravingSettings.bravuraDefaults.tabLineSpacing,
    Math.ceil(tabPx * TAB_LINE_RATIO),
  )
}

export function applyTheme(settings: alphaTab.Settings, theme: ScoreTheme): void {
  const resources = settings.display.resources
  // Each Settings owns a copy of the engraving defaults (bravuraDefaults clones them).
  resources.engravingSettings.tabLineSpacing = tabLineSpacing(theme.tabPx)
  resources.tablatureFont = font(theme.family, theme.tabPx)
  // Chord names over the bars: the reading family, bold, three quarters of the digit size.
  resources.elementFonts.set(
    alphaTab.NotationElement.EffectChordNames,
    font(theme.family, Math.round(theme.chordPx ?? theme.tabPx * 0.75)),
  )
  resources.barNumberFont = font(
    theme.monoFamily ?? theme.family,
    theme.barNumberPx,
    alphaTab.model.FontWeight.Regular,
  )
  resources.fretboardNumberFont = font(
    theme.family,
    theme.barNumberPx,
    alphaTab.model.FontWeight.Regular,
  )
  const ink = inkColors(theme)
  resources.mainGlyphColor = ink.high
  resources.secondaryGlyphColor = ink.medium
  resources.scoreInfoColor = ink.high
  resources.barNumberColor = ink.high
  resources.staffLineColor = toColor(theme.staff)
  resources.barSeparatorColor = toColor(theme.staff)
}
