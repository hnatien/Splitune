// Geometry of the vocal Melody view (step 18c), shared by the MelodyRoll canvas and the page:
// which pitches are in view, where the now line sits and which phrase a time belongs to. Pure, so
// it's tested without a canvas.

export type MelodyBand = 'high' | 'medium' | 'low'

export interface MelodyRollNote {
  pitch: number // MIDI
  t0: number // seconds on the decoded-PCM timeline
  t1: number
  band: MelodyBand
}

export interface MelodyRollPhrase {
  t0: number
  t1: number
  /** On the marker: "4 · A′". */
  label: string
}

// Degrees against the tonic, named as a major scale's (♭3 in minor).
const DEGREES = ['1', '♭2', '2', '♭3', '3', '4', '♯4', '5', '♭6', '6', '♭7', '7']

/** A pitch's scale degree against the tonic's pitch class: "5", "♭3". */
export function degreeName(pitch: number, tonic: number): string {
  return DEGREES[(((pitch - tonic) % 12) + 12) % 12] as string
}

/** The now line's place across the roll: what was just sung stays in view to its left. */
export const NOW_SHARE = 0.2
/** The pitch window never shows less than an octave, plus this much room over and under. */
export const PITCH_PAD = 2
export const MIN_SPAN = 12

export interface PitchWindow {
  low: number
  high: number
}

/** First index whose onset is at or after `t`. */
export function lowerOnset(notes: readonly { t0: number }[], t: number): number {
  let lo = 0
  let hi = notes.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if ((notes[mid] as { t0: number }).t0 < t) lo = mid + 1
    else hi = mid
  }
  return lo
}

function padded(low: number, high: number): PitchWindow {
  let lo = low - PITCH_PAD
  let hi = high + PITCH_PAD
  while (hi - lo < MIN_SPAN) {
    hi++
    if (hi - lo < MIN_SPAN) lo--
  }
  return { low: lo, high: hi }
}

/** Every pitch of the song: a fixed map. */
export function wholeWindow(notes: readonly MelodyRollNote[]): PitchWindow {
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (const note of notes) {
    if (note.band === 'low') continue
    low = Math.min(low, note.pitch)
    high = Math.max(high, note.pitch)
  }
  return Number.isFinite(low) ? padded(low, high) : padded(60, 60)
}

/** The pitches sung between `t0` and `t1` (low-confidence notes don't stretch it), or `fallback`
 * when nothing is. `notes` by onset, none longer than `longest`. */
export function followWindow(
  notes: readonly MelodyRollNote[],
  t0: number,
  t1: number,
  longest: number,
  fallback: PitchWindow,
): PitchWindow {
  let low = Number.POSITIVE_INFINITY
  let high = Number.NEGATIVE_INFINITY
  for (let i = lowerOnset(notes, t0 - longest); i < notes.length; i++) {
    const note = notes[i] as MelodyRollNote
    if (note.t0 >= t1) break
    if (note.t1 <= t0 || note.band === 'low') continue
    low = Math.min(low, note.pitch)
    high = Math.max(high, note.pitch)
  }
  return Number.isFinite(low) ? padded(low, high) : fallback
}

/** The phrase holding `t` (from its start to the next phrase's), or -1 before the first. */
export function phraseIndexAt(phrases: readonly { t0: number }[], t: number): number {
  return lowerOnset(phrases, t + 1e-6) - 1
}
