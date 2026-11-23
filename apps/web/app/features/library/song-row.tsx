import type { LibrarySong } from '@splitune/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import { EllipsisIcon, LockIcon } from 'lucide-react'
import { useState } from 'react'
import type { z } from 'zod'
import { client, errorCode, errorData, orpc } from '@/lib/api'
import { barNumber, formatDuration, formatPercent, formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, stageFailureMessage } from '@/lib/reasons'
import { reloadMe } from '@/lib/reload-me'
import { meQuery } from '@/lib/session'
import { currentStage, remainingSeconds, stageLabel } from '@/lib/stages'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { ListRow } from '@/ui/list-row'
import { Status, type StatusKind } from '@/ui/status'
import { toast } from '@/ui/toast'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { analysisAvailability } from '../import/analysis-choice'
import { isUploading, uploadPercent, useUploads } from '../import/upload-store'
import { INSTRUMENT_ICON } from './instrument-icon'
import { statsQuery } from './queries'
import { DeleteSongDialog, RenameSongDialog } from './song-dialogs'
import { type CardStatus, cardStatus, isInProgress } from './song-status'

type Song = z.infer<typeof LibrarySong>

/** The status glyph and its words (26 §12.2): the glyph's shape carries the state, never a hue. */
function statusOf(
  status: CardStatus,
  uploadPct: number | undefined,
): { kind: StatusKind; words: string; progress?: number } {
  switch (status.kind) {
    case 'uploading':
      return {
        kind: 'working',
        words: m['upload.uploading']({ pct: formatPercent(uploadPct ?? 0) }),
        progress: (uploadPct ?? 0) / 100,
      }
    case 'upload_unfinished':
      return { kind: 'paused', words: m['library.status.upload_unfinished']() }
    case 'downloading':
      return { kind: 'working', words: m['library.status.downloading']() }
    case 'queued':
      return { kind: 'queued', words: m['library.status.queued']() }
    case 'analysing':
      return {
        kind: 'working',
        words: m['library.status.analysing']({
          done: String(status.done),
          total: String(status.total),
        }),
        progress: status.done / Math.max(1, status.total),
      }
    case 'failed':
      return { kind: 'failed', words: m['library.status.failed']() }
    case 'stems_expired':
      return { kind: 'expired', words: m['library.status.stems_expired']() }
    case 'chords_only':
      return { kind: 'partial', words: m['library.status.chords_only']() }
    case 'partial':
      return { kind: 'attention', words: m['library.status.partial']() }
    default:
      return { kind: 'ready', words: m['library.status.ready']() }
  }
}

/** When it was practised and its best clean tempo, for a playable song. */
function practisedLine(song: Song): string | undefined {
  const when = song.last_opened_at
    ? m['library.last_practised']({ when: formatRelativeDate(new Date(song.last_opened_at)) })
    : undefined
  const best = song.best_clean && {
    pct: formatPercent(song.best_clean.tempo_pct),
    start: String(barNumber(song.best_clean.start_bar)),
    end: String(barNumber(song.best_clean.end_bar)),
  }
  if (when && best) return `${when} · ${m['library.best_on_bars_inline'](best)}`
  return when ?? (best ? m['library.best_on_bars'](best) : undefined)
}

/**
 * The line under the status: what is happening now ("Isolating your part · about 3 min left"),
 * why it failed and that it cost nothing, or what the learner can do next.
 */
function useDetail(song: Song, status: CardStatus, workerOffline: boolean): string | undefined {
  const analysisId = song.latest_analysis?.id
  const live = isInProgress(status)
  const detail = useQuery({
    ...orpc.analyses.get.queryOptions({ input: { id: analysisId ?? '' } }),
    enabled: Boolean(analysisId) && (live || status.kind === 'failed'),
    refetchInterval: live ? 5_000 : false,
  })
  const stats = useQuery({ ...statsQuery, enabled: live })
  const analysis = detail.data
  switch (status.kind) {
    case 'failed': {
      const failed = analysis
        ? Object.entries(analysis.stages).find(([, s]) => s.status === 'failed')
        : undefined
      const reason = failed
        ? stageFailureMessage({ stage: failed[0], errorCode: failed[1].error_code })
        : analysis && m['analysis.failed']()
      return [reason, m['library.didnt_use']()].filter(Boolean).join(' ')
    }
    case 'queued':
      return workerOffline ? m['library.queued_offline']() : m['library.can_loop']()
    case 'analysing':
    case 'downloading': {
      const stage = analysis && currentStage(analysis)
      if (!stage) return m['library.can_loop']()
      const left = remainingSeconds(analysis, stats.data?.stages ?? [])
      return left === undefined
        ? stageLabel(stage)
        : m['library.stage_eta']({
            stage: stageLabel(stage),
            eta: m['analysis.eta_inline']({ minutes: String(Math.max(1, Math.ceil(left / 60))) }),
          })
    }
    case 'uploading':
      return m['library.can_loop']()
    case 'stems_expired':
      return m['practice.stems_expired']()
    case 'chords_only':
      return m['library.add_stems']()
    case 'ready':
    case 'partial':
      return practisedLine(song)
    default:
      return undefined
  }
}

