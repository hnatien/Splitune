import type { BeatGrid } from '../grid/beatgrid.ts'
import { pcName } from '../harmony/chordtools.ts'
import { barsToRender, barZeroTick, type Duration, quote, split } from './alphatex-bars.ts'

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
  bendCents?: number // the note's largest bend, written as a bend up and hold
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

function noteName(midi: number): string {
  return `${pcName(midi, 'sharp')}${Math.floor(midi / 12) - 1}`
}

function bend(cents: number | undefined): string {
  const quarters = Math.round((cents ?? 0) / 50)
  return quarters > 0 ? `{b (0 ${quarters})}` : ''
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
              ? `${(e.fret as number) - input.capo}.${e.string}${bend(e.bendCents)}`
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
