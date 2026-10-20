import { type BeatGrid, barOfBeat, beatLabel, PPQ } from '../grid/beatgrid.ts'
import { pcName } from '../harmony/chordtools.ts'

// alphaTex for alphaTab 1.8 (07-music-algorithms.md §8, syntax verified against
// alphatab.net/docs/alphatex and the 1.8.4 importer in test/alphatex.test.ts):
// - no `.` section separators (dropped in 1.7); \tempo and \ts are bar-level tags;
// - notes are `fret.string` with string 1 = highest and frets relative to the capo;
// - durations per beat (`3.2.8`, `(0.1 2.2).4`, `r.4`), dots `{d}`, triplets `{tu 3}`,
//   ties `-.string`, chord names `{ch "Am"}`, pickup bars `\ac`.
// alphaTex has no user-defined note properties, so confidence styling goes through `noteMap`:
// the renderer maps each rendered note (bar, voice, beat, note index) → note id, then applies
// NoteStyle and an overlay positioned from boundsLookup (doc 26 §5).

export interface AlphaTexEvent {
  noteId: string
  onTick: number
  offTick: number
  string?: number
  fret?: number // absolute (from the nut)
}

export interface AlphaTexChord {
  onTick: number // already snapped to the grid
  name: string // display name, e.g. "Am7"
}

export interface AlphaTexInput {
  grid: BeatGrid
  tuningMidi: readonly number[]
  capo: number
  meterDenominator: number
  tempo: number
  events: readonly AlphaTexEvent[]
  chords: readonly AlphaTexChord[]
  swingBars: readonly number[]
  title?: string
  trackName?: string
  chordNames?: boolean // write chord names as beat text; off by default (the chord strip shows them)
}

export interface AlphaTexNoteRef {
  noteId: string
  bar: number // alphaTab bar index (0 = first rendered bar)
  voice: number // always 0: one voice per staff
  beat: number // beat index within the voice
  note: number // index within the beat's notes, in the order written (Beat.notes order)
  string: number
}

export interface AlphaTexResult {
  tex: string
  firstBar: number // grid bar shown as alphaTab bar 0 (-1 when there is a pickup bar)
  noteMap: AlphaTexNoteRef[]
}

interface Duration {
  ticks: number
  token: string // duration value after the dot
  props: string[] // beat properties
  unit: number // start alignment within the bar
}

// A duration may start only on a multiple of `unit`; dotted values need twice their base unit
// so splits read like ordinary notation (♪. ♬ on the beat, never mid-beat).
const STRAIGHT_DURATIONS: Duration[] = [
  { ticks: 3840, token: '1', props: [], unit: 3840 },
  { ticks: 2880, token: '2', props: ['d'], unit: 3840 },
  { ticks: 1920, token: '2', props: [], unit: 1920 },
  { ticks: 1440, token: '4', props: ['d'], unit: 1920 },
  { ticks: 960, token: '4', props: [], unit: 960 },
  { ticks: 720, token: '8', props: ['d'], unit: 960 },
  { ticks: 480, token: '8', props: [], unit: 480 },
  { ticks: 360, token: '16', props: ['d'], unit: 480 },
  { ticks: 240, token: '16', props: [], unit: 240 },
  { ticks: 120, token: '32', props: [], unit: 120 },
]

// Swing bars hold only whole beats (or longer) and triplet eighths, so every tuplet group is a
// complete beat of three.
const SWING_DURATIONS: Duration[] = [
  ...STRAIGHT_DURATIONS.filter((d) => d.ticks >= 960),
  { ticks: 320, token: '8', props: ['tu 3'], unit: 320 },
]

function split(pos: number, length: number, swing: boolean): Duration[] {
  const table = swing ? SWING_DURATIONS : STRAIGHT_DURATIONS
  const out: Duration[] = []
  let p = pos
  let remaining = length
  while (remaining > 0) {
    const d = table.find((x) => x.ticks <= remaining && p % x.unit === 0)
    if (d === undefined) {
      throw new Error(`alphaTex: cannot express ${remaining} ticks at ${p} (swing=${swing})`)
    }
    out.push(d)
    p += d.ticks
    remaining -= d.ticks
  }
  return out
}

function quote(text: string): string {
  return `"${text.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`
}

function noteName(midi: number): string {
  return `${pcName(midi, 'sharp')}${Math.floor(midi / 12) - 1}`
}

interface Bar {
  bar: number
  startTick: number // first rendered tick (later than the bar start for a pickup)
  endTick: number
  length: number // nominal beats
  pickup: boolean
}

function barZeroTick(grid: BeatGrid): number {
  let beat = 0
  while (beatLabel(grid, beat).bar < 0) beat++
  while (beatLabel(grid, beat).bar > 0 || beatLabel(grid, beat).beat > 1) beat--
  return beat * PPQ
}

