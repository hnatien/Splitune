import chordsArtefact from '@splitune/contracts/fixtures/chords.json'
import stemsArtefact from '@splitune/contracts/fixtures/stems.json'
import summaryArtefact from '@splitune/contracts/fixtures/summary.json'
import { confidenceBand, parseChord } from '@splitune/music-core'
import type { ConfidenceLevel, StemKind } from '@splitune/ui-tokens'

// Story data (docs/specs/28-ui-quality-and-design-review.md §2): the contracts' 8-bar
// Am–F–C–G example and copy from the message catalogue (27 §5.6). Step 10 replaces the copy with
// Paraglide messages; components themselves take every string as a prop.

const SUFFIX: Record<string, string> = { maj: '', min: 'm', '7': '7', maj7: 'maj7', min7: 'm7' }

/** "A:min" → "Am" for the shorthands the fixtures use. */
export function chordName(label: string): string {
  const chord = parseChord(label)
  if (chord?.kind !== 'chord') return label
  return `${chord.rootName}${SUFFIX[chord.shorthand ?? 'maj'] ?? chord.shorthand ?? ''}`
}

export const FIXTURE_CHORDS: { id: string; label: string; confidence: ConfidenceLevel }[] =
  chordsArtefact.segments
    .filter((segment) => segment.label !== 'N')
    .map((segment) => ({
      id: segment.id,
      label: chordName(segment.label),
      confidence: confidenceBand(segment.confidence),
    }))

const STEM_NAMES: Record<string, { stem: StemKind; name: string }> = {
  guitar: { stem: 'guitar', name: 'Guitar' },
  bass: { stem: 'bass', name: 'Bass' },
  drums: { stem: 'drums', name: 'Drums' },
  mix_minus_guitar: { stem: 'mix', name: 'Backing' },
}

export const FIXTURE_STEMS = stemsArtefact.stems.map((stem) => ({
  id: stem.stem_id,
  ...(STEM_NAMES[stem.stem_id] ?? { stem: 'other' as const, name: stem.stem_id }),
  rough: summaryArtefact.rough_stems.includes(stem.stem_id),
}))

export const COPY = {
  legend: 'Auto-transcribed — may contain errors (v0.1.0)',
  showUncertainty: 'Show uncertainty',
  probably: 'Probably',
  unsure: 'Unsure',
  roughStem: 'This stem may contain bits of other instruments.',
  rough: 'Rough',
  yourPart: 'Your part',
  passPrompt: 'How was that pass?',
  feltClean: 'Felt clean',
  notYet: 'Not yet',
  bestTempo: 'Best clean pass: 85 %',
  queuedOffline: 'Processing machine offline — your song is queued and will start automatically.',
  workerOnline: 'Processing machine online',
  libraryEmpty: 'Your library is empty. Import a song you want to learn, or start with an example.',
  importSong: 'Import a song',
  tryExample: 'Try an example',
  libraryFailed: "We couldn't load your library.",
  retry: 'Retry',
  unreadable: "We couldn't read this file. It may be damaged or in a format we don't support.",
  tryAnotherFile: 'Try another file',
  recordYourself: 'Record yourself',
  offline: "You're offline. You can keep practising songs you've opened.",
  demo: 'Demo mode — no real charges.',
  unsupported: "Your browser can't run Splitune's audio engine (AudioWorklet).",
  supportedBrowsers: 'See supported browsers',
  dismiss: 'Dismiss',
  allowance: '4 of 5 Lite analyses left · resets 1 Dec',
  deleteConfirm:
    'Delete "Wish You Were Here"? Its stems, loops and edits will be removed. This can\'t be undone.',
  deleteSong: 'Delete song',
  cancel: 'Cancel',
  close: 'Close',
  undo: 'Undo',
} as const

export const LONG_TITLE =
  'Comfortably Numb (Live at Earls Court 1980, 2000 Remaster) — Extended Outro Solo Version'

export const SONGS = [
  {
    title: 'Wish You Were Here',
    artist: 'Pink Floyd',
    instrument: 'Guitar',
    status: { label: 'Ready', variant: 'success' as const },
    lastPractised: 'Practised 3 days ago',
    bestTempo: 'Best clean pass: 85 %',
    href: '#wish-you-were-here',
  },
  {
    title: LONG_TITLE,
    artist: 'Pink Floyd',
    instrument: 'Guitar',
    status: { label: 'Rough tab', variant: 'warning' as const },
    lastPractised: 'Practised 2 Oct',
    href: '#comfortably-numb',
  },
  {
    title: 'Another One Bites the Dust',
    instrument: 'Bass',
    status: { label: 'Chords only', variant: 'neutral' as const },
    href: '#another-one',
  },
  {
    title: 'Mallory',
    instrument: 'Guitar',
    status: { label: 'Analysing', variant: 'info' as const },
    href: '#mallory',
  },
]
