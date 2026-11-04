import {
  type Instrument,
  instrumentProfile,
  type LoopClip,
  type PlayerState,
  type PracticeLevel,
} from '@splitune/contracts'
import type { z } from 'zod'
import type { PracticeGrid } from './grid'
import { barRange, type LoopRange } from './loops'
import type { Mix, MixPreset } from './mixer'

// Resume (13 §5): where a practice screen starts. Search params come first (bookmarkable), then
// the song's player_state. Pure: the provider applies the plan once the song, its clips and (when
// a loop needs bars) the beat grid are in.

type Level = z.infer<typeof PracticeLevel>
type Clip = z.infer<typeof LoopClip>

export interface PracticeSearch {
  view?: 'tab' | 'chords' | undefined
  loop?: string | undefined
  speed?: number | undefined
  mix?: 'your-part' | 'minus-one' | 'original' | undefined
  /** The level toggle's start (07 §6); ignored if the song's instrument has no such level. */
  level?: Level | undefined
}

export interface ResumeInput {
  search: PracticeSearch
  saved: z.infer<typeof PlayerState>
  instrument: z.infer<typeof Instrument>
  /** The level the toggle holds now (the default of the instrument assumed before the song). */
  level: Level
  /** The stems' channels are listed, so a preset can be applied to them. */
  channels: boolean
  grid: PracticeGrid | undefined
  clips: readonly Clip[]
}

export interface ResumePlan {
  /** A level to switch to; none keeps the current one. */
  level?: Level
  speed?: number
  mix: { preset: MixPreset } | { saved: Mix | undefined }
  /** "Show tab anyway" was asked for (?view=tab) or saved. */
  forceTab: boolean
  /** A ?loop= range (a new clip) or the saved clip. */
  loop: { range: LoopRange } | { clip: Clip } | null
  seek?: number
}

const PRESET_PARAM: Record<NonNullable<PracticeSearch['mix']>, MixPreset> = {
  'your-part': 'part-loud',
  'minus-one': 'minus-one',
  original: 'original',
}

export function planResume({
  search,
  saved,
  instrument,
  level,
  channels,
  grid,
  clips,
}: ResumeInput): ResumePlan {
  // The level toggle starts at the requested level, or the instrument's default once known.
  const { levels, defaultLevel } = instrumentProfile(instrument)
  const startLevel =
    search.level && levels.includes(search.level)
      ? search.level
      : levels.includes(level)
        ? undefined
        : defaultLevel
  const speed = search.speed ?? saved.speed_pct
  const view = search.view ?? (saved.view === 'chords_only' ? 'chords' : undefined)
  const fromUrl = grid ? parseLoopParam(search.loop, grid) : null
  const clip = clips.find((c) => c.id === saved.selected_loop_id)
  return {
    ...(startLevel ? { level: startLevel } : {}),
    ...(speed === undefined ? {} : { speed }),
    // A preset needs the channels; without them the saved mix waits for the stems.
    mix:
      search.mix && channels
        ? { preset: PRESET_PARAM[search.mix] }
        : { saved: saved.mix as Mix | undefined },
    forceTab: view === 'tab',
    loop: fromUrl ? { range: fromUrl } : clip ? { clip } : null,
    ...(saved.position_s === undefined ? {} : { seek: saved.position_s }),
  }
}

function parseLoopParam(param: string | undefined, grid: PracticeGrid): LoopRange | null {
  const match = param?.match(/^(\d+)-(\d+)$/)
  if (!match) return null
  // URL bars are 1-based (27 §5.3).
  return barRange(grid, Number(match[1]) - 1, Number(match[2]) - 1)
}
