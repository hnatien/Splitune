// The self-hosted fonts keep what doc 26 §6.1 needs (28 §3 "Fonts"): every listed code point, tabular
// figures, the weights the type scale uses, and a preloaded file within the 80 KB budget. Reads the
// WOFF2 files scripts/fonts/subset.sh writes; no browser (the width check in a browser is the
// Foundations/Fonts story's play function).
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  advanceOf,
  isFixedPitch,
  readAxes,
  readCmap,
  readGsubFeatures,
  readTables,
} from './woff2.mjs'

const ROOT = new URL('../../', import.meta.url)
const FONTS = new URL('apps/web/public/fonts/', ROOT)
const read = (path) => readFileSync(new URL(path, ROOT), 'utf8')
const range = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i)
const hex = (cp) => `U+${cp.toString(16).toUpperCase().padStart(4, '0')}`

const PRELOAD_BUDGET = 80 * 1024
const DIGITS = range(0x30, 0x39)
// §6.1 by name: − · × ÷ → ← ↑ ↓ ‹ › – — and the narrow no-break space U+202F. A family must have
// every one; ♯ ♭ ♮ are kept where a family has them (ChordSymbol draws the missing ones from the
// fallback), so they aren't required here.
const NAMED = [
  0xb7,
  0xd7,
  0xf7,
  ...range(0x2190, 0x2193),
  0x2039,
  0x203a,
  0x2013,
  0x2014,
  0x202f,
  0x2212,
]
// §6.1 by range: Latin, Latin-1 and the common punctuation, less what the upstream family itself
// lacks (gaps below), which falls back to the next font in the stack.
const UI = [
  ...range(0x20, 0x7e),
  ...range(0xa0, 0xff),
  0x2018,
  0x2019,
  0x201c,
  0x201d,
  0x2026,
  ...NAMED,
]
// The opt-in reading font sets digits, chord names and readouts only.
const READING = [...range(0x20, 0x7e), ...range(0xa0, 0xff), 0x2013, 0x2014, 0x2212]
// Upstream gaps, checked against the pinned sources in subset.sh: none is in NAMED or in the copy
// (U+00AD, the soft hyphen, is never drawn).
const INSTRUMENT_SANS_GAPS = [
  0xa4, 0xa6, 0xac, 0xad, 0xb1, 0xb2, 0xb3, 0xb5, 0xb9, 0xbc, 0xbd, 0xbe,
]
const ATKINSON_GAPS = [0xad, 0xb5]

const SHIPPED = {
  'InstrumentSans.woff2': {
    codePoints: UI,
    gaps: INSTRUMENT_SANS_GAPS,
    tabular: 'tnum',
    features: ['tnum', 'case', 'ss01'],
    wght: [400, 700],
  },
  'JetBrainsMono.woff2': {
    codePoints: UI,
    gaps: [],
    tabular: 'monospaced',
    features: ['zero', 'case', 'cv01'],
    wght: [400, 700],
  },
  'AtkinsonHyperlegibleNext.woff2': {
    codePoints: READING,
    gaps: ATKINSON_GAPS,
    tabular: 'tnum',
    features: ['tnum', 'case'],
    wght: [200, 800],
  },
}

describe('shipped fonts', () => {
  it('are exactly these, each with its OFL licence beside it', () => {
    const files = readdirSync(FONTS).sort()
    const fonts = Object.keys(SHIPPED).sort()
    expect(files.filter((name) => name.endsWith('.woff2'))).toEqual(fonts)
    expect(files.filter((name) => name.endsWith('-OFL.txt'))).toEqual(
      fonts.map((name) => name.replace('.woff2', '-OFL.txt')),
    )
    for (const name of fonts) {
      expect(readFileSync(new URL(name.replace('.woff2', '-OFL.txt'), FONTS), 'utf8')).toContain(
        'SIL OPEN FONT LICENSE Version 1.1',
      )
    }
  })

  it('are each declared once in fonts.css', () => {
    const css = read('packages/ui-tokens/src/fonts.css')
    const urls = [...css.matchAll(/url\("\/fonts\/([^"]+)"\)/g)].map((m) => m[1]).sort()
    expect(urls).toEqual(Object.keys(SHIPPED).sort())
  })

  it('preload only Instrument Sans, within the 80 KB preload budget', () => {
    const preloads = ['apps/web/app/routes/__root.tsx', 'apps/web/.storybook/main.ts'].flatMap(
      (path) => [...read(path).matchAll(/\/fonts\/[\w-]+\.woff2/g)].map((m) => m[0]),
    )
    expect([...new Set(preloads)]).toEqual(['/fonts/InstrumentSans.woff2'])
    expect(statSync(new URL('InstrumentSans.woff2', FONTS)).size).toBeLessThanOrEqual(
      PRELOAD_BUDGET,
    )
  })
})

describe.each(Object.entries(SHIPPED))('%s', (file, expected) => {
  const tables = readTables(new URL(file, FONTS))
  const cmap = readCmap(tables)

  it('covers the §6.1 code points, apart from its known upstream gaps', () => {
    expect(expected.gaps.filter((cp) => NAMED.includes(cp)).map(hex)).toEqual([])
    const missing = expected.codePoints.filter((cp) => !cmap.has(cp))
    expect(missing.map(hex)).toEqual(expected.gaps.map(hex))
  })

  it(`keeps tabular figures (${expected.tabular})`, () => {
    const advances = new Set(DIGITS.map((cp) => advanceOf(tables, cmap.get(cp))))
    if (expected.tabular === 'tnum') {
      expect(readGsubFeatures(tables)).toContain('tnum')
    } else {
      // A monospaced font has no tnum: its digits are tabular as drawn.
      expect(isFixedPitch(tables)).toBe(true)
      expect(advances.size).toBe(1)
    }
  })

  it('keeps layout features pyftsubset drops by default (tnum, zero, case, ss*, cv*)', () => {
    const features = readGsubFeatures(tables)
    expect(expected.features.filter((tag) => !features.has(tag))).toEqual([])
  })

  it('keeps the weights the type scale uses, on a wght axis only (roman, wdth 100)', () => {
    const axes = readAxes(tables)
    expect(Object.keys(axes)).toEqual(['wght'])
    const [min, , max] = axes.wght ?? []
    expect([min, max]).toEqual(expected.wght)
  })
})
