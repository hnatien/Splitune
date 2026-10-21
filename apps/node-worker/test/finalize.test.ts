import { Summary, Tab } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import { bandsOf, chordsConfidenceMean, finalize, noteStats } from '../src/finalize.ts'
import { loadViews } from '../src/views.ts'
import {
  ANALYSIS_ID,
  bassNotes,
  beats,
  chords,
  guitarNotes,
  parseAlphaTex,
  stems,
} from './fixtures.ts'

const views = loadViews()

describe('finalize', () => {
  it('builds a contract-valid tab, alphaTex that alphaTab 1.8 parses, and a summary', () => {
    const result = finalize(
      ANALYSIS_ID,
      { beats: beats(), chords: chords(), stems: stems(), notes: { guitar: guitarNotes() } },
      { instruments: ['guitar'] },
      views,
    )
    expect(result.status).toBe('done')
    expect(result.tabs).toHaveLength(1)
    const [{ tab, alphaTex }] = result.tabs as [(typeof result.tabs)[number]]
    expect(Tab.parse(tab).events).toHaveLength(guitarNotes().notes.length)
    expect(tab.notes_ref).toEqual({ artefact: 'notes.guitar', artefact_version: 1 })
    const { score, errors } = parseAlphaTex(alphaTex)
    expect(errors).toEqual([])
    expect(score.tracks).toHaveLength(1)
    expect(score.masterBars.length).toBeGreaterThan(0)

    const summary = Summary.parse(result.summary)
    expect(summary.per_instrument).toEqual([
      {
        instrument: 'guitar',
        note_confidence_mean: noteStats(guitarNotes()).noteConfidenceMean,
        fraction_low_conf: 0.0313, // 1 of 32 notes (0.31) below the default medium band (0.4)
        recommended_view: 'tab',
        reasons: [],
      },
    ])
    expect(summary.rough_stems).toEqual(['drums', 'bass'])
    expect(summary.chords_confidence_mean).toBeGreaterThan(0)
  })

  it('reports missing notes, chords and stems as a partial analysis', () => {
    const result = finalize(
      ANALYSIS_ID,
      { beats: beats(), notes: { guitar: guitarNotes() } },
      { instruments: ['guitar', 'bass'] },
      views,
    )
    expect(result.status).toBe('partial')
    expect(result.tabs.map((t) => t.instrument)).toEqual(['guitar'])
    expect(result.summary.per_instrument.map((s) => [s.instrument, s.reasons])).toEqual([
      ['guitar', ['stems_unavailable']],
      ['bass', ['notes_unavailable']],
    ])
    expect(result.summary.chords_confidence_mean).toBe(0)
    expect(result.summary.rough_stems).toEqual([])
  })

  it('fixes bass octaves with low_band_energy and writes a parsable bass tab', () => {
    const result = finalize(
      ANALYSIS_ID,
      { beats: beats(), chords: chords(), stems: stems(), notes: { bass: bassNotes() } },
      { instruments: ['bass'] },
      views,
    )
    const [{ tab, alphaTex }] = result.tabs as [(typeof result.tabs)[number]]
    expect(tab.artefact).toBe('tab.bass')
    expect(tab.tuning_midi).toHaveLength(4)
    expect(parseAlphaTex(alphaTex).errors).toEqual([])
    // The bass stem is rough but few notes are low-confidence: tab stays (unless P2 gated bass).
    expect(result.summary.per_instrument[0]?.recommended_view).toBe(
      views.quality_gate.bass === 'fail' ? 'chords_only' : 'tab',
    )
  })

  it('does not build tabs for instruments outside guitar/bass', () => {
    const vocals = { ...guitarNotes(), artefact: 'notes.vocals', instrument: 'vocals' as const }
    const result = finalize(
      ANALYSIS_ID,
      { beats: beats(), chords: chords(), stems: stems(), notes: { vocals } },
      { instruments: ['vocals'] },
      views,
    )
    expect(result.tabs).toEqual([])
    expect(result.summary.per_instrument[0]).toMatchObject({
      recommended_view: 'chords_only',
      reasons: ['notation_not_supported'],
    })
  })
})

describe('note and chord statistics', () => {
  it('uses the calibration bands recorded by the notes stage', () => {
    const notes = guitarNotes()
    expect(bandsOf(notes)).toEqual({ high: 0.7, medium: 0.4 })
    const strict = {
      ...notes,
      params: { ...notes.params, calibration: { bands: { high: 0.95, medium: 0.9 } } },
    }
    expect(bandsOf(strict)).toEqual({ high: 0.95, medium: 0.9 })
    expect(noteStats(strict).fractionLowConf).toBeGreaterThan(noteStats(notes).fractionLowConf)
  })

  it('treats an empty transcription as all-low', () => {
    expect(noteStats({ ...guitarNotes(), notes: [] })).toEqual({
      noteConfidenceMean: 0,
      fractionLowConf: 1,
    })
  })

  it('weights chord confidence by duration and skips N', () => {
    const c = chords()
    const segments = [
      {
        ...(c.segments[0] as (typeof c.segments)[number]),
        t0: 0,
        t1: 1,
        label: 'N',
        confidence: 0,
      },
      {
        ...(c.segments[0] as (typeof c.segments)[number]),
        t0: 1,
        t1: 4,
        label: 'A:min',
        confidence: 0.9,
      },
      {
        ...(c.segments[0] as (typeof c.segments)[number]),
        t0: 4,
        t1: 5,
        label: 'F:maj',
        confidence: 0.5,
      },
    ]
    expect(chordsConfidenceMean({ ...c, segments })).toBe(0.8)
    expect(chordsConfidenceMean(undefined)).toBe(0)
  })
})

describe('alphaTex parse check', () => {
  it('rejects invalid alphaTex (so a passing parse means something)', () => {
    expect(() => parseAlphaTex('\\track "G" \\staff {tabs} :4 x.y |')).toThrow()
  })
})
