import * as alphaTab from '@coderline/alphatab'
import type { BarTimes, ConfidenceLevel, NotationTimeline, NoteMark, NoteRef } from './types.ts'

// The score model between alphaTex and the renderer: import once on the main thread, add sync
// points and per-note ink, then hand the model to the API (renderScore), which serialises it to
// the render worker. alphaTex has no custom note properties, hence `NoteRef` (07 §8).

export function loadScore(tex: string, settings: alphaTab.Settings): alphaTab.model.Score {
  const importer = new alphaTab.importer.AlphaTexImporter()
  importer.logErrors = false
  importer.initFromString(tex, settings)
  return importer.readScore()
}

/** The alphaTab note a NoteRef points at (undefined when the score doesn't have it). */
export function noteOf(score: alphaTab.model.Score, ref: NoteRef): alphaTab.model.Note | undefined {
  return score.tracks[0]?.staves[ref.staff ?? 0]?.bars[ref.bar]?.voices[ref.voice]?.beats[ref.beat]
    ?.notes[ref.note]
}

/** The rendered bars' times: as many bars as the score has, from the beat grid. */
export function resolveTimeline(score: alphaTab.model.Score, times: BarTimes): NotationTimeline {
  const count = score.masterBars.length
  return {
    firstBar: times.firstBar,
    bars: Array.from({ length: count }, (_, i) => ({ beats: times.beatsOf(times.firstBar + i) })),
    end: times.beatsOf(times.firstBar + count)[0] ?? 0,
  }
}

// One sync point per downbeat (12 §3): alphaTab's tick ↔ time map then follows the beat grid,
// rubato and drifting live takes included. A final one at the end of the last bar closes the
// last interval.
export function applySyncPoints(score: alphaTab.model.Score, timeline: NotationTimeline): void {
  score.masterBars.forEach((masterBar, index) => {
    masterBar.syncPoints = undefined
    const start = timeline.bars[index]?.beats[0]
    if (start !== undefined) masterBar.addSyncPoint(syncPoint(start, 0))
  })
  const last = score.masterBars.at(-1)
  if (last && timeline.bars.length === score.masterBars.length) {
    last.addSyncPoint(syncPoint(timeline.end, 1))
  }
}

function syncPoint(seconds: number, ratioPosition: number): alphaTab.model.Automation {
  const automation = new alphaTab.model.Automation()
  automation.type = alphaTab.model.AutomationType.SyncPoint
  automation.ratioPosition = ratioPosition
  const data = new alphaTab.model.SyncPointData()
  data.barOccurence = 0
  data.millisecondOffset = Math.round(seconds * 1000)
  automation.syncPointValue = data
  return automation
}

export type InkColors = Record<ConfidenceLevel, alphaTab.model.Color>

// Confidence ink per note via NoteStyle (26 §5): fret number and notehead, in the token colours
// (readColor → Color.fromJson). Every level keeps ≥4.5:1, so the ink alone never hides a digit.
export function applyInk(
  score: alphaTab.model.Score,
  noteMap: readonly NoteRef[],
  marks: ReadonlyMap<string, NoteMark>,
  colors: InkColors,
): void {
  for (const ref of noteMap) {
    const note = noteOf(score, ref)
    if (!note) continue
    const color = colors[marks.get(ref.noteId)?.level ?? 'high']
    const style = new alphaTab.model.NoteStyle()
    style.colors.set(alphaTab.model.NoteSubElement.GuitarTabFretNumber, color)
    style.colors.set(alphaTab.model.NoteSubElement.StandardNotationNoteHead, color)
    note.style = style
  }
}
