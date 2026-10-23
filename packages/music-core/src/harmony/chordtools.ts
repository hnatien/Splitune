// Harte chord labels (Harte et al., ISMIR 2005, as used by mir_eval): `root:shorthand(degrees)/bass`,
// plus `N` (no chord) and `X` (unknown).

export type Spelling = 'sharp' | 'flat' | 'auto'

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'] as const
// Most common spelling of each pitch class in chord charts.
const AUTO_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'] as const

const LETTER_PC: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

export const SHORTHAND_INTERVALS: Readonly<Record<string, readonly number[]>> = {
  maj: [0, 4, 7],
  min: [0, 3, 7],
  dim: [0, 3, 6],
  aug: [0, 4, 8],
  maj7: [0, 4, 7, 11],
  min7: [0, 3, 7, 10],
  '7': [0, 4, 7, 10],
  dim7: [0, 3, 6, 9],
  hdim7: [0, 3, 6, 10],
  minmaj7: [0, 3, 7, 11],
  maj6: [0, 4, 7, 9],
  min6: [0, 3, 7, 9],
  '9': [0, 4, 7, 10, 2],
  maj9: [0, 4, 7, 11, 2],
  min9: [0, 3, 7, 10, 2],
  '11': [0, 4, 7, 10, 2, 5],
  min11: [0, 3, 7, 10, 2, 5],
  '13': [0, 4, 7, 10, 2, 9],
  maj13: [0, 4, 7, 11, 2, 9],
  min13: [0, 3, 7, 10, 2, 9],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  '1': [0],
  '5': [0, 7],
}

const DEGREE_SEMITONES: Readonly<Record<string, number>> = {
  '1': 0,
  '2': 2,
  '3': 4,
  '4': 5,
  '5': 7,
  '6': 9,
  '7': 11,
  '9': 14,
  '11': 17,
  '13': 21,
}

export type ParsedChord =
  | { kind: 'none' } // N
  | { kind: 'unknown' } // X
  | {
      kind: 'chord'
      root: number // pitch class
      rootName: string // as written
      shorthand: string | null
      degrees: string[] // extra or omitted ("*3") degrees in parentheses
      pitchClasses: number[] // sorted, relative to C
      bassDegree: string | null // "/3"
      bassPc: number | null
    }

