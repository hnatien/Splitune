import * as alphaTab from '@coderline/alphatab'
import type { ConfidenceLevel } from './types.ts'

// Fonts and colours of the rendered score from the Music Stand tokens (12 §3, 26 §6.1): the tab
// digits, bar numbers and chord-diagram numbers in the active reading family at the distance
// preset's size, staff and glyph colours from the score tokens. Re-applied when the appearance,
// distance or reading font changes.

export interface ScoreTheme {
  /** Reading family stack, e.g. `Inter, ui-sans-serif`. */
  family: string
  /** Fret digit size in CSS px (--read-tab). */
  tabPx: number
  /** Bar number size in CSS px (--read-bar-number). */
  barNumberPx: number
  /** CSS colours (readColor), per confidence level. */
  ink: Record<ConfidenceLevel, string>
  staff: string
}

const toColor = (css: string) =>
  alphaTab.model.Color.fromJson(css) ?? new alphaTab.model.Color(0, 0, 0)

/** The theme's ink as alphaTab colours, for NoteStyle (applyInk). */
export function inkColors(theme: ScoreTheme): Record<ConfidenceLevel, alphaTab.model.Color> {
  return {
    high: toColor(theme.ink.high),
    medium: toColor(theme.ink.medium),
    low: toColor(theme.ink.low),
  }
}

const font = (family: string, px: number, weight = alphaTab.model.FontWeight.Bold) => {
  const value = new alphaTab.model.Font(family, px, alphaTab.model.FontStyle.Plain, weight)
  value.families = family.split(',').map((f) => f.trim().replace(/^["']|["']$/g, ''))
  return value
}

export function applyTheme(settings: alphaTab.Settings, theme: ScoreTheme): void {
  const resources = settings.display.resources
  resources.tablatureFont = font(theme.family, theme.tabPx)
  resources.barNumberFont = font(theme.family, theme.barNumberPx, alphaTab.model.FontWeight.Regular)
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
