import { type Instrument, instrumentProfile } from '@splitune/contracts'
import type { z } from 'zod'
import { isPhone, type PracticeLayout } from '../layout'

// What the practice screen shows (12 §2–3, 27 §3.7): from the layers that exist, the learner's
// choices and the summary's recommendation to the paper's renderer, the view switch, the
// chords-only banner and the chord strip. Pure, so every combination is a table test; the
// components only render the answer.

export interface Layers {
  beats: boolean
  stems: boolean
  chords: boolean
  tab: boolean
  /** Piano's falling notes (its notation layer: piano has no tab). */
  roll: boolean
  /** The vocal melody and its phrases (vocals' notation layer, step 18c). */
  melody: boolean
  /** Drum hits: the drum grid and staff (drums' notation layer, step 25). */
  drums: boolean
}

/** The view chosen in the status bar; 'tab' is the instrument's first notation. */
export type ChosenView = 'tab' | 'notes' | 'staff' | 'chords'

export interface ScreenInput {
  instrument: z.infer<typeof Instrument>
  layers: Layers
  view: ChosenView | null
  /** "Show tab anyway": the notation over a chords-only recommendation. */
  forceTab: boolean
  /** summary.recommended_view for the learner's part is chords_only (05). */
  chordsOnly: boolean
  layout: PracticeLayout
}

/** What the paper renders: the tab, one of the instrument's notations, a chord sheet or chart, or
 * the placeholder over the analysis status. */
export type Paper =
  | 'tab'
  | 'guitar-notes'
  | 'bar-sheet'
  | 'piano-notes'
  | 'piano-staff'
  | 'piano-chart'
  | 'drum-grid'
  | 'drum-staff'
  | 'melody'
  | 'placeholder'

export type ViewLabel = 'tab' | 'notes' | 'staff' | 'chords' | 'chart' | 'grid' | 'melody'

export interface SwitchItem {
  value: ChosenView
  label: ViewLabel
}

export interface Screen {
  /** As the view switch reads it: chords (the sheet, or the glance view) or the notation. */
  shown: 'tab' | 'chords'
  /** Phone portrait on chords: the glance view takes the whole paper. */
  glance: boolean
  paper: Paper
  /** Phone landscape with guitar's Notes chosen: the Notes carry the chord the strip would. */
  compactNotes: boolean
  /** The strip over the paper, only when it has something in it: the chords, the phrases or the
   * options at its end (which phones leave out). */
  strip: boolean
  /** The level control at the strip's end, with the capo for guitar. */
  scoreTools: { capo: boolean } | null
  /** Piano options at the strip's end: all of them with the chords, only the hands without. */
  pianoOptions: 'all' | 'hands' | null
  legend: boolean
  viewSwitch: { items: SwitchItem[]; selected: ChosenView } | null
  /** The chords-only banner: `held` while the recommendation holds the notation back ("Show …
   * anyway"; `notes` when the notation is notes rather than a tab), `unsure` when there are no
   * chords to fall back on and the notation shows under a plain notice. */
  banner:
    | { kind: 'held'; title: 'piano' | 'vocals' | 'reason'; notes: boolean }
    | { kind: 'unsure' }
    | null
  /** view_changed's name for the instrument's first notation. */
  notationEvent: 'tab' | 'notes'
}

/** Whether the instrument's notation layer exists: its tab, roll, melody or hits. */
export const hasNotation = (layers: Layers) =>
  layers.tab || layers.roll || layers.melody || layers.drums