function barsToRender(grid: BeatGrid, contentStart: number, contentEnd: number): Bar[] {
  const out: Bar[] = []
  let beat = Math.floor(contentStart / PPQ)
  const first = barOfBeat(grid, beat)
  const pickup = beatLabel(grid, first.start).bar === -1
  if (!pickup) {
    // Start at bar 0 so the score lines up with the beat grid from the first downbeat.
    while (beatLabel(grid, barOfBeat(grid, beat).start).bar > 0)
      beat = barOfBeat(grid, beat).start - 1
  }
  let { start, length } = barOfBeat(grid, beat)
  if (pickup) {
    out.push({
      bar: -1,
      startTick: beat * PPQ,
      endTick: (start + length) * PPQ,
      length,
      pickup: true,
    })
    ;({ start, length } = barOfBeat(grid, start + length))
  }
  while (out.length === 0 || start * PPQ < contentEnd) {
    out.push({
      bar: beatLabel(grid, start).bar,
      startTick: start * PPQ,
      endTick: (start + length) * PPQ,
      length,
      pickup: false,
    })
    ;({ start, length } = barOfBeat(grid, start + length))
  }
  return out
}

export function toAlphaTex(input: AlphaTexInput): AlphaTexResult {
  const placed = input.events.filter((e) => e.string !== undefined && e.fret !== undefined)
  const onsets = new Map<number, AlphaTexEvent[]>()
  for (const e of placed) onsets.set(e.onTick, [...(onsets.get(e.onTick) ?? []), e])
  const chordAt = new Map<number, string>()
  if (input.chordNames === true) for (const c of input.chords) chordAt.set(c.onTick, c.name)
  const ticks = [...onsets.keys(), ...chordAt.keys()]
  const contentStart = Math.min(barZeroTick(input.grid), ...ticks)
  const contentEnd = Math.max(
    1,
    ...placed.map((e) => e.offTick),
    ...[...chordAt.keys()].map((t) => t + 1),
  )
  const bars = barsToRender(input.grid, contentStart, contentEnd)
  const swing = new Set(input.swingBars)
  const boundaries = [
    ...new Set([...ticks, ...bars.flatMap((b) => [b.startTick, b.endTick])]),
  ].sort((a, b) => a - b)

  const lines: string[] = []
  if (input.title !== undefined) lines.push(`\\title ${quote(input.title)}`)
  lines.push(`\\track ${quote(input.trackName ?? 'Guitar')}`)
  lines.push('\\staff {tabs}')
  lines.push(`\\tuning (${input.tuningMidi.map(noteName).join(' ')})`)
  if (input.capo > 0) lines.push(`\\capo ${input.capo}`)

  const noteMap: AlphaTexNoteRef[] = []
  let sounding: AlphaTexEvent[] = [] // notes carried into the next slot as ties
  let previousLength = -1
  const barTexts = bars.map((bar, barNumber) => {
    const tokens: string[] = []
    if (bar.length !== previousLength) tokens.push(`\\ts (${bar.length} ${input.meterDenominator})`)
    previousLength = bar.length
    if (barNumber === 0) tokens.push(`\\tempo ${Math.max(1, Math.round(input.tempo))}`)
    if (bar.pickup) tokens.push('\\ac')
    const isSwing = swing.has(bar.bar)
    let beatIndex = 0
    const slots = boundaries.filter((t) => t >= bar.startTick && t < bar.endTick)
    slots.forEach((slotStart, k) => {
      const slotEnd = slots[k + 1] ?? bar.endTick
      const fresh = onsets.get(slotStart) ?? []
      const freshStrings = new Set(fresh.map((e) => e.string))
      const tied =
        fresh.length > 0
          ? []
          : sounding.filter((e) => e.offTick > slotStart && !freshStrings.has(e.string))
      const notes = fresh.length > 0 ? fresh : tied
      const soundEnd =
        notes.length === 0 ? slotStart : Math.min(slotEnd, Math.max(...notes.map((e) => e.offTick)))
      sounding = notes.filter((e) => e.offTick > slotEnd)
      const chord = chordAt.get(slotStart)
      const pieces: { d: Duration; content: string; first: boolean }[] = []
      split(slotStart - bar.startTick, soundEnd - slotStart, isSwing).forEach((d, i) => {
        const content = notes
          .map((e) =>
            i === 0 && fresh.length > 0
              ? `${(e.fret as number) - input.capo}.${e.string}`
              : `-.${e.string}`,
          )
          .join(' ')
        pieces.push({
          d,
          content: notes.length > 1 ? `(${content})` : content,
          first: i === 0 && fresh.length > 0,
        })
      })
      split(soundEnd - bar.startTick, slotEnd - soundEnd, isSwing).forEach((d) => {
        pieces.push({ d, content: 'r', first: false })
      })
      pieces.forEach((piece, i) => {
        const props = [...piece.d.props]
        if (i === 0 && chord !== undefined) props.push(`ch ${quote(chord)}`)
        if (piece.first) {
          fresh.forEach((e, note) => {
            noteMap.push({
              noteId: e.noteId,
              bar: barNumber,
              voice: 0,
              beat: beatIndex,
              note,
              string: e.string as number,
            })
          })
        }
        tokens.push(
          `${piece.content}.${piece.d.token}${props.length > 0 ? ` {${props.join(' ')}}` : ''}`,
        )
        beatIndex++
      })
    })
    return tokens.join(' ')
  })
  lines.push(barTexts.join(' |\n'))
  return { tex: `${lines.join('\n')}\n`, firstBar: bars[0]?.bar ?? 0, noteMap }
}
