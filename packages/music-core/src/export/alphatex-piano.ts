import { type BeatGrid, PPQ } from '../grid/beatgrid.ts'
import { pcOfName } from '../harmony/chordtools.ts'
import { keyNoteNames } from '../harmony/key.ts'
import type { Hand } from '../piano/hands.ts'
import type { Key } from '../types.ts'
import { type Bar, barsToRender, barZeroTick, quote, split } from './alphatex-bars.ts'

// Grand-staff alphaTex for transcribed piano (21 V4 staff view), alphaTab 1.8 syntax (verified
// with the 1.8.4 importer in test/piano-alphatex.test.ts):
// - one track, two `\staff {score}` staves: the right hand on the treble clef, the left on the
//   bass clef (`\clef F4`), either changing clef for bars where its hand moves far over (clefsOf);
// - pitched notes spelled for the key (`Eb4`, `F#3`) under its `\ks` key signature;
// - ties by the `t` note property (a pitched note has no string to tie by), `{d}` and `{tu 3}` as
//   in the tab;
// - each hand writes up to two `\voice`s: a chord that keeps ringing over the hand's next onset
//   moves to a second voice, so a held bass note sits under a moving line (stems up in the first
//   voice, down in the second).
// Bars, durations and pickups follow the tab writer (alphatex-bars.ts); `noteMap` carries the
// staff as well as bar, voice, beat and note.

export interface PianoTexNote {
  noteId: string
  pitch: number // MIDI
  hand: Hand
  onTick: number
  offTick: number
}

export interface PianoAlphaTexInput {
  grid: BeatGrid
  meterDenominator: number
  tempo: number
  notes: readonly PianoTexNote[]
  swingBars: readonly number[]
  key?: Pick<Key, 'tonic' | 'mode'>
  title?: string
}

export interface PianoNoteRef {
  noteId: string
  staff: number // 0 = treble (right hand), 1 = bass (left hand)
  bar: number // alphaTab bar index (0 = first rendered bar)
  voice: number
  beat: number // beat index within the voice
  note: number // index within the beat's notes, low to high as written
}

export interface PianoAlphaTexResult {
  tex: string
  firstBar: number // grid bar shown as alphaTab bar 0 (-1 when there is a pickup bar)
  noteMap: PianoNoteRef[]
}

const VOICES = 2
// A note ringing less than an eighth into the hand's next onset is legato, not a held voice: it
// ends there.
const HOLD_MIN = PPQ / 2

interface Chord {
  onTick: number
  endTick: number
  notes: PianoTexNote[]
}

const top = (notes: readonly PianoTexNote[]) => Math.max(...notes.map((n) => n.pitch))

// One hand's notes as chords in up to VOICES voices, each voice a sequence of chords that don't
// overlap. The higher part takes the first free voice (stems up); a held part in the hand's lower
// half (a bass note under a moving line) the last.
function voicesOf(notes: readonly PianoTexNote[]): Chord[][] {
  const voices: Chord[][] = Array.from({ length: VOICES }, () => [])
  const pitches = notes.map((n) => n.pitch).sort((a, b) => a - b)
  const middle = pitches[pitches.length >> 1] ?? 0
  const byTick = new Map<number, PianoTexNote[]>()
  for (const n of notes) byTick.set(n.onTick, [...(byTick.get(n.onTick) ?? []), n])
  const ticks = [...byTick.keys()].sort((a, b) => a - b)
  ticks.forEach((tick, g) => {
    const next = ticks[g + 1] ?? Number.POSITIVE_INFINITY
    const group = byTick.get(tick) as PianoTexNote[]
    const held = group.filter((n) => n.offTick >= next + HOLD_MIN)
    const moving = group.filter((n) => n.offTick < next + HOLD_MIN)
    const clusters = [
      { notes: moving, end: Math.min(next, Math.max(...moving.map((n) => n.offTick))), low: false },
      { notes: held, end: Math.max(...held.map((n) => n.offTick)), low: top(held) <= middle },
    ]
      .filter((c) => c.notes.length > 0)
      .sort((a, b) => top(b.notes) - top(a.notes))
    let placed: Chord | undefined
    for (const cluster of clusters) {
      const isFree = (v: Chord[]) => (v.at(-1)?.endTick ?? Number.NEGATIVE_INFINITY) <= tick
      const free = cluster.low ? voices.findLastIndex(isFree) : voices.findIndex(isFree)
      if (free === -1 && placed !== undefined) {
        // No voice left: the part joins the chord already written on this onset, at its length.
        placed.notes.push(...cluster.notes)
        continue
      }
      let index = free
      if (index === -1) {
        // Every voice still rings: the one that would end first stops here.
        index = 0
        voices.forEach((v, i) => {
          if ((v.at(-1)?.endTick ?? 0) < (voices[index]?.at(-1)?.endTick ?? 0)) index = i
        })
        ;(voices[index]?.at(-1) as Chord).endTick = tick
      }
      const chord = { onTick: tick, endTick: cluster.end, notes: [...cluster.notes] }
      voices[index]?.push(chord)
      placed ??= chord
    }
  })
  for (const voice of voices)
    for (const chord of voice) chord.notes.sort((a, b) => a.pitch - b.pitch)
  const used = voices.filter((v) => v.length > 0)
  return used.length > 0 ? used : [[]]
}

// Each bar's clef on a staff: treble or bass by where the bar's notes sit, changing only when the
// bar's middle note is well past middle C (a left hand that climbs, a right hand that dips), so a
// short excursion stays on ledger lines. Bars without onsets keep the clef.
const TREBLE_FROM = 64 // E4: a bass-clef bar turns treble at or above
const BASS_BELOW = 56 // A♭3: a treble-clef bar turns bass below
type Clef = 'G2' | 'F4'

