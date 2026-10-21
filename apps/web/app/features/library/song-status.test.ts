import type { LibrarySong } from '@splitune/contracts'
import { describe, expect, it } from 'vitest'
import type { z } from 'zod'
import { cardStatus } from './song-status'

type Song = z.infer<typeof LibrarySong>

const base: Song = {
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Riff',
  artist: null,
  instrument: 'guitar',
  source_kind: 'upload',
  source_url: null,
  duration_s: 120,
  status: 'ready',
  player_state: {},
  last_opened_at: null,
  created_at: '2026-10-21T10:00:00Z',
  latest_analysis: {
    id: '00000000-0000-4000-8000-000000000002',
    type: 'full',
    status: 'done',
    stages_done: 7,
    stages_total: 7,
    recommended_view: 'tab',
  },
  stems: 'available',
  best_clean: null,
}

const analysis = (patch: Partial<NonNullable<Song['latest_analysis']>>) => ({
  ...base,
  latest_analysis: { ...(base.latest_analysis as NonNullable<Song['latest_analysis']>), ...patch },
})

describe('cardStatus', () => {
  it('maps every library state', () => {
    expect(cardStatus(base, false)).toEqual({ kind: 'ready' })
    expect(cardStatus({ ...base, latest_analysis: null, status: 'importing' }, true)).toEqual({
      kind: 'uploading',
    })
    expect(cardStatus({ ...base, latest_analysis: null, status: 'importing' }, false)).toEqual({
      kind: 'upload_unfinished',
    })
    expect(cardStatus(analysis({ status: 'queued', stages_done: 0 }), false)).toEqual({
      kind: 'queued',
    })
    expect(
      cardStatus({ ...analysis({ status: 'queued', stages_done: 0 }), status: 'importing' }, false),
    ).toEqual({ kind: 'downloading' })
    expect(
      cardStatus(analysis({ status: 'running', stages_done: 2, stages_total: 5 }), false),
    ).toEqual({
      kind: 'analysing',
      done: 2,
      total: 5,
    })
    expect(cardStatus(analysis({ status: 'failed' }), false)).toEqual({ kind: 'failed' })
    expect(cardStatus({ ...base, stems: 'expired' }, false)).toEqual({ kind: 'stems_expired' })
    expect(cardStatus(analysis({ recommended_view: 'chords_only' }), false)).toEqual({
      kind: 'chords_only',
    })
    expect(cardStatus(analysis({ status: 'partial' }), false)).toEqual({ kind: 'partial' })
  })
})
