import { type BeatGrid, tickOfPosition, tickToTime } from '@splitune/music-core'
import type { FretNote } from '@splitune/notation'
import type { MusicTab } from './music'
import type { ViewModel } from './view-model'

// Guitar and bass Notes (step 18b): the tab's notes where the tab puts them, on the quantized
// grid (as piano's roll), so the lanes, the neck and the tab cursor agree on one clock. Notes the
// tab couldn't place on the neck become "!" markers (26 §5), as on the tab.

export function fretNotes(
  tab: Pick<MusicTab, 'events'>,
  view: Pick<ViewModel, 'notes' | 'marks'>,
  grid: BeatGrid,
): { notes: FretNote[]; markers: { t: number; label: string }[] } {
  const levels = new Map(view.notes.map((n) => [n.id, n.confidence]))
  const notes: FretNote[] = []
  const markers: { t: number; label: string }[] = []
  for (const event of tab.events) {
    const tick = tickOfPosition(grid, event)
    const t0 = tickToTime(grid, tick)
    if (event.string === undefined || event.fret === undefined) {
      markers.push({ t: t0, label: '!' })
      continue
    }
    notes.push({
      id: event.note_id,
      string: event.string,
      fret: event.fret,
      t0,
      t1: tickToTime(grid, tick + event.duration_ticks),
      band: levels.get(event.note_id) ?? 'high',
      octave: view.marks.get(event.note_id)?.octave,
    })
  }
  notes.sort((a, b) => a.t0 - b.t0 || a.string - b.string)
  markers.sort((a, b) => a.t - b.t)
  return { notes, markers }
}

/** The strings' names, string 1 first, spelled from the song's note names; the top string is
 * lowercase when it shares the bottom one's letter (e over E). */
export function stringNames(tuningMidi: readonly number[], noteNames: readonly string[]): string[] {
  const names = tuningMidi.map((midi) => noteNames[((midi % 12) + 12) % 12] ?? '')
  const top = names[0]
  if (names.length > 1 && top && top === names[names.length - 1]) names[0] = top.toLowerCase()
  return names
}
