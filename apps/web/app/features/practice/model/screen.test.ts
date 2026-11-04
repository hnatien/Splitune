import { describe, expect, it } from 'vitest'
import { type Layers, resolveScreen, type ScreenInput } from './screen'

const NONE: Layers = {
  beats: true,
  stems: true,
  chords: false,
  tab: false,
  roll: false,
  melody: false,
  drums: false,
}

const screen = (input: Partial<Omit<ScreenInput, 'layers'>> & { layers?: Partial<Layers> }) =>
  resolveScreen({
    instrument: 'guitar',
    view: null,
    forceTab: false,
    chordsOnly: false,
    layout: 'desktop',
    ...input,
    layers: { ...NONE, ...input.layers },
  })

describe('the paper', () => {
  it.each([
    // [instrument, layers, view, paper]
    ['guitar', { chords: true, tab: true }, null, 'tab'],
    ['guitar', { chords: true, tab: true }, 'notes', 'guitar-notes'],
    ['guitar', { chords: true, tab: true }, 'chords', 'bar-sheet'],
    ['guitar', { chords: true }, null, 'bar-sheet'],
    ['bass', { tab: true }, 'chords', 'guitar-notes'],
    ['other', { chords: true }, null, 'bar-sheet'],
    ['piano', { chords: true, roll: true }, null, 'piano-notes'],
    ['piano', { chords: true, roll: true }, 'staff', 'piano-staff'],
    ['piano', { chords: true, roll: true }, 'chords', 'piano-chart'],
    ['piano', { chords: true }, null, 'piano-chart'],
    ['drums', { chords: true, drums: true }, null, 'drum-grid'],
    ['drums', { chords: true, drums: true }, 'staff', 'drum-staff'],
    ['drums', { chords: true, drums: true }, 'chords', 'bar-sheet'],
    ['vocals', { chords: true, melody: true }, null, 'melody'],
    ['vocals', { chords: true, melody: true }, 'chords', 'bar-sheet'],
    ['guitar', {}, null, 'placeholder'],
    ['drums', {}, 'staff', 'placeholder'],
  ] as const)('%s with %j and view %s shows %s', (instrument, layers, view, paper) => {
    expect(screen({ instrument, layers, view }).paper).toBe(paper)
  })

  it('keeps a chords-only recommendation on the chords until the learner forces the notation', () => {
    const input = { layers: { chords: true, tab: true }, chordsOnly: true }
    expect(screen(input).paper).toBe('bar-sheet')
    expect(screen({ ...input, forceTab: true }).paper).toBe('tab')
    expect(
      screen({ ...input, instrument: 'piano', layers: { chords: true, roll: true } }).paper,
    ).toBe('piano-chart')
  })

  it('shows the notation when there are no chords to fall back on', () => {
    expect(screen({ layers: { tab: true }, chordsOnly: true }).paper).toBe('tab')
    expect(screen({ instrument: 'vocals', layers: { melody: true }, chordsOnly: true }).paper).toBe(
      'melody',
    )
    expect(screen({ instrument: 'piano', layers: { roll: true }, chordsOnly: true }).paper).toBe(
      'piano-notes',
    )
  })

  it('does not depend on the layout', () => {
    const layers = { chords: true, tab: true }
    expect(screen({ layers, layout: 'phone-portrait' }).paper).toBe('tab')
  })
})

describe('what is shown and where', () => {
  it('opens phone portrait on the glance view and every other layout on the notation', () => {
    const layers = { chords: true, tab: true }
    expect(screen({ layers, layout: 'phone-portrait' })).toMatchObject({
      shown: 'chords',
      glance: true,
      strip: false,
    })
    expect(screen({ layers, layout: 'tablet-portrait' })).toMatchObject({
      shown: 'tab',
      glance: false,
      strip: true,
    })
    expect(screen({ layers, layout: 'phone-portrait', view: 'tab' }).glance).toBe(false)
  })

  it('keeps the glance view on phone portrait while there is nothing to show yet', () => {
    expect(screen({ layout: 'phone-portrait' })).toMatchObject({ shown: 'chords', glance: true })
  })

  it('shows the chords only when they exist, else the notation', () => {
    expect(screen({ layers: { tab: true }, view: 'chords' }).shown).toBe('tab')
    expect(screen({ layers: { chords: true, tab: true }, chordsOnly: true }).shown).toBe('chords')
    expect(screen({ layers: { tab: true }, chordsOnly: true }).shown).toBe('tab')
  })

  it('gives guitar Notes on phone landscape the strip room', () => {
    const layers = { chords: true, tab: true }
    const notes = screen({ layers, view: 'notes', layout: 'phone-landscape' })
    expect(notes).toMatchObject({ compactNotes: true, strip: false, paper: 'guitar-notes' })
    expect(screen({ layers, view: 'notes', layout: 'tablet-landscape' })).toMatchObject({
      compactNotes: false,
      strip: true,
    })
  })

  it.each([
    // [instrument, layers, chordsOnly, strip on desktop, strip on phone landscape]
    ['guitar', { chords: true, tab: true }, false, true, true],
    ['guitar', { chords: true }, false, true, true],
    // Only the level at its end: phones leave it out, so no strip.
    ['guitar', { tab: true }, false, true, false],
    ['bass', { tab: true }, false, true, false],
    ['drums', { drums: true }, false, true, false],
    // Piano without chords: only its options (the hands), which phones leave out.
    ['piano', { roll: true }, false, true, false],
    ['piano', { roll: true, chords: true }, false, true, true],
    // Vocals' phrases follow the melody, on phones too, even under a chords-only recommendation
    // with no chords to fall back on.
    ['vocals', { melody: true }, false, true, true],
    ['vocals', { melody: true }, true, true, true],
    ['other', {}, false, false, false],
  ] as const)(
    'gives %s with %j (chords only: %s) a strip: %s, on phones: %s',
    (instrument, layers, chordsOnly, desktop, phone) => {
      expect(screen({ instrument, layers, chordsOnly }).strip).toBe(desktop)
      expect(screen({ instrument, layers, chordsOnly, layout: 'phone-landscape' }).strip).toBe(
        phone,
      )
    },
  )

  it('offers levels for the tab and the drums only, and the capo for guitar only', () => {
    expect(screen({ layers: { tab: true } }).scoreTools).toEqual({ capo: true })
    expect(screen({ instrument: 'bass', layers: { tab: true } }).scoreTools).toEqual({
      capo: false,
    })
    expect(screen({ instrument: 'drums', layers: { drums: true } }).scoreTools).toEqual({
      capo: false,
    })
    expect(
      screen({ instrument: 'piano', layers: { roll: true, chords: true } }).scoreTools,
    ).toBeNull()
  })

  it('offers piano all its options with the chords, only the hands without', () => {
    expect(screen({ instrument: 'piano', layers: { chords: true } }).pianoOptions).toBe('all')
    expect(screen({ instrument: 'piano', layers: { roll: true, chords: true } }).pianoOptions).toBe(
      'all',
    )
    expect(screen({ instrument: 'piano', layers: { roll: true } }).pianoOptions).toBe('hands')
    expect(screen({ instrument: 'piano' }).pianoOptions).toBeNull()
    expect(screen({ layers: { chords: true, tab: true } }).pianoOptions).toBeNull()
  })

  it('shows the legend once anything transcribed is on screen', () => {
    expect(screen({}).legend).toBe(false)
    expect(screen({ layers: { chords: true } }).legend).toBe(true)
    expect(screen({ instrument: 'piano', layers: { roll: true } }).legend).toBe(true)
  })
})

