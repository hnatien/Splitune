import type { LibrarySong } from '@splitune/contracts'
import type { z } from 'zod'

// The one status a library row shows (27 §3.5): Ready · Partial · Analysing n/m · Queued ·
// Chords only · Stems expired · Failed, plus the two states before any analysis exists. Rows are
// grouped by what the song needs (s47 direction §6): getting ready, needs you, ready to practise.

type Song = z.infer<typeof LibrarySong>

export type CardStatus =
  | { kind: 'uploading' }
  | { kind: 'upload_unfinished' }
  | { kind: 'downloading' }
  | { kind: 'queued' }
  | { kind: 'analysing'; done: number; total: number }
  | { kind: 'failed' }
  | { kind: 'stems_expired' }
  | { kind: 'chords_only' }
  | { kind: 'partial' }
  | { kind: 'ready' }

export function cardStatus(song: Song, uploading: boolean): CardStatus {
  const analysis = song.latest_analysis
  if (!analysis) {
    if (uploading) return { kind: 'uploading' }
    return song.status === 'failed' ? { kind: 'failed' } : { kind: 'upload_unfinished' }
  }
  if (song.status === 'failed' || analysis.status === 'failed' || analysis.status === 'cancelled') {
    return { kind: 'failed' }
  }
  if (analysis.status === 'queued' || analysis.status === 'running') {
    if (song.status === 'importing' && analysis.stages_done === 0) return { kind: 'downloading' }
    if (analysis.stages_done === 0 && analysis.status === 'queued') return { kind: 'queued' }
    return { kind: 'analysing', done: analysis.stages_done, total: analysis.stages_total }
  }
  if (song.stems === 'expired') return { kind: 'stems_expired' }
  if (analysis.recommended_view === 'chords_only') return { kind: 'chords_only' }
  return analysis.status === 'partial' ? { kind: 'partial' } : { kind: 'ready' }
}

export const isInProgress = (status: CardStatus) =>
  status.kind === 'queued' || status.kind === 'analysing' || status.kind === 'downloading'

export type SongNeed = 'getting_ready' | 'needs_you' | 'ready'

/** Which library group a song sits in: still on its way, waiting for the learner, or playable. */
export function songNeed(status: CardStatus): SongNeed {
  switch (status.kind) {
    case 'uploading':
    case 'downloading':
    case 'queued':
    case 'analysing':
      return 'getting_ready'
    case 'failed':
    case 'stems_expired':
    case 'upload_unfinished':
      return 'needs_you'
    default:
      return 'ready'
  }
}
