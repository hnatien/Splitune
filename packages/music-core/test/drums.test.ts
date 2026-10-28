import type * as alphaTab from '@coderline/alphatab'
import { describe, expect, it } from 'vitest'
import {
  ARTICULATION,
  buildDrumScore,
  createBeatGrid,
  type DrumScore,
  drumMainPattern,
  PPQ,
  toDrumAlphaTex,
} from '../src/index.ts'
import { loadAlphaTex, voiceDurationMismatches } from './alphatab.ts'
import { drumSong, makeBeats, makeDrums } from './helpers.ts'

// The GM key a rendered percussion note plays (its articulation's MIDI output).
function soundingKey(track: alphaTab.model.Track, note: alphaTab.model.Note): number | undefined {
  return track.percussionArticulations[note.percussionArticulation]?.outputMidiNumber
}

// Loads the score's alphaTex: no diagnostics, every voice fills its bars, every hitMap entry
// points at a note playing the hit's GM key (GM 40 and 59 sound as 38 and 51), each hit once.
function rendered(score: DrumScore) {
  const { score: parsed, diagnostics } = loadAlphaTex(score.alphaTex)
  expect(diagnostics.filter((d) => d.startsWith('Error'))).toEqual([])
  expect(voiceDurationMismatches(parsed)).toEqual([])
  const track = parsed.tracks[0] as alphaTab.model.Track
  const keys = new Map(score.hits.map((h) => [h.id, h.gmNote]))
  expect(score.hitMap.map((r) => r.hitId).sort()).toEqual([...keys.keys()].sort())
  for (const ref of score.hitMap) {
    const beat = track.staves[0]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]
    const note = beat?.notes[ref.note]
    if (beat === undefined || note === undefined) throw new Error(`${ref.hitId} not rendered`)
    expect(beat.graceType).toBe(0)
    const gm = keys.get(ref.hitId) as number
    expect(soundingKey(track, note)).toBe(gm === 40 ? 38 : gm === 59 ? 51 : gm)
  }
  return { parsed, track }
}

describe('drum alphaTex', () => {
  it('plays every GM kit key by its own articulation (40 and 59 as snare and ride)', () => {
    const keys = Object.keys(ARTICULATION).map(Number)
    const beats = makeBeats({ bars: keys.length, start: 0.5 })
    const drums = makeDrums(keys.map((gm, i) => [gm, 0.5 + i * 2] as const))
    const score = buildDrumScore(drums, beats)
    rendered(score)
    expect(new Set(score.hits.map((h) => h.gmNote))).toEqual(new Set(keys))
  })

  it('writes hands stems-up and feet stems-down in two voices', () => {
    const drums = makeDrums([
      [36, 0.5],
      [42, 0.5],
      [44, 1],
      [38, 1],
    ])
    const score = buildDrumScore(drums, makeBeats({ bars: 1 }))
    rendered(score)
    expect(score.hits.filter((h) => h.foot).map((h) => h.gmNote)).toEqual([36, 44])
    expect(new Set(score.hitMap.filter((r) => r.voice === 1).map((r) => r.hitId))).toEqual(
      new Set(score.hits.filter((h) => h.foot).map((h) => h.id)),
    )
  })

  it('leaves out the feet voice when nothing is played with the feet', () => {
    const tex = toDrumAlphaTex({
      grid: createBeatGrid(makeBeats({ bars: 1 })),
      meterDenominator: 4,
      tempo: 120,
      hits: [{ hitId: 'h', gmNote: 42, onTick: 0, flam: false }],
      swingBars: [],
    })
    expect(tex.tex).not.toContain('\\voice')
    expect(loadAlphaTex(tex.tex).diagnostics.filter((d) => d.startsWith('Error'))).toEqual([])
  })
})

describe('buildDrumScore', () => {
  const song = drumSong()
  const score = buildDrumScore(song.drums, song.beats, {}, { title: 'Drum song' })

  it('renders the whole song: pickup, swing bars, flam and fills', () => {
    const { parsed, track } = rendered(score)
    expect(parsed.masterBars[0]?.isAnacrusis).toBe(true)
    expect(score.alphaTexFirstBar).toBe(-1)
    expect(score.swingBars).toEqual([4, 5, 6])
    const graces = (track.staves[0]?.bars ?? []).flatMap((bar) =>
      (bar.voices[0]?.beats ?? []).filter((b) => b.graceType !== 0),
    )
    expect(graces).toHaveLength(1)
  })

  it('keeps a flam as one hit carrying its grace hit', () => {
    const flams = score.hits.filter((h) => h.flam)
    expect(flams).toHaveLength(1)
    expect(flams[0]).toMatchObject({ class5: 'snare', bar: 5, beat: 2, tick: 0 })
    expect(flams[0]?.mergedIds).toHaveLength(1)
  })

  it('finds the fill in every fourth bar against the main pattern', () => {
    expect(score.fillBars).toEqual([3, 7])
    const grid = createBeatGrid(song.beats)
    const main = drumMainPattern(score.hits, grid).byLength.get(4)
    // Kick on 1 and 3, snare on 2 and 4, hi-hat on every beat.
    expect([...(main?.keys() ?? [])].sort()).toEqual(
      [
        `36@0`,
        `36@${2 * PPQ}`,
        `38@${PPQ}`,
        `38@${3 * PPQ}`,
        ...[0, 1, 2, 3].map((b) => `42@${b * PPQ}`),
      ].sort(),
    )
  })

  it('core_groove keeps kick, snare and hi-hat and plays the main pattern through fills', () => {
    const groove = buildDrumScore(song.drums, song.beats, {}, { level: 'core_groove' })
    rendered(groove)
    expect(new Set(groove.hits.map((h) => h.class5))).toEqual(new Set(['kick', 'snare', 'hihat']))
    const fill = groove.hits.filter((h) => h.bar === 3)
    expect(fill.every((h) => h.generated && h.approximate)).toBe(true)
    expect(fill.map((h) => [h.gmNote, h.beat, h.tick])).toEqual([
      [36, 1, 0],
      [42, 1, 0],
      [38, 2, 0],
      [42, 2, 0],
      [36, 3, 0],
      [42, 3, 0],
      [38, 4, 0],
      [42, 4, 0],
    ])
    expect(groove.hits.some((h) => h.bar !== 3 && h.bar !== 7 && h.generated)).toBe(false)
  })

  it('simplified thins the hi-hat to eighths and keeps everything else', () => {
    const simple = buildDrumScore(song.drums, song.beats, {}, { level: 'simplified' })
    rendered(simple)
    const hats = simple.hits.filter((h) => h.class5 === 'hihat')
    const straight = hats.filter((h) => !score.swingBars.includes(h.bar))
    expect(straight.every((h) => h.tick === 0 || h.tick === PPQ / 2)).toBe(true)
    const swung = hats.filter((h) => score.swingBars.includes(h.bar))
    expect(swung.every((h) => h.tick === 0 || h.tick === (2 * PPQ) / 3)).toBe(true)
    expect(simple.hits.filter((h) => h.class5 !== 'hihat')).toEqual(
      score.hits.filter((h) => h.class5 !== 'hihat'),
    )
  })

  it('applies beat corrections and rejects other instruments', () => {
    const shifted = buildDrumScore(song.drums, song.beats, {
      beats: [{ op: 'shift_downbeat', by_beats: 1 }],
    })
    expect(shifted.effective.beats).not.toEqual(song.beats)
    expect(() =>
      buildDrumScore({ ...song.drums, instrument: 'piano' as never }, song.beats),
    ).toThrow(RangeError)
  })
})