describe('the view switch', () => {
  const values = (input: Parameters<typeof screen>[0]) =>
    screen(input).viewSwitch?.items.map((item) => `${item.value}:${item.label}`)

  it('needs both the chords and a notation', () => {
    expect(screen({ layers: { chords: true } }).viewSwitch).toBeNull()
    expect(screen({ layers: { tab: true } }).viewSwitch).toBeNull()
  })

  it.each([
    ['guitar', { chords: true, tab: true }, ['tab:tab', 'notes:notes', 'chords:chords']],
    ['piano', { chords: true, roll: true }, ['chords:chart', 'tab:notes', 'staff:staff']],
    ['drums', { chords: true, drums: true }, ['tab:grid', 'staff:staff', 'chords:chords']],
    ['vocals', { chords: true, melody: true }, ['tab:melody', 'chords:chords']],
  ] as const)('offers %s its notations', (instrument, layers, items) => {
    expect(values({ instrument, layers })).toEqual(items)
  })

  it('selects the second notation only while the notation is shown', () => {
    const piano = { instrument: 'piano', layers: { chords: true, roll: true } } as const
    expect(screen({ ...piano, view: 'staff' }).viewSwitch?.selected).toBe('staff')
    expect(screen({ ...piano, view: 'staff', chordsOnly: true }).viewSwitch?.selected).toBe(
      'chords',
    )
    const guitar = { layers: { chords: true, tab: true } }
    expect(screen({ ...guitar, view: 'notes' }).viewSwitch?.selected).toBe('notes')
    // Staff means nothing to guitar: the first notation stays selected.
    expect(screen({ ...guitar, view: 'staff' }).viewSwitch?.selected).toBe('tab')
  })
})

describe('the chords-only banner', () => {
  it('shows while the notation is held back by the recommendation', () => {
    const layers = { chords: true, tab: true }
    expect(screen({ layers, chordsOnly: true }).banner).toEqual({
      kind: 'held',
      title: 'reason',
      notes: false,
    })
    expect(screen({ layers, chordsOnly: true, forceTab: true }).banner).toBeNull()
    expect(screen({ layers: { chords: true }, chordsOnly: true }).banner).toBeNull()
  })

  it.each([
    ['piano', { roll: true }, { kind: 'held', title: 'piano', notes: true }],
    ['vocals', { melody: true }, { kind: 'held', title: 'vocals', notes: true }],
    ['drums', { drums: true }, { kind: 'held', title: 'reason', notes: true }],
  ] as const)('speaks of %s notes', (instrument, layers, banner) => {
    expect(
      screen({ instrument, layers: { ...layers, chords: true }, chordsOnly: true }).banner,
    ).toEqual(banner)
  })

  it('only notes the doubt when there are no chords to fall back on', () => {
    for (const [instrument, layers] of [
      ['guitar', { tab: true }],
      ['vocals', { melody: true }],
      ['piano', { roll: true }],
      ['drums', { drums: true }],
    ] as const) {
      expect(screen({ instrument, layers, chordsOnly: true }).banner).toEqual({ kind: 'unsure' })
      expect(screen({ instrument, layers, chordsOnly: true, forceTab: true }).banner).toEqual({
        kind: 'unsure',
      })
    }
  })

  it('names the notation for analytics', () => {
    expect(screen({ layers: { tab: true } }).notationEvent).toBe('tab')
    expect(screen({ instrument: 'vocals', layers: { melody: true } }).notationEvent).toBe('notes')
  })
})
