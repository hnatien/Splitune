// Regenerates golden/*.json: language-neutral cases ({ command, input, expected }) that the
// Vitest suite (and a future Rust port) replays through the CLI commands. Review the diff of
// `expected` before committing: it is the reference behaviour.
//   pnpm --filter @splitune/music-core golden:update
import { writeFileSync } from 'node:fs'
import { COMMANDS } from '../src/cli.ts'
import { fixtures, makeBeats, makeChords, makeNotes } from '../test/helpers.ts'

const ops = fixtures.corrections()

const pickupNotes = makeNotes([
  { id: 'p0', onset_s: 0.5, offset_s: 0.75, pitch_midi: 59 },
  { id: 'p1', onset_s: 0.75, offset_s: 1, pitch_midi: 60 },
  { id: 'd0', onset_s: 1, offset_s: 2, pitch_midi: 45 },
  { id: 'd1', onset_s: 1, offset_s: 2, pitch_midi: 64 },
  { id: 'd2', onset_s: 1.5, offset_s: 2, pitch_midi: 60 },
  { id: 'd3', onset_s: 2, offset_s: 3, pitch_midi: 57 },
])

// Piano notes as [pitch, onset_s, offset_s].
const pianoNotes = (rows: [number, number, number][]) =>
  makeNotes(
    rows.map(([pitch_midi, onset_s, offset_s]) => ({ pitch_midi, onset_s, offset_s })),
    'piano',
  )

// Two hands in E♭ (the chords' key is written D#): a melody over a held B♭, a bass E♭ held under
// a moving left hand, a tie over the bar line.
const twoHands = pianoNotes([
  [79, 0.5, 1],
  [80, 1, 1.5],
  [82, 1.5, 2],
  [87, 2, 3.5],
  [86, 3.5, 4.5],
  [70, 0.5, 2.5],
  [39, 0.5, 4.5],
  [46, 1, 1.5],
  [51, 1.5, 2],
  [55, 2, 2.5],
  [44, 2.5, 3.5],
  [48, 2.5, 3.5],
])

// A pickup into A minor, its leading tone spelled G#.
const pianoPickup = pianoNotes([
  [76, 0.5, 1],
  [69, 1, 2],
  [72, 1, 3],
  [76, 1, 3],
  [45, 1, 3],
  [52, 1.5, 2],
  [68, 3, 3.5],
  [69, 3.5, 5],
  [40, 3, 5],
])

const CASES: Record<string, { command: string; input: unknown }> = {
  'key.fixture': {
    command: 'key',
    input: { segments: fixtures.chords().segments },
  },
  'build-tab.fixture-corrected': {
    command: 'build-tab',
    input: {
      notes: fixtures.notes(),
      beats: fixtures.beats(),
      chords: fixtures.chords(),
      corrections: { notes: ops, beats: ops, chords: ops, beats_rev: 11 },
      options: { title: 'Fixture', chord_names: true },
    },
  },
  'build-tab.fixture-plain': {
    command: 'build-tab',
    input: { notes: fixtures.notes(), beats: fixtures.beats(), chords: fixtures.chords() },
  },
  'build-tab.pickup': {
    command: 'build-tab',
    input: {
      notes: pickupNotes,
      beats: makeBeats({ bpm: 120, bars: 2, pickup: 1, start: 0.5 }),
      chords: makeChords([{ t0: 1, t1: 5, label: 'A:min' }]),
      options: { chord_names: true },
    },
  },
  'build-tab.capo-simplified': {
    command: 'build-tab',
    input: {
      notes: fixtures.notes(),
      beats: fixtures.beats(),
      chords: fixtures.chords(),
      options: { capo: 2, level: 'simplified', fingering_mode: 'as_played' },
    },
  },
  'build-tab.bass-roots': {
    command: 'build-tab',
    input: {
      notes: makeNotes(
        [33, 45, 40, 41, 36, 48].map((p, i) => ({ onset_s: 0.5 + i * 0.5, pitch_midi: p })),
        'bass',
      ),
      beats: makeBeats({ bars: 2 }),
      chords: makeChords([
        { t0: 0.5, t1: 2.5, label: 'A:min' },
        { t0: 2.5, t1: 4.5, label: 'F:maj/3' },
      ]),
      options: { level: 'roots' },
    },
  },
  'build-piano.two-hands': {
    command: 'build-piano',
    input: {
      notes: twoHands,
      beats: makeBeats({ bars: 2 }),
      chords: {
        ...makeChords([{ t0: 0.5, t1: 4.5, label: 'D#:maj' }]),
        key: { tonic: 'D#', mode: 'major', confidence: 0.8 },
      },
      options: { title: 'Two hands' },
    },
  },
  'build-piano.pickup': {
    command: 'build-piano',
    input: {
      notes: pianoPickup,
      beats: makeBeats({ bars: 2, pickup: 1 }),
      chords: {
        ...makeChords([{ t0: 1, t1: 5, label: 'A:min' }]),
        key: { tonic: 'A', mode: 'minor', confidence: 0.8 },
      },
    },
  },
  'quantize.fixture-nudged': {
    command: 'quantize',
    input: { notes: fixtures.notes(), beats: fixtures.beats(), corrections: { beats: [ops[0]] } },
  },
  'fret.open-chords': {
    command: 'fret',
    input: {
      notes: [
        ...[48, 52, 55, 60, 64].map((p, i) => ({
          id: `c${i}`,
          onset_s: 0,
          offset_s: 1,
          pitch_midi: p,
        })),
        ...[45, 52, 57, 60, 64].map((p, i) => ({
          id: `a${i}`,
          onset_s: 1,
          offset_s: 2,
          pitch_midi: p,
        })),
        ...[43, 47, 50, 55, 59, 67].map((p, i) => ({
          id: `g${i}`,
          onset_s: 2,
          offset_s: 3,
          pitch_midi: p,
        })),
        ...[50, 57, 62, 66].map((p, i) => ({
          id: `d${i}`,
          onset_s: 3,
          offset_s: 4,
          pitch_midi: p,
        })),
      ],
      chords: [
        { t0: 0, t1: 1, label: 'C:maj' },
        { t0: 1, t1: 2, label: 'A:min' },
        { t0: 2, t1: 3, label: 'G:maj' },
        { t0: 3, t1: 4, label: 'D:maj' },
      ],
    },
  },
  'fret.edge-cases': {
    command: 'fret',
    input: {
      notes: [
        { id: 'too-low', onset_s: 0, pitch_midi: 30 },
        { id: 'span-a', onset_s: 1, pitch_midi: 41 },
        { id: 'span-b', onset_s: 1, pitch_midi: 79 },
        { id: 'pinned', onset_s: 2, pitch_midi: 64, string: 2, fret: 5 },
        { id: 'capo-line', onset_s: 3, pitch_midi: 69 },
      ],
      config: { capo: 0, max_span: 4 },
    },
  },
  'fret.bass-line': {
    command: 'fret',
    input: {
      notes: [33, 40, 45, 40, 38, 45, 50, 45].map((p, i) => ({
        id: `b${i}`,
        onset_s: i * 0.25,
        pitch_midi: p,
      })),
      config: { instrument: 'bass' },
    },
  },
}

for (const [name, { command, input }] of Object.entries(CASES)) {
  const run = COMMANDS[command]
  if (run === undefined) throw new Error(`unknown command ${command}`)
  const expected = JSON.parse(JSON.stringify(run(input)))
  writeFileSync(
    new URL(`../golden/${name}.json`, import.meta.url),
    `${JSON.stringify({ command, input, expected }, null, 2)}\n`,
  )
}
