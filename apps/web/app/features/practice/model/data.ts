import { type ArtefactIndexEntry, Beats, Chords, Notes, Stems, Summary } from '@splitune/contracts'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { z } from 'zod'
import { useAnalysisEvents } from '@/lib/analysis-events'
import { client, orpc } from '@/lib/api'
import { useUploads } from '../../import/upload-store'
import { effectiveOps, type Op, useCorrections } from './corrections'

// What the practice screen reads (13 §4 progressive results): the song, its latest analysis (kept
// current by SSE), and each artefact document as soon as its stage lands. Artefacts are immutable
// per version, so documents are cached for the page's lifetime.

type Entry = z.infer<typeof ArtefactIndexEntry>

export function latestOf(entries: readonly Entry[], kind: string): Entry | undefined {
  return entries
    .filter((e) => e.kind === kind)
    .reduce<Entry | undefined>(
      (best, e) => (!best || e.version > best.version ? e : best),
      undefined,
    )
}

export class ArtefactUnreadable extends Error {}

export function artefactDocQuery<S extends z.ZodType>(entry: Entry | undefined, schema: S) {
  return queryOptions({
    queryKey: ['artefact-doc', entry?.id ?? 'none'],
    enabled: entry !== undefined,
    staleTime: Number.POSITIVE_INFINITY,
    queryFn: async ({ signal }): Promise<z.infer<S>> => {
      if (!entry) throw new ArtefactUnreadable('no artefact')
      const { url } = await client.artefacts.url({ id: entry.id }, { signal })
      const res = await fetch(url, { signal })
      if (!res.ok) throw new ArtefactUnreadable(`HTTP ${res.status}`)
      const parsed = schema.safeParse(await res.json())
      if (!parsed.success) throw new ArtefactUnreadable(parsed.error.message)
      return parsed.data
    },
  })
}

/** Server ops (rev order) plus this device's pending ones for an artefact, and the server rev. */
export function useOps(entry: Entry | undefined): { ops: Op[]; rev: number; ready: boolean } {
  const server = useQuery({
    ...orpc.artefacts.listCorrections.queryOptions({ input: { id: entry?.id ?? '' } }),
    enabled: entry !== undefined,
  })
  const pending = useCorrections((state) => state.pending)
  const records = server.data?.ops ?? []
  return {
    ops: effectiveOps(records, pending, entry?.id),
    rev: records.at(-1)?.rev ?? 0,
    ready: entry === undefined || server.isSuccess || server.isError,
  }
}

export function usePracticeData(songId: string) {
  const song = useQuery(orpc.songs.get.queryOptions({ input: { id: songId } }))
  const upload = useUploads((state) => state.items[songId])
  const analysisId = song.data?.latest_analysis?.id ?? upload?.analysisId
  const analysis = useQuery({
    ...orpc.analyses.get.queryOptions({ input: { id: analysisId ?? '' } }),
    enabled: Boolean(analysisId),
  })
  const live = useAnalysisEvents(analysisId, songId)
  const entries = analysis.data?.artefacts ?? song.data?.artefacts ?? []
  const instrument = song.data?.instrument ?? 'guitar'
  const stemsEntry = latestOf(entries, 'stems')
  // Stems the sweeper removed after 180 days unused (15 §3): the song's own audio plays instead,
  // and the banner offers "Re-create stems".
  const stemsExpired = Boolean(stemsEntry?.purged_at)
  const entry = {
    beats: latestOf(entries, 'beats'),
    stems: stemsExpired ? undefined : stemsEntry,
    chords: latestOf(entries, 'chords'),
    notes: latestOf(entries, `notes.${instrument}`),
    tab: latestOf(entries, `tab.${instrument}`),
    summary: latestOf(entries, 'summary'),
  }
  const beats = useQuery(artefactDocQuery(entry.beats, Beats))
  const stems = useQuery(artefactDocQuery(entry.stems, Stems))
  const chords = useQuery(artefactDocQuery(entry.chords, Chords))
  // Notes are read once the tab exists: the tab layer appears with finalize (27 §3.7.3). Piano has
  // no tab: its falling notes appear with the summary.
  const notesReady = entry.tab ?? (instrument === 'piano' ? entry.summary : undefined)
  const notes = useQuery(artefactDocQuery(notesReady ? entry.notes : undefined, Notes))
  const summary = useQuery(artefactDocQuery(entry.summary, Summary))
  const ops = {
    beats: useOps(entry.beats),
    chords: useOps(entry.chords),
    notes: useOps(entry.notes),
  }
  return {
    song,
    upload,
    analysis,
    live,
    entry,
    beats,
    stems,
    chords,
    notes,
    summary,
    ops,
    instrument,
    stemsExpired,
  }
}

export type PracticeData = ReturnType<typeof usePracticeData>

/** Bytes of one stem's audio (AAC in MP4 decodes in every Tier 1 browser). */
export async function stemBytes(stemsArtefactId: string, stemId: string, signal?: AbortSignal) {
  const { url } = await client.artefacts.url(
    { id: stemsArtefactId, stem_id: stemId, variant: 'aac_mp4' },
    signal ? { signal } : {},
  )
  const res = await fetch(url, signal ? { signal } : {})
  if (!res.ok) throw new ArtefactUnreadable(`HTTP ${res.status}`)
  return res.arrayBuffer()
}

/** Bytes of the song's own audio (before stems exist, or a Lite analysis). */
export async function sourceBytes(songId: string, signal?: AbortSignal) {
  const { url } = await client.songs.mediaUrl(
    { id: songId, kind: 'source' },
    signal ? { signal } : {},
  )
  const res = await fetch(url, signal ? { signal } : {})
  if (!res.ok) throw new ArtefactUnreadable(`HTTP ${res.status}`)
  return res.arrayBuffer()
}

export type { Entry as ArtefactEntry }