export function resolveScreen(input: ScreenInput): Screen {
  const { instrument, layers, view, forceTab, chordsOnly, layout } = input
  const notation = hasNotation(layers)
  const shown = shownView(input)
  const glance = layout === 'phone-portrait' && shown === 'chords'
  const compactNotes = layout === 'phone-landscape' && view === 'notes'
  // Notes rather than a tab: piano's roll, vocals' melody, drums' grid.
  const notes = layers.roll || layers.melody || layers.drums
  // Levels exist for the tab and the drum hits; the capo only fits guitar's chord shapes.
  const scoreTools = layers.tab || layers.drums ? { capo: instrument === 'guitar' } : null
  const pianoOptions =
    instrumentProfile(instrument).score !== 'piano'
      ? null
      : layers.chords
        ? 'all'
        : layers.roll
          ? 'hands'
          : null
  // The phrases follow the melody while it is shown.
  const phrases = layers.melody && shown === 'tab'
  const tools = !isPhone(layout) && (scoreTools !== null || pianoOptions !== null)
  return {
    shown,
    glance,
    paper: paperFor(input),
    compactNotes,
    strip: !glance && !(compactNotes && shown === 'tab') && (layers.chords || phrases || tools),
    scoreTools,
    pianoOptions,
    legend: layers.chords || notation,
    viewSwitch: layers.chords && notation ? viewSwitch(layers, view, shown) : null,
    banner:
      !chordsOnly || !notation
        ? null
        : !layers.chords
          ? { kind: 'unsure' }
          : forceTab
            ? null
            : {
                kind: 'held',
                title: layers.roll ? 'piano' : layers.melody ? 'vocals' : 'reason',
                notes,
              },
    notationEvent: notes ? 'notes' : 'tab',
  }
}

// A chords-only recommendation holds the notation back only while there are chords to show
// instead and the learner hasn't asked for the notation anyway.
const held = ({ layers, forceTab, chordsOnly }: ScreenInput) =>
  chordsOnly && layers.chords && !forceTab

function shownView(input: ScreenInput) {
  const { layers, view, layout } = input
  const wanted = view ?? (layout === 'phone-portrait' ? 'chords' : 'tab')
  if (wanted === 'chords' && layers.chords) return 'chords'
  return hasNotation(layers) && !held(input) ? 'tab' : 'chords'
}

// The paper's renderer does not depend on the layout: the glance view replaces it on phone
// portrait.
function paperFor(input: ScreenInput): Paper {
  const { instrument, layers, view } = input
  const notation = view !== 'chords' && !held(input)
  if (layers.tab && notation && view !== 'notes') return 'tab'
  if (!layers.chords && !hasNotation(layers)) return 'placeholder'
  // The notes instead of the chords: chosen, or the only layer there is.
  const notes = hasNotation(layers) && (notation || !layers.chords)
  const staff = view === 'staff'
  switch (instrumentProfile(instrument).score) {
    case 'drums':
      return notes ? (staff ? 'drum-staff' : 'drum-grid') : 'bar-sheet'
    case 'melody':
      return notes ? 'melody' : 'bar-sheet'
    case 'piano':
      return notes ? (staff ? 'piano-staff' : 'piano-notes') : 'piano-chart'
    default:
      return notes ? 'guitar-notes' : 'bar-sheet'
  }
}

// Tab / Notes / Chords; piano's Chart / Notes / Staff; drums' Grid / Staff / Chords; vocals'
// Melody / Chords.
function viewSwitch(
  layers: Layers,
  view: ChosenView | null,
  shown: 'tab' | 'chords',
): NonNullable<Screen['viewSwitch']> {
  const items: SwitchItem[] = layers.melody
    ? [
        { value: 'tab', label: 'melody' },
        { value: 'chords', label: 'chords' },
      ]
    : layers.drums
      ? [
          { value: 'tab', label: 'grid' },
          { value: 'staff', label: 'staff' },
          { value: 'chords', label: 'chords' },
        ]
      : layers.roll
        ? [
            { value: 'chords', label: 'chart' },
            { value: 'tab', label: 'notes' },
            { value: 'staff', label: 'staff' },
          ]
        : [
            { value: 'tab', label: 'tab' },
            ...(layers.tab ? [{ value: 'notes', label: 'notes' } as const] : []),
            { value: 'chords', label: 'chords' },
          ]
  // The second notation chosen over the first: piano's and drums' Staff, guitar's Notes.
  const second = layers.roll || layers.drums ? 'staff' : 'notes'
  return { items, selected: shown === 'tab' && view === second ? second : shown }
}
