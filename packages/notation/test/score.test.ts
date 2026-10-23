import * as alphaTab from '@coderline/alphatab'
import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import { type Beats, buildTab, type Chords, type Notes } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { externalMediaHandler } from '../src/external-media.ts'
import { barBoxes, barFraction, cursorAt, noteBoxes } from '../src/geometry.ts'
import { applyTheme, tabLineSpacing } from '../src/resources.ts'
import { applyInk, applySyncPoints, loadScore, noteOf, resolveTimeline } from '../src/score.ts'
import type { BarTimes, NoteMark } from '../src/types.ts'

// The fixture song: 32 beats at 100 BPM (0.6 s apart from 0.5 s), 8 bars of 4/4, Am–F–C–G.
const built = buildTab(notes as Notes, beats as Beats, {}, { chords: chords as Chords })
const BAR_S = 2.4
const times: BarTimes = {
  firstBar: built.alphaTexFirstBar,
  beatsOf: (bar) => [0, 1, 2, 3].map((beat) => 0.5 + bar * BAR_S + beat * 0.6),
}

const score = () => loadScore(built.alphaTex, new alphaTab.Settings())
const timeline = resolveTimeline(score(), times)
const BARS = timeline.bars.length

describe('score model', () => {
  it('maps every noteMap entry to a rendered note on its string', () => {
    const s = score()
    expect(built.noteMap.length).toBeGreaterThan(0)
    for (const ref of built.noteMap) {
      const note = noteOf(s, ref)
      expect(note, ref.noteId).toBeDefined()
      expect(note?.string).toBe((s.tracks[0]?.staves[0]?.tuning.length ?? 6) - ref.string + 1)
    }
  })

  it('adds one sync point per downbeat plus the end of the last bar', () => {
    const s = score()
    applySyncPoints(s, timeline)
    const points = s.masterBars.map((bar) =>
      (bar.syncPoints ?? []).map((p) => [p.ratioPosition, p.syncPointValue?.millisecondOffset]),
    )
    expect(points[0]).toEqual([[0, 500]])
    expect(points[3]).toEqual([[0, 7700]])
    expect(points.at(-1)).toEqual([
      [0, Math.round((0.5 + (BARS - 1) * BAR_S) * 1000)],
      [1, Math.round((0.5 + BARS * BAR_S) * 1000)],
    ])
    // Replacing them doesn't stack old points.
    applySyncPoints(s, timeline)
    expect(s.masterBars[0]?.syncPoints).toHaveLength(1)
  })

  it('inks notes by confidence through NoteStyle', () => {
    const s = score()
    const [first, second] = built.noteMap
    const marks = new Map<string, NoteMark>([
      [first?.noteId ?? '', { level: 'low' }],
      [second?.noteId ?? '', { level: 'medium' }],
    ])
    const ink = {
      high: new alphaTab.model.Color(20, 20, 20),
      medium: new alphaTab.model.Color(60, 60, 60),
      low: new alphaTab.model.Color(90, 90, 90),
    }
    applyInk(s, built.noteMap, marks, ink)
    const fret = (index: number) =>
      noteOf(s, built.noteMap[index] as (typeof built.noteMap)[number])?.style?.colors.get(
        alphaTab.model.NoteSubElement.GuitarTabFretNumber,
      )
    expect(fret(0)).toBe(ink.low)
    expect(fret(1)).toBe(ink.medium)
    expect(fret(2)).toBe(ink.high)
  })

  it('applies the reading font and score colours', () => {
    const settings = new alphaTab.Settings()
    const staff = new alphaTab.model.Color(144, 144, 144)
    applyTheme(settings, {
      family: 'Inter, ui-sans-serif',
      tabPx: 36,
      barNumberPx: 20,
      ink: {
        high: new alphaTab.model.Color(20, 20, 20).rgba,
        medium: new alphaTab.model.Color(60, 60, 60).rgba,
        low: new alphaTab.model.Color(90, 90, 90).rgba,
      },
      staff: staff.rgba,
    })
    const resources = settings.display.resources
    expect(resources.tablatureFont.families).toEqual(['Inter', 'ui-sans-serif'])
    expect(resources.tablatureFont.size).toBe(36)
    expect(resources.barNumberFont.size).toBe(20)
    expect(resources.staffLineColor.rgba).toBe(staff.rgba)
    expect(resources.engravingSettings.tabLineSpacing).toBe(tabLineSpacing(36))
    const chordNames = resources.elementFonts.get(alphaTab.NotationElement.EffectChordNames)
    expect(chordNames?.families).toEqual(['Inter', 'ui-sans-serif'])
    expect(chordNames?.size).toBe(27)
  })

  it('spaces tab lines so stacked fret digits never touch', () => {
    const grey = (v: number) => new alphaTab.model.Color(v, v, v).rgba
    const bravura = alphaTab.EngravingSettings.bravuraDefaults.tabLineSpacing
    // Digits are ~0.73 em tall: every reading size gets lines taller than its digits.
    for (const px of [18, 24, 36, 45]) expect(tabLineSpacing(px)).toBeGreaterThan(px * 0.73 + 2)
    expect(tabLineSpacing(36)).toBe(34)
    // Small digits keep Bravura's own spacing.
    expect(tabLineSpacing(8)).toBe(bravura)
    // Each Settings has its own engraving copy: theming one score leaves the defaults alone.
    applyTheme(new alphaTab.Settings(), {
      family: 'Inter',
      tabPx: 45,
      barNumberPx: 20,
      ink: { high: grey(0), medium: grey(51), low: grey(85) },
      staff: grey(136),
    })
    expect(new alphaTab.Settings().display.resources.engravingSettings.tabLineSpacing).toBe(bravura)
  })
})