export function pcOfName(name: string): number | null {
  const match = /^([A-G])([#b]*)$/.exec(name)
  if (match === null) return null
  let pc = LETTER_PC[match[1] as string] as number
  for (const accidental of match[2] ?? '') pc += accidental === '#' ? 1 : -1
  return ((pc % 12) + 12) % 12
}

function degreeSemitones(degree: string): number | null {
  const match = /^([#b]*)(\d+)$/.exec(degree)
  if (match === null) return null
  const base = DEGREE_SEMITONES[match[2] as string]
  if (base === undefined) return null
  let semis = base
  for (const accidental of match[1] ?? '') semis += accidental === '#' ? 1 : -1
  return semis
}

export function parseChord(label: string): ParsedChord | null {
  if (label === 'N') return { kind: 'none' }
  if (label === 'X') return { kind: 'unknown' }
  const match = /^([A-G][#b]*)(?::([^(/]*))?(?:\(([^)]*)\))?(?:\/([#b]*\d+))?$/.exec(label)
  if (match === null) return null
  const rootName = match[1] as string
  const root = pcOfName(rootName)
  if (root === null) return null
  const shorthandText = match[2]
  const degrees = match[3] === undefined || match[3] === '' ? [] : match[3].split(',')
  // A bare root is a major triad; `C:(1,3)` with an empty shorthand has only its degrees.
  const shorthand =
    shorthandText === undefined ? 'maj' : shorthandText === '' ? null : shorthandText
  let intervals: Set<number>
  if (shorthand === null) intervals = new Set([0])
  else {
    const base = SHORTHAND_INTERVALS[shorthand]
    if (base === undefined) return null
    intervals = new Set(base.map((s) => s % 12))
  }
  for (const degree of degrees) {
    const omit = degree.startsWith('*')
    const semis = degreeSemitones(omit ? degree.slice(1) : degree)
    if (semis === null) return null
    if (omit) intervals.delete(semis % 12)
    else intervals.add(semis % 12)
  }
  const bassDegree = match[4] ?? null
  let bassPc: number | null = null
  if (bassDegree !== null) {
    const semis = degreeSemitones(bassDegree)
    if (semis === null) return null
    bassPc = (root + semis) % 12
  }
  return {
    kind: 'chord',
    root,
    rootName,
    shorthand,
    degrees,
    pitchClasses: [...intervals].map((s) => (root + s) % 12).sort((a, b) => a - b),
    bassDegree,
    bassPc,
  }
}

// Canonical form: always writes the shorthand (`C` → `C:maj`), as chord models emit it.
export function formatChord(chord: ParsedChord): string {
  if (chord.kind === 'none') return 'N'
  if (chord.kind === 'unknown') return 'X'
  let label = `${chord.rootName}:${chord.shorthand ?? ''}`
  if (chord.degrees.length > 0) label += `(${chord.degrees.join(',')})`
  if (chord.bassDegree !== null) label += `/${chord.bassDegree}`
  return label
}

export function pcName(pc: number, spelling: Spelling): string {
  const table = spelling === 'sharp' ? SHARP_NAMES : spelling === 'flat' ? FLAT_NAMES : AUTO_NAMES
  return table[((pc % 12) + 12) % 12] as string
}

function spellingOf(name: string, requested: Spelling): Spelling {
  if (requested !== 'auto') return requested
  if (name.includes('#')) return 'sharp'
  if (name.length > 1 && name.endsWith('b')) return 'flat'
  return 'auto'
}

export function transposeNoteName(
  name: string,
  semitones: number,
  spelling: Spelling = 'auto',
): string {
  const pc = pcOfName(name)
  if (pc === null) throw new RangeError(`not a note name: ${name}`)
  return pcName(pc + semitones, spellingOf(name, spelling))
}

// Transposes the root; the accidental style of the input is kept unless `spelling` is given.
export function transposeChord(
  label: string,
  semitones: number,
  spelling: Spelling = 'auto',
): string {
  const parsed = parseChord(label)
  if (parsed === null) throw new RangeError(`not a Harte chord label: ${label}`)
  if (parsed.kind !== 'chord') return label
  const rootName = transposeNoteName(parsed.rootName, semitones, spelling)
  return label.replace(/^[A-G][#b]*/, rootName)
}

// Triad simplification for the `simplified` level: drops sevenths, extensions and inversions.
export function simplifyToTriad(label: string): string {
  const parsed = parseChord(label)
  if (parsed === null || parsed.kind !== 'chord') return label
  const rel = new Set(parsed.pitchClasses.map((pc) => (pc - parsed.root + 12) % 12))
  let quality: string
  if (rel.has(4) && rel.has(8) && !rel.has(7)) quality = 'aug'
  else if (rel.has(3) && rel.has(6) && !rel.has(7)) quality = 'dim'
  else if (rel.has(4)) quality = 'maj'
  else if (rel.has(3)) quality = 'min'
  else if (rel.has(5) && rel.has(7)) quality = 'sus4'
  else if (rel.has(2) && rel.has(7)) quality = 'sus2'
  else if (rel.has(7)) quality = '5'
  else quality = 'maj'
  return `${parsed.rootName}:${quality}`
}

// --- Shape library (standard tuning, written in the shapes key, i.e. relative to the capo) ---

export type ShapeKind = 'open' | 'barre'

export interface ChordShape {
  name: string // e.g. "A:min" or "B:min (A-shape barre, fret 2)"
  kind: ShapeKind
  // Index 0 = string 1 (high E). Fret relative to the capo; null = not played.
  frets: readonly (number | null)[]
  difficulty: number // open 1, barre 3 (07-music-algorithms.md §7)
}

// Written low E → high E like chord charts; converted to string order on load.
const OPEN_SHAPES: Readonly<Record<string, readonly string[]>> = {
  'C:maj': ['x32010'],
  'A:maj': ['x02220'],
  'G:maj': ['320003', '320033'],
  'E:maj': ['022100'],
  'D:maj': ['xx0232'],
  'A:min': ['x02210'],
  'E:min': ['022000'],
  'D:min': ['xx0231'],
  'C:7': ['x32310'],
  'A:7': ['x02020'],
  'G:7': ['320001'],
  'E:7': ['020100'],
  'D:7': ['xx0212'],
  'B:7': ['x21202'],
  'A:min7': ['x02010'],
  'E:min7': ['020000', '022030'],
  'D:min7': ['xx0211'],
  'C:maj7': ['x32000'],
  'A:maj7': ['x02120'],
  'G:maj7': ['320002'],
  'E:maj7': ['021100'],
  'D:maj7': ['xx0222'],
  'F:maj7': ['xx3210'],
  'A:sus2': ['x02200'],
  'A:sus4': ['x02230'],
  'D:sus2': ['xx0230'],
  'D:sus4': ['xx0233'],
  'E:sus4': ['022200'],
}

// Movable barre shapes: root on string 6 (E shape, open root E) or string 5 (A shape, root A).
const BARRE_SHAPES: Readonly<
  Record<string, readonly { root: number; chart: string; shape: string }[]>
> = {
  maj: [
    { root: 4, chart: '022100', shape: 'E' },
    { root: 9, chart: 'x02220', shape: 'A' },
  ],
  min: [
    { root: 4, chart: '022000', shape: 'E' },
    { root: 9, chart: 'x02210', shape: 'A' },
  ],
  '7': [
    { root: 4, chart: '020100', shape: 'E' },
    { root: 9, chart: 'x02020', shape: 'A' },
  ],
  min7: [
    { root: 4, chart: '020000', shape: 'E' },
    { root: 9, chart: 'x02010', shape: 'A' },
  ],
  maj7: [{ root: 9, chart: 'x02120', shape: 'A' }],
  sus4: [
    { root: 4, chart: '022200', shape: 'E' },
    { root: 9, chart: 'x02230', shape: 'A' },
  ],
  sus2: [{ root: 9, chart: 'x02200', shape: 'A' }],
}

const MAX_BARRE_FRET = 12

function chartToFrets(chart: string, offset: number): (number | null)[] {
  return [...chart].reverse().map((c) => (c === 'x' ? null : Number(c) + offset))
}

const OPEN_BY_KEY = new Map<string, ChordShape[]>()
for (const [label, charts] of Object.entries(OPEN_SHAPES)) {
  const parsed = parseChord(label)
  if (parsed === null || parsed.kind !== 'chord') throw new Error(`bad shape label ${label}`)
  OPEN_BY_KEY.set(
    `${parsed.root}:${parsed.shorthand}`,
    charts.map((chart) => ({
      name: label,
      kind: 'open',
      frets: chartToFrets(chart, 0),
      difficulty: 1,
    })),
  )
}

// Shapes for a chord in the shapes key (standard tuning). Slash basses are ignored.
export function chordShapes(label: string): ChordShape[] {
  const parsed = parseChord(label)
  if (parsed === null || parsed.kind !== 'chord' || parsed.degrees.length > 0) return []
  const quality = parsed.shorthand ?? ''
  const shapes = [...(OPEN_BY_KEY.get(`${parsed.root}:${quality}`) ?? [])]
  for (const barre of BARRE_SHAPES[quality] ?? []) {
    const fret = (parsed.root - barre.root + 12) % 12
    if (fret === 0 || fret > MAX_BARRE_FRET) continue
    shapes.push({
      name: `${formatChord(parsed)} (${barre.shape}-shape barre, fret ${fret})`,
      kind: 'barre',
      frets: chartToFrets(barre.chart, fret),
      difficulty: 3,
    })
  }
  return shapes
}

// Difficulty of the easiest shape: open 1, barre 3, anything without a shape 4; N/X cost 0.
export function shapeDifficulty(label: string): number {
  const parsed = parseChord(label)
  if (parsed === null) return 4
  if (parsed.kind !== 'chord') return 0
  const shapes = chordShapes(label)
  return shapes.length === 0 ? 4 : Math.min(...shapes.map((s) => s.difficulty))
}

export const STANDARD_GUITAR_TUNING: readonly number[] = [64, 59, 55, 50, 45, 40]

// Uniform offset of a 6-string tuning from standard (e.g. -1 for half-step down), or null when
// the intervals differ (drop D, open tunings) and the standard shape library does not apply.
export function tuningOffset(tuningMidi: readonly number[]): number | null {
  if (tuningMidi.length !== STANDARD_GUITAR_TUNING.length) return null
  const offset = (tuningMidi[0] as number) - (STANDARD_GUITAR_TUNING[0] as number)
  return tuningMidi.every((p, i) => p - (STANDARD_GUITAR_TUNING[i] as number) === offset)
    ? offset
    : null
}

const DISPLAY_SUFFIX: Readonly<Record<string, string>> = {
  maj: '',
  min: 'm',
  dim: 'dim',
  aug: 'aug',
  maj7: 'maj7',
  min7: 'm7',
  '7': '7',
  dim7: 'dim7',
  hdim7: 'm7b5',
  minmaj7: 'm(maj7)',
  maj6: '6',
  min6: 'm6',
  '9': '9',
  maj9: 'maj9',
  min9: 'm9',
  '11': '11',
  min11: 'm11',
  '13': '13',
  maj13: 'maj13',
  min13: 'm13',
  sus2: 'sus2',
  sus4: 'sus4',
  '1': '(no 3, no 5)',
  '5': '5',
}

// Chart name for display ("A:min7/b7" → "Am7/G"); the slash bass comes from the label or from
// ChordSegment.bass. Unparseable labels are returned unchanged; N is shown as "N.C.". `names`
// (`keyNoteNames`) respells the root and bass for the song's key; without it they keep the
// label's own spelling.
export function chordDisplayName(label: string, bass?: string, names?: readonly string[]): string {
  const parsed = parseChord(label)
  if (parsed === null) return label
  if (parsed.kind === 'none') return 'N.C.'
  if (parsed.kind === 'unknown') return '?'
  const suffix =
    parsed.shorthand === null ? '' : (DISPLAY_SUFFIX[parsed.shorthand] ?? `:${parsed.shorthand}`)
  const extras = parsed.degrees.length > 0 ? `(${parsed.degrees.join(',')})` : ''
  const spelling = spellingOf(parsed.rootName, 'auto')
  const bassPc = bass === undefined ? parsed.bassPc : pcOfName(bass)
  const bassName =
    names && bassPc !== null
      ? names[bassPc]
      : (bass ?? (parsed.bassPc === null ? undefined : pcName(parsed.bassPc, spelling)))
  const rootName = names?.[parsed.root] ?? parsed.rootName
  return `${rootName}${suffix}${extras}${bassName === undefined ? '' : `/${bassName}`}`
}