function clefsOf(notes: readonly PianoTexNote[], bars: readonly Bar[], initial: Clef): Clef[] {
  let clef = initial
  return bars.map((bar) => {
    const pitches = notes
      .filter((n) => n.onTick >= bar.startTick && n.onTick < bar.endTick)
      .map((n) => n.pitch)
      .sort((a, b) => a - b)
    const middle = pitches[pitches.length >> 1]
    if (middle === undefined) return clef
    if (clef === 'F4' && middle >= TREBLE_FROM) clef = 'G2'
    else if (clef === 'G2' && middle < BASS_BELOW) clef = 'F4'
    return clef
  })
}

// alphaTex pitch: the key's spelling of the pitch class, the octave of its letter (B#3 is C4).
function speller(key: Pick<Key, 'tonic' | 'mode'>): (midi: number) => string {
  const names = keyNoteNames(key)
  return (midi) => {
    const name = names[midi % 12] as string
    const letter = name.charAt(0)
    const shift = [...name.slice(1)].reduce((s, c) => s + (c === '#' ? 1 : -1), 0)
    const octave = Math.round((midi - shift - (pcOfName(letter) as number)) / 12) - 1
    return `${letter}${name.slice(1).replaceAll('##', 'x')}${octave}`
  }
}

function keySignature(key: Pick<Key, 'tonic' | 'mode'>): string | undefined {
  const tonic = pcOfName(key.tonic)
  return tonic === null ? undefined : `${keyNoteNames(key)[tonic]}${key.mode}`
}

export function toPianoAlphaTex(input: PianoAlphaTexInput): PianoAlphaTexResult {
  const key = input.key ?? { tonic: 'C', mode: 'major' as const }
  const name = speller(key)
  const ks = keySignature(key)
  const contentStart = Math.min(barZeroTick(input.grid), ...input.notes.map((n) => n.onTick))
  const contentEnd = Math.max(1, ...input.notes.map((n) => n.offTick))
  const bars = barsToRender(input.grid, contentStart, contentEnd)
  const swing = new Set(input.swingBars)
  const noteMap: PianoNoteRef[] = []

  // One voice of one staff, bar by bar (an empty string leaves a second voice's bar empty).
  const voiceBars = (chords: readonly Chord[], staff: number, voice: number): string[] =>
    bars.map((bar: Bar, barNumber) => {
      const inBar = chords.filter((c) => c.endTick > bar.startTick && c.onTick < bar.endTick)
      if (inBar.length === 0 && voice > 0) return ''
      const isSwing = swing.has(bar.bar)
      const tokens: string[] = []
      const write = (from: number, to: number, content: (piece: number) => string) => {
        split(from - bar.startTick, to - from, isSwing).forEach((d, piece) => {
          tokens.push(
            `${content(piece)}.${d.token}${d.props.length > 0 ? ` {${d.props.join(' ')}}` : ''}`,
          )
        })
      }
      let at = bar.startTick
      for (const chord of inBar) {
        const start = Math.max(chord.onTick, bar.startTick)
        const end = Math.min(chord.endTick, bar.endTick)
        write(at, start, () => 'r')
        write(start, end, (piece) => {
          const fresh = piece === 0 && start === chord.onTick
          if (fresh) {
            chord.notes.forEach((n, note) => {
              noteMap.push({
                noteId: n.noteId,
                staff,
                bar: barNumber,
                voice,
                beat: tokens.length,
                note,
              })
            })
          }
          const notes = chord.notes.map((n) => (fresh ? name(n.pitch) : `${name(n.pitch)}{t}`))
          return notes.length > 1 ? `(${notes.join(' ')})` : (notes[0] as string)
        })
        at = end
      }
      write(at, bar.endTick, () => 'r')
      return tokens.join(' ')
    })

  const lines: string[] = []
  if (input.title !== undefined) lines.push(`\\title ${quote(input.title)}`)
  lines.push(`\\track ${quote('Piano')}`)
  ;(['right', 'left'] as const).forEach((hand, staff) => {
    // The piano program also writes the notes at pitch (alphaTab's default staff is a guitar's,
    // written an octave up).
    lines.push(
      `\\staff {score} \\tuning piano${staff === 0 ? ' \\instrument acousticgrandpiano' : ''}`,
    )
    const notes = input.notes.filter((n) => n.hand === hand)
    // A staff starts on treble (alphaTab's default); the left hand's starts on bass.
    const clefs = clefsOf(notes, bars, staff === 0 ? 'G2' : 'F4')
    const voices = voicesOf(notes)
    voices.forEach((chords, voice) => {
      const texts = voiceBars(chords, staff, voice)
      if (voice === 0) {
        let previousLength = -1
        bars.forEach((bar, barNumber) => {
          const tags: string[] = []
          const clef = clefs[barNumber] as Clef
          if (clef !== (barNumber === 0 ? 'G2' : clefs[barNumber - 1])) tags.push(`\\clef ${clef}`)
          if (staff === 0 && bar.length !== previousLength) {
            tags.push(`\\ts (${bar.length} ${input.meterDenominator})`)
          }
          previousLength = bar.length
          if (staff === 0 && barNumber === 0) {
            tags.push(`\\tempo ${Math.max(1, Math.round(input.tempo))}`)
          }
          // Each staff carries its own key signature.
          if (barNumber === 0 && ks !== undefined) tags.push(`\\ks ${ks}`)
          if (staff === 0 && bar.pickup) tags.push('\\ac')
          texts[barNumber] = [...tags, texts[barNumber]].join(' ')
        })
      }
      if (voices.length > 1) lines.push('\\voice')
      lines.push(texts.join(' |\n'))
    })
  })
  return { tex: `${lines.join('\n')}\n`, firstBar: bars[0]?.bar ?? 0, noteMap }
}
