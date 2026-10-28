import { describe, expect, it } from 'vitest'
import { loadViews, recommendView, type ViewInput, type ViewsConfig } from '../src/views.ts'

const views: ViewsConfig = {
  version: 1,
  notation_supported: ['guitar', 'bass'],
  rough_stem_low_conf: 0.35,
  low_confidence: 0.5,
  min_confidence_mean: {},
  quality_gate: { guitar: 'pass', bass: 'fail' },
  defaults: {
    guitar: 'tab',
    bass: 'tab',
    piano: 'roll',
    drums: 'drum_grid',
    vocals: 'f0',
    other: 'chords_only',
  },
}

const guitar = (overrides: Partial<ViewInput> = {}): ViewInput => ({
  instrument: 'guitar',
  notes: { noteConfidenceMean: 0.8, fractionLowConf: 0.1 },
  stemQuality: 'good',
  stemsUnavailable: false,
  ...overrides,
})

const view = (input: ViewInput, config = views) => {
  const s = recommendView(input, config)
  return [s.recommended_view, s.reasons]
}

describe('recommended_view rule (05-analysis-schema.md)', () => {
  it('1. notes failed or skipped → chords_only, notes_unavailable', () => {
    const { notes: _, ...rest } = guitar()
    expect(view(rest)).toEqual(['chords_only', ['notes_unavailable']])
    const summary = recommendView(rest, views)
    expect(summary.note_confidence_mean).toBe(0)
    expect(summary.fraction_low_conf).toBe(0)
  })

  it('2. instrument outside the notation set → chords_only, notation_not_supported', () => {
    expect(view(guitar({ instrument: 'piano' }))).toEqual([
      'chords_only',
      ['notation_not_supported'],
    ])
    expect(view(guitar({ instrument: 'vocals' }))[0]).toBe('chords_only')
  })

  it('3. failed Prototype 2 gate → chords_only, quality_gate_failed', () => {
    expect(view(guitar({ instrument: 'bass' }))).toEqual(['chords_only', ['quality_gate_failed']])
  })

  it('4. rough stem and > 35% low → chords_only, rough_stem_low_conf (boundary excluded)', () => {
    const rough = (fractionLowConf: number) =>
      guitar({ stemQuality: 'rough', notes: { noteConfidenceMean: 0.5, fractionLowConf } })
    expect(view(rough(0.36))).toEqual(['chords_only', ['rough_stem_low_conf']])
    expect(view(rough(0.35))).toEqual(['tab', []])
    // A good stem with the same share stays on tab.
    expect(view(guitar({ notes: { noteConfidenceMean: 0.5, fractionLowConf: 0.4 } }))).toEqual([
      'tab',
      [],
    ])
  })

  it('5. > 50% low → chords_only, low_confidence (boundary excluded)', () => {
    const low = (fractionLowConf: number) =>
      guitar({ notes: { noteConfidenceMean: 0.3, fractionLowConf } })
    expect(view(low(0.51))).toEqual(['chords_only', ['low_confidence']])
    expect(view(low(0.5))).toEqual(['tab', []])
  })

  it('5b. a mean confidence below the instrument floor → chords_only, low_confidence', () => {
    const floored = { ...views, min_confidence_mean: { guitar: 0.8 } }
    const mean = (noteConfidenceMean: number) =>
      recommendView(guitar({ notes: { noteConfidenceMean, fractionLowConf: 0.1 } }), floored)
    expect([mean(0.79).recommended_view, mean(0.79).reasons]).toEqual([
      'chords_only',
      ['low_confidence'],
    ])
    expect(mean(0.8).recommended_view).toBe('tab')
    // Instruments without a floor are unaffected.
    expect(view(guitar({ notes: { noteConfidenceMean: 0.1, fractionLowConf: 0.1 } }))).toEqual([
      'tab',
      [],
    ])
  })

  it('6. otherwise the instrument default, with stats carried through', () => {
    const summary = recommendView(guitar(), views)
    expect(summary).toEqual({
      instrument: 'guitar',
      note_confidence_mean: 0.8,
      fraction_low_conf: 0.1,
      recommended_view: 'tab',
      reasons: [],
    })
    const all: ViewsConfig = { ...views, notation_supported: ['guitar', 'piano', 'drums'] }
    expect(view(guitar({ instrument: 'piano' }), all)).toEqual(['roll', []])
    expect(view(guitar({ instrument: 'drums' }), all)).toEqual(['drum_grid', []])
  })

  it('rules apply in order: missing notes beat every later rule', () => {
    const { notes: _, ...rest } = guitar({ instrument: 'piano', stemQuality: 'rough' })
    expect(view(rest)).toEqual(['chords_only', ['notes_unavailable']])
    expect(
      view(
        guitar({
          instrument: 'bass',
          stemQuality: 'rough',
          notes: { noteConfidenceMean: 0.1, fractionLowConf: 0.9 },
        }),
      ),
    ).toEqual(['chords_only', ['quality_gate_failed']])
  })

  it('notes from the mixture add stems_unavailable without changing the view', () => {
    expect(view(guitar({ stemsUnavailable: true }))).toEqual(['tab', ['stems_unavailable']])
    const { notes: _, ...rest } = guitar({ stemsUnavailable: true })
    expect(view(rest)).toEqual(['chords_only', ['notes_unavailable']])
  })

  it('loads the repo views.yaml', () => {
    const config = loadViews()
    expect(config.notation_supported).toContain('guitar')
    expect(config.low_confidence).toBeGreaterThan(config.rough_stem_low_conf)
    expect(config.min_confidence_mean).toEqual({ piano: 0.8, drums: 0.75 })
    expect(config.quality_gate.drums).toBe('pass')
  })
})
