import beats from '@splitune/contracts/fixtures/beats.json'
import type { Beats } from '@splitune/music-core'
import { describe, expect, it } from 'vitest'
import { practiceGrid } from './grid'
import { barRange } from './loops'
import { planResume, type ResumeInput } from './resume'

const grid = practiceGrid(beats as Beats)

const clip = {
  id: '00000000-0000-4000-8000-000000000001',
  song_id: '00000000-0000-4000-8000-000000000002',
  name: null,
  start_bar: 2,
  end_bar: 3,
  start_s: grid.barStart(2),
  end_s: grid.barStart(4),
  start_beat: 8,
  end_beat: 16,
  count_in_bars: 0,
  rest_between: 'none',
  best_clean_tempo_pct: null,
  created_at: '2026-11-04T10:00:00Z',
  updated_at: '2026-11-04T10:00:00Z',
} as unknown as ResumeInput['clips'][number]

const plan = (input: Partial<ResumeInput>) =>
  planResume({
    search: {},
    saved: {},
    instrument: 'guitar',
    level: 'as_transcribed',
    channels: true,
    grid,
    clips: [],
    ...input,
  })

describe('planResume', () => {
  it('starts fresh with nothing saved or asked for', () => {
    expect(plan({})).toEqual({ mix: { saved: undefined }, forceTab: false, loop: null })
  })

  it('starts the level toggle at a requested level the instrument has', () => {
    expect(plan({ search: { level: 'simplified' } }).level).toBe('simplified')
    expect(plan({ search: { level: 'roots' } }).level).toBeUndefined()
  })

  it("moves a level assumed before the song loaded to the instrument's default", () => {
    expect(plan({ instrument: 'bass' }).level).toBe('full')
    expect(plan({ instrument: 'bass', search: { level: 'roots' } }).level).toBe('roots')
    expect(plan({ instrument: 'drums', level: 'chords_only' }).level).toBe('as_transcribed')
  })

  it('takes the speed from the URL over the saved one', () => {
    expect(plan({ saved: { speed_pct: 80 } }).speed).toBe(80)
    expect(plan({ search: { speed: 70 }, saved: { speed_pct: 80 } }).speed).toBe(70)
  })

  it('applies a mix preset once the channels are listed, else keeps the saved mix', () => {
    const mix = { bass: { gain_db: -6, muted: false, solo: false } }
    expect(plan({ search: { mix: 'minus-one' }, saved: { mix } }).mix).toEqual({
      preset: 'minus-one',
    })
    expect(plan({ search: { mix: 'minus-one' }, saved: { mix }, channels: false }).mix).toEqual({
      saved: mix,
    })
  })

  it('forces the notation for ?view=tab only', () => {
    expect(plan({ search: { view: 'tab' } }).forceTab).toBe(true)
    expect(plan({ search: { view: 'chords' } }).forceTab).toBe(false)
    expect(plan({ saved: { view: 'chords_only' } }).forceTab).toBe(false)
  })

  it('loops the URL bars (1-based) over the saved clip, which needs the grid', () => {
    const saved = { selected_loop_id: clip.id }
    expect(plan({ search: { loop: '2-3' }, saved, clips: [clip] }).loop).toEqual({
      range: barRange(grid, 1, 2),
    })
    expect(plan({ saved, clips: [clip] }).loop).toEqual({ clip })
    expect(plan({ search: { loop: 'x' }, saved, clips: [clip] }).loop).toEqual({ clip })
    expect(plan({ search: { loop: '2-3' }, grid: undefined }).loop).toBeNull()
  })

  it('seeks to the saved position', () => {
    expect(plan({ saved: { position_s: 12.5 } }).seek).toBe(12.5)
  })
})