// One song in the library (s47 direction §6, 26 §12.2 ListRow): its instrument's drawing (from
// 1024 px), the title linking to Practice across the whole row, one meta line, the status as a
// glyph and words with the line that explains it, at most one action (Try again, Re-create stems)
// and the ⋯ menu (Rename, Analyse again or with stems + tab, Delete). The explaining line wraps
// in its column rather than being cut off. Below 640 px the status and its line sit under the
// title, so the title keeps the width and only the action and ⋯ stay beside it.
export function SongRow({
  song,
  layout,
  workerOffline = false,
  unavailable = false,
}: {
  song: Song
  /** `compact` below 640 px, `wide` with room for the status column, `full` with the instrument's
   * drawing. */
  layout: 'compact' | 'wide' | 'full'
  /** The processing machine is offline: queued rows say they start on their own. */
  workerOffline?: boolean
  /** Offline and needing the server (27 §4): "Needs connection". */
  unavailable?: boolean
}) {
  const upload = useUploads((s) => s.items[song.id])
  const status = cardStatus(song, isUploading(upload))
  const detail = useDetail(song, status, workerOffline)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [upgrading, setUpgrading] = useState(false)
  const queryClient = useQueryClient()
  const me = useQuery(meQuery).data
  const router = useRouter()
  const refresh = () => queryClient.invalidateQueries({ queryKey: orpc.songs.list.key() })

  const analyse = useMutation({
    mutationFn: async (kind: 'rerun' | 'full') => {
      const latest = song.latest_analysis
      if (kind === 'full' || !latest) {
        return client.analyses.create({
          song_id: song.id,
          instrument: song.instrument,
          type: 'full',
        })
      }
      return client.analyses.rerun({ id: latest.id })
    },
    onSuccess: () => {
      toast.add({ title: m['library.analysis_started'](), type: 'success' })
      void refresh()
      // The practice page reads the new run from the song's latest_analysis, not the list.
      void queryClient.invalidateQueries({
        queryKey: orpc.songs.get.queryKey({ input: { id: song.id } }),
      })
      // The allowances in the shell read route context.
      void reloadMe(queryClient).then(() => router.invalidate())
    },
    onError: (error) =>
      toast.add({ title: apiErrorMessage(errorCode(error), errorData(error)), type: 'error' }),
  })

  const canAnalyse = song.latest_analysis !== null && !isInProgress(status)
  const lite = song.latest_analysis?.type === 'lite'
  // Stems + tab for a Lite song is a point of action: locked when no full analysis is left, and on
  // Free it leads to Plus (23 §5).
  const fullLocked = lite && me != null && !analysisAvailability(me).full
  const upgradeFull = () => {
    if (fullLocked && me?.plan === 'free') setUpgrading(true)
    else analyse.mutate('full')
  }

  const shown = unavailable
    ? { kind: 'offline' as const, words: m['library.needs_connection']() }
    : statusOf(status, upload ? uploadPercent(upload) : undefined)
  const state = (
    <Status kind={shown.kind} {...('progress' in shown ? { progress: shown.progress } : {})}>
      {shown.words}
    </Status>
  )
  const action =
    status.kind === 'failed' && song.latest_analysis ? (
      <Button
        size="sm"
        loading={analyse.isPending}
        aria-label={`${m['library.try_again']()}: ${song.title}`}
        onClick={() => analyse.mutate('rerun')}
      >
        {m['library.try_again']()}
      </Button>
    ) : status.kind === 'stems_expired' ? (
      <Button
        size="sm"
        loading={analyse.isPending}
        aria-label={`${m['library.recreate_stems']()}: ${song.title}`}
        onClick={() => analyse.mutate('rerun')}
      >
        {m['library.recreate_stems']()}
      </Button>
    ) : undefined

  const menu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="quiet"
            size="icon"
            aria-label={m['library.song_menu']({ title: song.title })}
          />
        }
      >
        <EllipsisIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          {m['library.rename']()}
        </DropdownMenuItem>
        {canAnalyse && (
          <DropdownMenuItem onClick={() => (lite ? upgradeFull() : analyse.mutate('rerun'))}>
            {fullLocked && <LockIcon aria-hidden />}
            {lite ? m['library.upgrade_full']() : m['library.analyse_again']()}
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" onClick={() => setDeleting(true)}>
          {m['library.delete']()}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const meta = [
    song.artist,
    instrumentLabel(song.instrument),
    song.duration_s === null ? undefined : formatDuration(song.duration_s),
  ]
    .filter(Boolean)
    .join(' · ')
  const compact = layout === 'compact'
  const Instrument = INSTRUMENT_ICON[song.instrument]

  return (
    <>
      <ListRow
        data-unavailable={unavailable || undefined}
        render={
          <Link to="/songs/$songId/practice" params={{ songId: song.id }} title={song.title} />
        }
        media={layout === 'full' ? <Instrument aria-hidden className="size-5" /> : undefined}
        title={song.title}
        meta={
          compact ? (
            <>
              <span className="block truncate">{meta}</span>
              <span className="mt-1 flex">{state}</span>
              {detail && (
                <span data-slot="song-status-line" className="block whitespace-normal text-pretty">
                  {detail}
                </span>
              )}
            </>
          ) : (
            meta
          )
        }
        aside={
          <>
            {!compact && (
              <span className="flex w-48 flex-col items-start gap-0.5 lg:w-64 xl:w-80">
                {state}
                {detail && (
                  <span
                    data-slot="song-status-line"
                    className="max-w-full text-pretty text-caption text-muted-foreground"
                  >
                    {detail}
                  </span>
                )}
              </span>
            )}
            {action}
            {menu}
          </>
        }
      />
      <RenameSongDialog
        song={song}
        open={renaming}
        onOpenChange={setRenaming}
        onRenamed={refresh}
      />
      <DeleteSongDialog
        song={song}
        open={deleting}
        onOpenChange={setDeleting}
        onDeleted={refresh}
      />
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="lite_song"
        returnPath="/library"
      />
    </>
  )
}
