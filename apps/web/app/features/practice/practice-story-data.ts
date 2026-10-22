import type { Analysis, SongDetail } from '@splitune/contracts'
import beats from '@splitune/contracts/fixtures/beats.json'
import chords from '@splitune/contracts/fixtures/chords.json'
import notes from '@splitune/contracts/fixtures/notes.guitar.json'
import stems from '@splitune/contracts/fixtures/stems.json'
import summary from '@splitune/contracts/fixtures/summary.json'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { analysis, detail, ME, STATS, WORKER_ONLINE } from '../story-fixtures'
import type { FetchAudio } from './practice-context'

// Story data for the practice screen (Screens/Practice, Screens/Onboarding): the contracts'
// 8-bar Am–F–C–G fixture as a song whose artefacts land kind by kind, and a generated tone for
// its audio. Nothing reaches the network.

export type Kind = 'beats' | 'stems' | 'chords' | 'notes.guitar' | 'tab.guitar' | 'summary'
export const DOCS: Partial<Record<Kind, unknown>> = {
  beats,
  stems,
  chords,
  'notes.guitar': notes,
  summary,
}
export const ALL: Kind[] = ['beats', 'stems', 'chords', 'notes.guitar', 'tab.guitar', 'summary']
export const artefactId = (kind: Kind) =>
  `00000000-0000-4000-9000-${String(ALL.indexOf(kind) + 1).padStart(12, '0')}`

export type Patch = {
  summary?: unknown
  chords?: unknown
  running?: boolean
  /** The sweeper removed the stems' audio (15 §3). */
  stemsPurged?: boolean
  /** A stage that failed and fell back (27 §3.7.3 "Failed stage"). */
  failedStage?: string
}

export function seed(kinds: Kind[], patch: Patch = {}) {
  return (client: QueryClient) => {
    const done = analysis(1, patch.running ? 'running' : 'done')
    const run = patch.failedStage
      ? { ...done, stages: { ...done.stages, [patch.failedStage]: { status: 'failed' as const } } }
      : done
    const entries = kinds.map((kind) => ({
      id: artefactId(kind),
      kind,
      version: 1,
      bytes: 100,
      sha256: '0'.repeat(64),
      created_at: '2026-10-22T10:00:00Z',
      purged_at: kind === 'stems' && patch.stemsPurged ? '2026-10-01T03:30:00Z' : null,
    }))
    const withArtefacts: z.infer<typeof Analysis> = { ...run, artefacts: entries }
    const song: z.infer<typeof SongDetail> = {
      ...detail(1, withArtefacts),
      duration_s: 20.5,
      artefacts: entries,
    }
    client.setQueryData(orpc.songs.get.queryKey({ input: { id: song.id } }), song)
    client.setQueryData(orpc.analyses.get.queryKey({ input: { id: run.id } }), withArtefacts)
    client.setQueryData(orpc.loops.list.queryKey({ input: { id: song.id } }), { items: [] })
    client.setQueryData(statsQuery.queryKey, STATS)
    client.setQueryData(workerStatusQuery.queryKey, WORKER_ONLINE)
    client.setQueryData(meQuery.queryKey, ME)
    for (const kind of kinds) {
      client.setQueryData(
        orpc.artefacts.listCorrections.queryKey({ input: { id: artefactId(kind) } }),
        { ops: [] },
      )
      const doc =
        kind === 'summary' && patch.summary
          ? patch.summary
          : kind === 'chords' && patch.chords
            ? patch.chords
            : DOCS[kind]
      if (doc) client.setQueryData(['artefact-doc', artefactId(kind)], doc)
    }
  }
}

// 20.5 s of a quiet plucked 220 Hz tone as a WAV, for every stem and the song's own audio.
export function toneWav(): ArrayBuffer {
  const rate = 22_050
  const frames = Math.round(20.5 * rate)
  const buffer = new ArrayBuffer(44 + frames * 2)
  const view = new DataView(buffer)
  const text = (at: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(at + i, value.charCodeAt(i))
  }
  text(0, 'RIFF')
  view.setUint32(4, 36 + frames * 2, true)
  text(8, 'WAVEfmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, rate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  text(36, 'data')
  view.setUint32(40, frames * 2, true)
  for (let i = 0; i < frames; i++) {
    const t = i / rate
    const sample = 0.3 * Math.exp(-3 * ((t + 0.1) % 0.6)) * Math.sin(2 * Math.PI * 220 * t)
    view.setInt16(44 + i * 2, Math.round(sample * 32767), true)
  }
  return buffer
}

export const tone: FetchAudio = async () => toneWav()

export const SONG_ID = detail(1, null).id
