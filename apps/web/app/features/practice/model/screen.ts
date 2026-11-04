import { type Instrument, instrumentProfile } from '@splitune/contracts'
import type { z } from 'zod'
import type { PracticeLayout } from '../layout'

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
  strip: boolean
  /** The level (and capo) control at the strip's end. */
  scoreTools: boolean
  legend: boolean
  viewSwitch: { items: SwitchItem[]; selected: ChosenView } | null
  /** The chords-only banner; `notes` when the notation is notes rather than a tab. */
  banner: { title: 'piano' | 'vocals' | 'reason'; notes: boolean } | null
  /** view_changed's name for the instrument's first notation. */
  notationEvent: 'tab' | 'notes'
}

/** Whether the instrument's notation layer exists: its tab, roll, melody or hits. */
export const hasNotation = (layers: Layers) =>
  layers.tab || layers.roll || layers.melody || layers.drums

export function resolveScreen(input: ScreenInput): Screen {
  const { layers, view, forceTab, chordsOnly, layout } = input
  const notation = hasNotation(layers)
  const shown = shownView(input)
  const glance = layout === 'phone-portrait' && shown === 'chords'
  const compactNotes = layout === 'phone-landscape' && view === 'notes'
  // Notes rather than a tab: piano's roll, vocals' melody, drums' grid.
  const notes = layers.roll || layers.melody || layers.drums
  return {
    shown,
    glance,
    paper: paperFor(input),
    compactNotes,
    // Piano's roll brings nothing to the strip: its keyboards follow the chords.
    strip:
      !glance &&
      (layers.chords || layers.tab || layers.melody || layers.drums) &&
      !(compactNotes && shown === 'tab'),
    // Levels exist for the tab and the drum hits.
    scoreTools: layers.tab || layers.drums,
    legend: layers.chords || notation,
    viewSwitch: layers.chords && notation ? viewSwitch(layers, view, shown) : null,
    banner:
      chordsOnly && !forceTab && notation
        ? { title: layers.roll ? 'piano' : layers.melody ? 'vocals' : 'reason', notes }
        : null,
    notationEvent: notes ? 'notes' : 'tab',
  }
}

function shownView({ layers, view, forceTab, chordsOnly, layout }: ScreenInput) {
  const wanted = view ?? (layout === 'phone-portrait' ? 'chords' : 'tab')
  if (wanted === 'chords' && layers.chords) return 'chords'
  return hasNotation(layers) && (!chordsOnly || forceTab) ? 'tab' : 'chords'
}

// The paper's renderer does not depend on the layout: the glance view replaces it on phone
// portrait.
function paperFor({ instrument, layers, view, forceTab, chordsOnly }: ScreenInput): Paper {
  const notation = view !== 'chords' && (!chordsOnly || forceTab)
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
