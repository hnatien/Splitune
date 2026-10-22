// Shared shapes of the notation view (12 §3). Times are seconds on the decoded-PCM timeline.

export type ConfidenceLevel = 'high' | 'medium' | 'low'

/** How one rendered note is marked (26 §5): confidence ink + outline, timing flag, octave move. */
export interface NoteMark {
  level: ConfidenceLevel
  /** Onset far from the grid (quantize residual): dotted underline. */
  timingFlagged?: boolean
  /** Played an octave higher/lower than recorded (unplayable with a position). */
  octave?: '8va' | '8vb'
}

/** Rendered alphaTab note (bar, voice, beat, note index) → note id; music-core's `noteMap`. */
export interface NoteRef {
  noteId: string
  bar: number
  voice: number
  beat: number
  note: number
  string: number
}

/**
 * The beat grid as the view needs it: alphaTab bar 0 is grid bar `firstBar`; `beatsOf(bar)` gives
 * a grid bar's metric beat times (downbeat first), extrapolated past the detected beats.
 */
export interface BarTimes {
  firstBar: number
  beatsOf: (bar: number) => number[]
}

/**
 * The time axis of the rendered bars: alphaTab bar i is grid bar `firstBar + i`; `bars[i].beats`
 * are its metric beat times (the first is the downbeat) and `end` is when the last bar ends.
 */
export interface NotationTimeline {
  firstBar: number
  bars: { beats: number[] }[]
  end: number
}

/** A marker on the beat for a note without a position ("!", 26 §5). */
export interface BeatMarker {
  noteId: string
  time: number
  label: string
}

export interface Rect {
  x: number
  y: number
  w: number
  h: number
}
