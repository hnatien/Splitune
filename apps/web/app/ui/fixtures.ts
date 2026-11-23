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

// Measuring helpers for the music kit's play functions (28 §3): what a state actually paints,
// resolved through the story's own theme subtree, and the WCAG contrast between two colours.

let paint: CanvasRenderingContext2D | undefined

/** sRGB 0–255 and alpha 0–1 of any CSS colour the browser can parse (OKLCH included). */
export function rgbOf(colour: string): [number, number, number, number] {
  if (!paint) {
    const canvas = document.createElement('canvas')
    canvas.width = 1
    canvas.height = 1
    const context = canvas.getContext('2d', { willReadFrequently: true })
    if (!context) throw new Error('rgbOf needs a 2D canvas context')
    paint = context
  }
  paint.clearRect(0, 0, 1, 1)
  paint.fillStyle = colour
  paint.fillRect(0, 0, 1, 1)
  const [r = 0, g = 0, b = 0, a = 0] = paint.getImageData(0, 0, 1, 1).data
  return [r, g, b, a / 255]
}

const channel = (value: number) => {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
}
const luminance = ([r, g, b]: [number, number, number, number]) =>
  0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)

/** WCAG 2 contrast ratio between two opaque CSS colours. */
export function contrastRatio(a: string, b: string): number {
  const [la, lb] = [luminance(rgbOf(a)), luminance(rgbOf(b))]
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

/**
 * A token's colour as the subtree of `element` resolves it (Dark or Light frame). Read from the
 * computed custom property (its var() references already substituted), so it never touches the
 * DOM: a play function's waitFor re-runs on every DOM mutation.
 */
export function tokenColour(name: `--${string}`, element: Element): string {
  return getComputedStyle(element).getPropertyValue(name).trim()
}

/** Whether two CSS colours paint the same pixel. */
export function sameColour(a: string, b: string): boolean {
  return rgbOf(a).join() === rgbOf(b).join()
}

/** The opaque inset rings (spread-only inset shadows) an element paints: colour and width. */
export function insetRings(element: Element): { colour: string; width: number }[] {
  const value = getComputedStyle(element).boxShadow
  if (value === 'none') return []
  const layers: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < value.length; i++) {
    if (value[i] === '(') depth += 1
    else if (value[i] === ')') depth -= 1
    else if (value[i] === ',' && depth === 0) {
      layers.push(value.slice(start, i))
      start = i + 1
    }
  }
  layers.push(value.slice(start))
  return layers
    .map((layer) => layer.trim())
    .filter((layer) => layer.endsWith('inset'))
    .map((layer) => {
      const colour = /^(\w+\([^)]*\)|#\w+|\w+)/.exec(layer)?.[1] ?? ''
      const lengths = layer
        .slice(colour.length)
        .match(/-?[\d.]+px/g)
        ?.map((length) => Number.parseFloat(length))
      return { colour, width: lengths?.[3] ?? 0 }
    })
    .filter((ring) => ring.width > 0 && (rgbOf(ring.colour)[3] ?? 0) > 0)
}

/** The nearest ancestor background that is painted (opaque), as the surface a control sits on. */
export function surfaceOf(element: Element): string {
  let node: Element | null = element.parentElement
  while (node) {
    const background = getComputedStyle(node).backgroundColor
    if ((rgbOf(background)[3] ?? 0) === 1) return background
    node = node.parentElement
  }
  return getComputedStyle(document.body).backgroundColor
}

/**
 * How an "on" state is drawn (s47 §4): the width of its ink edge (an inset ring in --selected),
 * that ink's contrast against the surface the control sits on, and the alpha of its own fill.
 */
export function inkEdgeOf(element: Element): { width: number; contrast: number; fill: number } {
  const ink = tokenColour('--selected', element)
  const ring = insetRings(element).find((candidate) => sameColour(candidate.colour, ink))
  return {
    width: ring?.width ?? 0,
    contrast: contrastRatio(ink, surfaceOf(element)),
    fill: rgbOf(getComputedStyle(element).backgroundColor)[3] ?? 0,
  }
}

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
