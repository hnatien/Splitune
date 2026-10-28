import { type BeatGrid, barOfBeat, PPQ, positionOfTick } from '../grid/beatgrid.ts'
import type { DrumHit } from '../types.ts'

// Drum levels (step 25, V13). Deterministic; the UI explains each rule.
// - as_transcribed: every hit.
// - core_groove: kick, snare and the time line (hi-hat, or ride when the time is kept on the
//   ride) on the song's main pattern. Toms, crashes and other cymbals are dropped. A fill bar (a
//   bar holding less than FILL_SHARE of the main pattern of bars of its length: the groove stops
//   for the fill) is replaced by that main pattern. A fill of a beat or less at the end of a bar
//   keeps most of the pattern, so it stays as played.
// - simplified: every hit, with the hi-hat thinned to eighths (on the beat and the "and"; in a
//   swing bar, the beat and the third triplet). Ghost notes would also go, but notes.drums has no
//   velocity yet, so none are dropped.
// The main pattern of a bar length is every (kit piece, position in bar) found in at least half
// of the non-pickup bars of that length that have hits.

export type DrumLevel = 'as_transcribed' | 'core_groove' | 'simplified'

export const FILL_SHARE = 0.5

export interface LevelHit {
  id: string
  class5: DrumHit['class5']
  gmNote: number
  onTick: number
  confidence: number
}

const RIDES: ReadonlySet<number> = new Set([51, 53, 59])
const timeLine = (h: Pick<LevelHit, 'class5' | 'gmNote'>) =>
  h.class5 === 'hihat' || (h.class5 === 'cymbals' && RIDES.has(h.gmNote))
const core = (h: Pick<LevelHit, 'class5' | 'gmNote'>) =>
  h.class5 === 'kick' || h.class5 === 'snare' || timeLine(h)

interface Placed {
  bar: number
  startTick: number // the bar's first tick
  length: number // beats
  offset: number // ticks from the bar's start
}

function place(grid: BeatGrid, onTick: number): Placed {
  const position = positionOfTick(grid, onTick)
  const offset = (position.beat - 1) * PPQ + position.tick
  const { length } = barOfBeat(grid, Math.floor(onTick / PPQ))
  return { bar: position.bar, startTick: onTick - offset, length, offset }
}

const element = (h: Pick<LevelHit, 'gmNote'>, offset: number) => `${h.gmNote}@${offset}`

export interface MainPattern {
  // Per bar length (beats): the elements of the main pattern and the share of bars holding each.
  byLength: Map<number, Map<string, number>>
  fillBars: number[]
}

export function drumMainPattern(hits: readonly LevelHit[], grid: BeatGrid): MainPattern {
  const bars = new Map<number, { length: number; elements: Set<string> }>()
  for (const h of hits) {
    const p = place(grid, h.onTick)
    if (p.bar < 0) continue
    const bar = bars.get(p.bar) ?? { length: p.length, elements: new Set<string>() }
    bar.elements.add(element(h, p.offset))
    bars.set(p.bar, bar)
  }
  const byLength = new Map<number, Map<string, number>>()
  for (const length of new Set([...bars.values()].map((b) => b.length))) {
    const same = [...bars.values()].filter((b) => b.length === length)
    const counts = new Map<string, number>()
    for (const b of same) for (const e of b.elements) counts.set(e, (counts.get(e) ?? 0) + 1)
    byLength.set(
      length,
      new Map(
        [...counts]
          .filter(([, n]) => n * 2 >= same.length)
          .map(([e, n]) => [e, n / same.length] as const),
      ),
    )
  }
  const fillBars = [...bars]
    .filter(([, b]) => {
      const main = byLength.get(b.length) ?? new Map<string, number>()
      const held = [...main.keys()].filter((e) => b.elements.has(e)).length
      return main.size > 0 && held / main.size < FILL_SHARE
    })
    .map(([bar]) => bar)
    .sort((a, b) => a - b)
  return { byLength, fillBars }
}

// A hit of the main pattern written into a fill bar: not in notes.drums, so its id is
// `groove:{bar}:{gm}@{offset}` and its confidence is the share of bars that hold it.
export interface GrooveHit extends LevelHit {
  generated: true
}

export function drumsAtLevel<T extends LevelHit>(
  hits: readonly T[],
  level: DrumLevel,
  grid: BeatGrid,
  swingBars: readonly number[],
): { hits: (T | GrooveHit)[]; fillBars: number[] } {
  const pattern = drumMainPattern(hits, grid)
  if (level === 'as_transcribed') return { hits: [...hits], fillBars: pattern.fillBars }
  if (level === 'simplified') {
    const swing = new Set(swingBars)
    return {
      hits: hits.filter((h) => {
        if (h.class5 !== 'hihat') return true
        const p = place(grid, h.onTick)
        const inBeat = p.offset % PPQ
        return swing.has(p.bar)
          ? inBeat === 0 || inBeat === (2 * PPQ) / 3
          : inBeat % (PPQ / 2) === 0
      }),
      fillBars: pattern.fillBars,
    }
  }
  const fills = new Set(pattern.fillBars)
  const kept: (T | GrooveHit)[] = hits.filter(
    (h) => core(h) && !fills.has(place(grid, h.onTick).bar),
  )
  const firstHit = new Map<number, Placed>()
  for (const h of hits) {
    const p = place(grid, h.onTick)
    if (fills.has(p.bar) && !firstHit.has(p.bar)) firstHit.set(p.bar, p)
  }
  for (const [bar, p] of firstHit) {
    for (const [e, share] of pattern.byLength.get(p.length) ?? []) {
      const [gm, offset] = e.split('@').map(Number) as [number, number]
      const sample = hits.find((h) => h.gmNote === gm)
      if (sample === undefined || !core(sample)) continue
      kept.push({
        id: `groove:${bar}:${e}`,
        class5: sample.class5,
        gmNote: gm,
        onTick: p.startTick + offset,
        confidence: share,
        generated: true,
      })
    }
  }
  kept.sort((a, b) => a.onTick - b.onTick || a.gmNote - b.gmNote)
  return { hits: kept, fillBars: pattern.fillBars }
}
