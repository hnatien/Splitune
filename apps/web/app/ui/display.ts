import type { Appearance, AppearanceChoice, Distance } from '@splitune/ui-tokens'

// Display preferences → the data-* attributes on <html> that select tokens (doc 26 §2, §6.3, §10).
// Step 10's per-device store persists DisplayPreferences under DISPLAY_STORAGE_KEY and calls
// applyDisplay() on change; the inline head script applies the stored choice before first paint.

export const DISPLAY_STORAGE_KEY = 'splitune.display'

export type DisplayPreferences = {
  appearance: AppearanceChoice
  contrast: 'system' | 'normal' | 'more'
  /** Undefined until chosen: then derived from the pointer and screen size. */
  distance?: Distance | undefined
  readingFont: 'inter' | 'hyperlegible'
  motion: 'system' | 'full' | 'reduce'
  /** Reading-size calibration factor, 0.8 … 1.4 in 0.1 steps (doc 26 §6.3). */
  calibration: number
  /** Score surface (doc 26 §2): paper in every appearance, or matching the appearance. */
  score: 'paper' | 'match'
}

export const DEFAULT_DISPLAY: DisplayPreferences = {
  appearance: 'system',
  contrast: 'system',
  readingFont: 'inter',
  motion: 'system',
  calibration: 1,
  score: 'paper',
}

export type ResolvedDisplay = {
  appearance: Appearance
  contrast: 'normal' | 'more'
  distance: Distance
  readingFont: 'inter' | 'hyperlegible'
  motion: 'full' | 'reduce'
  calibration: number
  score: 'paper' | 'match'
}

/**
 * Resolves preferences against media queries and writes the attributes. Self-contained (no
 * references outside its body) because the head script inlines its source with toString().
 */
export function applyDisplay(
  preferences: Partial<DisplayPreferences>,
  root: HTMLElement,
  matchMedia: (query: string) => { matches: boolean },
): ResolvedDisplay {
  const media = (query: string) => matchMedia(query).matches
  const appearance =
    preferences.appearance === 'light' ||
    preferences.appearance === 'dark' ||
    preferences.appearance === 'stage'
      ? preferences.appearance
      : media('(prefers-color-scheme: dark)')
        ? 'dark'
        : 'light'
  const contrast =
    preferences.contrast === 'normal' || preferences.contrast === 'more'
      ? preferences.contrast
      : media('(prefers-contrast: more)')
        ? 'more'
        : 'normal'
  const motion =
    preferences.motion === 'full' || preferences.motion === 'reduce'
      ? preferences.motion
      : media('(prefers-reduced-motion: reduce)')
        ? 'reduce'
        : 'full'
  const coarse = media('(pointer: coarse)')
  const phone = coarse && (media('(max-width: 640px)') || media('(max-height: 640px)'))
  const distance =
    preferences.distance === 'desk' ||
    preferences.distance === 'stand' ||
    preferences.distance === 'floor'
      ? preferences.distance
      : phone
        ? 'floor'
        : coarse
          ? 'stand'
          : 'desk'
  const readingFont = preferences.readingFont === 'hyperlegible' ? 'hyperlegible' : 'inter'
  const requested = Number(preferences.calibration)
  const calibration =
    Number.isFinite(requested) && requested > 0 ? Math.min(1.4, Math.max(0.8, requested)) : 1
  const score = preferences.score === 'match' ? 'match' : 'paper'

  root.setAttribute('data-appearance', appearance)
  root.classList.toggle('dark', appearance !== 'light')
  root.setAttribute('data-contrast', contrast)
  root.setAttribute('data-motion', motion)
  root.setAttribute('data-distance', distance)
  root.setAttribute('data-reading-font', readingFont)
  root.setAttribute('data-score', score)
  root.style.setProperty('--read-calibration', String(calibration))
  return { appearance, contrast, distance, readingFont, motion, calibration, score }
}

/** Reads stored preferences; anything unreadable falls back to the defaults (System). */
export function readStoredDisplay(storage: Pick<Storage, 'getItem'>): Partial<DisplayPreferences> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(DISPLAY_STORAGE_KEY) ?? '{}')
    return parsed !== null && typeof parsed === 'object'
      ? (parsed as Partial<DisplayPreferences>)
      : {}
  } catch {
    return {}
  }
}

/**
 * Inline <head> script (before any stylesheet paints): applies the stored choice so the page never
 * flashes the wrong appearance. Storage can throw (privacy modes); the media queries still apply.
 * Without JS the prefers-* fallbacks in @splitune/ui-tokens/themes.css take over.
 */
export const DISPLAY_SCRIPT = `(function(){var p={};try{p=JSON.parse(localStorage.getItem(${JSON.stringify(
  DISPLAY_STORAGE_KEY,
)})||'{}')||{}}catch(e){}(${applyDisplay.toString()})(p,document.documentElement,function(q){return window.matchMedia(q)})})()`