describe('timeline geometry', () => {
  it('finds the bar and the played fraction of it', () => {
    expect(barFraction(timeline, 0)).toEqual({ index: 0, fraction: 0 })
    expect(barFraction(timeline, 0.5)).toEqual({ index: 0, fraction: 0 })
    expect(barFraction(timeline, 0.5 + 0.9)?.fraction).toBeCloseTo(0.375)
    expect(barFraction(timeline, 0.5 + 3 * BAR_S + 0.3)).toEqual({ index: 3, fraction: 0.125 })
    expect(barFraction(timeline, 100)).toEqual({ index: BARS - 1, fraction: 1 })
  })

  // A hand-made lookup: two systems of four bars, 100 px per bar, beats evenly spaced.
  function lookup(s: alphaTab.model.Score) {
    const beatsByObject = new Map<alphaTab.model.Beat, unknown>()
    const systems = [0, 1].map((systemIndex) => {
      const system = {
        index: systemIndex,
        realBounds: { x: 0, y: systemIndex * 200, w: 400, h: 150 },
        bars: [] as unknown[],
      }
      for (let i = 0; i < 4; i++) {
        const index = systemIndex * 4 + i
        const bar = s.tracks[0]?.staves[0]?.bars[index]
        const masterBar = {
          index,
          realBounds: { x: i * 100, y: systemIndex * 200 + 20, w: 100, h: 100 },
          staffSystemBounds: system,
          bars: [] as unknown[],
        }
        const beatsInBar = bar?.voices[0]?.beats ?? []
        const beatBounds = beatsInBar.map((beat, k) => {
          const bounds = {
            beat,
            onNotesX: i * 100 + 10 + (k * 80) / beatsInBar.length,
            notes: beat.notes.map((note) => ({
              note,
              noteHeadBounds: { x: i * 100 + 10, y: systemIndex * 200 + 40, w: 8, h: 10 },
            })),
          }
          beatsByObject.set(beat, bounds)
          return bounds
        })
        masterBar.bars.push({ beats: beatBounds })
        system.bars.push(masterBar)
      }
      return system
    })
    return {
      staffSystems: systems,
      findBeat: (beat: alphaTab.model.Beat) => beatsByObject.get(beat) ?? null,
    } as unknown as alphaTab.rendering.BoundsLookup
  }

  it('boxes every bar at its system height', () => {
    const boxes = barBoxes(lookup(score()))
    expect(BARS).toBeGreaterThanOrEqual(8)
    expect(boxes).toHaveLength(8)
    expect(boxes[5]).toEqual({ index: 5, system: 1, x: 100, y: 200, w: 100, h: 150 })
  })

  it('moves the cursor through the bar and onto the next system', () => {
    const s = score()
    const l = lookup(s)
    const start = cursorAt(l, s, timeline, 0.5)
    expect(start).toMatchObject({ index: 0, y: 0, h: 150 })
    const mid = cursorAt(l, s, timeline, 0.5 + 1.2)
    expect(mid?.x).toBeGreaterThan(start?.x ?? 0)
    expect(mid?.x).toBeLessThan(100)
    const later = cursorAt(l, s, timeline, 0.5 + 4 * BAR_S + 0.01)
    expect(later).toMatchObject({ index: 4, y: 200 })
    // Monotonic within a bar at fine steps.
    let previous = -1
    for (let t = 0.5; t < 0.5 + BAR_S; t += 0.01) {
      const x = cursorAt(l, s, timeline, t)?.x ?? 0
      expect(x).toBeGreaterThanOrEqual(previous)
      previous = x
    }
  })

  it('places note boxes with their marks', () => {
    const s = score()
    const first = built.noteMap[0]
    const boxes = noteBoxes(
      lookup(s),
      s,
      built.noteMap,
      new Map([[first?.noteId ?? '', { level: 'low', timingFlagged: true }]]),
    )
    expect(boxes).toHaveLength(built.noteMap.length)
    expect(boxes[0]).toMatchObject({ noteId: first?.noteId, level: 'low', timingFlagged: true })
    expect(boxes[1]?.level).toBe('high')
  })
})

describe('external media handler', () => {
  it('reports the duration, keeps alphaTab at speed 1 and never drives playback', () => {
    let durationCalls = 0
    const handler = externalMediaHandler({
      duration: () => {
        durationCalls++
        return 20.5
      },
    })
    expect(handler.backingTrackDuration).toBe(20500)
    expect(handler.playbackRate).toBe(1)
    // A score reload calls these; they must not reach the engine (nothing to call here).
    handler.seekTo(1500)
    handler.play()
    handler.pause()
    expect(durationCalls).toBe(1)
  })
})
