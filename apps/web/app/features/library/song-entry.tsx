import type { LibrarySong } from '@splitune/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import {
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  EllipsisVerticalIcon,
  ListMusicIcon,
  LoaderIcon,
  TimerOffIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { z } from 'zod'
import { client, errorCode, orpc } from '@/lib/api'
import { barNumber, formatPercent, formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, stageFailureMessage } from '@/lib/reasons'
import { currentStage, etaText, remainingSeconds, stageLabel } from '@/lib/stages'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { SongCard, SongRow, type SongSummary } from '@/ui/song-card'
import { toast } from '@/ui/toast'
import { uploadPercent, useUploads } from '../import/upload-store'
import { statsQuery } from './queries'
import { DeleteSongDialog, RenameSongDialog } from './song-dialogs'
import { type CardStatus, cardStatus, isInProgress } from './song-status'

type Song = z.infer<typeof LibrarySong>

function badge(status: CardStatus, uploadPct: number | undefined): SongSummary['status'] {
  switch (status.kind) {
    case 'uploading':
      return {
        label: m['upload.uploading']({ pct: formatPercent(uploadPct ?? 0) }),
        variant: 'info',
        icon: <UploadIcon aria-hidden />,
      }
    case 'upload_unfinished':
      return {
        label: m['library.status.upload_unfinished'](),
        variant: 'warning',
        icon: <TriangleAlertIcon aria-hidden />,
      }
    case 'downloading':
      return {
        label: m['library.status.downloading'](),
        variant: 'info',
        icon: <LoaderIcon aria-hidden />,
      }
    case 'queued':
      return {
        label: m['library.status.queued'](),
        variant: 'neutral',
        icon: <CircleDashedIcon aria-hidden />,
      }
    case 'analysing':
      return {
        label: m['library.status.analysing']({
          done: String(status.done),
          total: String(status.total),
        }),
        variant: 'info',
        icon: <LoaderIcon aria-hidden />,
      }
    case 'failed':
      return {
        label: m['library.status.failed'](),
        variant: 'destructive',
        icon: <CircleXIcon aria-hidden />,
      }
    case 'stems_expired':
      return {
        label: m['library.status.stems_expired'](),
        variant: 'warning',
        icon: <TimerOffIcon aria-hidden />,
      }
    case 'chords_only':
      return {
        label: m['library.status.chords_only'](),
        variant: 'neutral',
        icon: <ListMusicIcon aria-hidden />,
      }
    case 'partial':
      return {
        label: m['library.status.partial'](),
        variant: 'warning',
        icon: <TriangleAlertIcon aria-hidden />,
      }
    default:
      return {
        label: m['library.status.ready'](),
        variant: 'success',
        icon: <CircleCheckIcon aria-hidden />,
      }
  }
}

function summary(song: Song, status: CardStatus, uploadPct: number | undefined): SongSummary {
  return {
    title: song.title,
    artist: song.artist ?? undefined,
    instrument: instrumentLabel(song.instrument),
    status: badge(status, uploadPct),
    lastPractised: song.last_opened_at
      ? m['library.last_practised']({ when: formatRelativeDate(new Date(song.last_opened_at)) })
      : undefined,
    bestTempo: song.best_clean
      ? m['library.best_on_bars']({
          pct: formatPercent(song.best_clean.tempo_pct),
          start: String(barNumber(song.best_clean.start_bar)),
          end: String(barNumber(song.best_clean.end_bar)),
        })
      : undefined,
    href: `/songs/${song.id}/practice`,
  }
}

/** Compact progress or failure line under an analysing or failed card (27 §3.5). */
function AnalysisLine({ song, status }: { song: Song; status: CardStatus }) {
  const analysisId = song.latest_analysis?.id
  const live = isInProgress(status)
  const detail = useQuery({
    ...orpc.analyses.get.queryOptions({ input: { id: analysisId ?? '' } }),
    enabled: Boolean(analysisId) && (live || status.kind === 'failed'),
    refetchInterval: live ? 5_000 : false,
  })
  const stats = useQuery({ ...statsQuery, enabled: live })
  const analysis = detail.data
  if (!analysis) return null
  if (status.kind === 'failed') {
    const failed = Object.entries(analysis.stages).find(([, s]) => s.status === 'failed')
    return (
      <p className="text-sm text-muted-foreground">
        {failed
          ? stageFailureMessage({ stage: failed[0], errorCode: failed[1].error_code })
          : m['analysis.failed']()}
      </p>
    )
  }
  const stage = currentStage(analysis)
  if (!stage) return null
  const eta = etaText(remainingSeconds(analysis, stats.data?.stages ?? []))
  return (
    <p className="text-sm text-muted-foreground tabular-nums">
      {eta ? m['library.stage_eta']({ stage: stageLabel(stage), eta }) : stageLabel(stage)}
    </p>
  )
}

export function SongEntry({ song, layout }: { song: Song; layout: 'grid' | 'list' }) {
  const upload = useUploads((s) => s.items[song.id])
  const uploading = upload !== undefined && !['done', 'failed', 'needs_file'].includes(upload.phase)
  const status = cardStatus(song, uploading)
  const [renaming, setRenaming] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const queryClient = useQueryClient()
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
    },
    onError: (error) => toast.add({ title: apiErrorMessage(errorCode(error)), type: 'error' }),
  })

  const canAnalyse = song.latest_analysis !== null && !isInProgress(status)
  const lite = song.latest_analysis?.type === 'lite'
  const actions = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label={m['library.song_menu']({ title: song.title })}
          />
        }
      >
        <EllipsisVerticalIcon aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={() => setRenaming(true)}>
          {m['library.rename']()}
        </DropdownMenuItem>
        {canAnalyse && (
          <DropdownMenuItem onClick={() => analyse.mutate(lite ? 'full' : 'rerun')}>
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

  const followUp =
    status.kind === 'failed' ? (
      <div className="relative flex flex-col items-start gap-2">
        <AnalysisLine song={song} status={status} />
        <p className="text-sm text-muted-foreground">{m['library.didnt_use']()}</p>
        {song.latest_analysis && (
          <Button
            size="md"
            variant="outline"
            loading={analyse.isPending}
            onClick={() => analyse.mutate('rerun')}
          >
            {m['library.try_again']()}
          </Button>
        )}
      </div>
    ) : status.kind === 'stems_expired' ? (
      <div className="relative flex flex-col items-start gap-2">
        <p className="text-sm text-muted-foreground">{m['practice.stems_expired']()}</p>
        <Button
          variant="outline"
          loading={analyse.isPending}
          onClick={() => analyse.mutate('rerun')}
        >
          {m['library.recreate_stems']()}
        </Button>
      </div>
    ) : isInProgress(status) ? (
      <AnalysisLine song={song} status={status} />
    ) : undefined

  const Entry = layout === 'grid' ? SongCard : SongRow
  return (
    <>
      <Entry
        song={summary(song, status, upload ? uploadPercent(upload) : undefined)}
        actions={actions}
        progress={followUp}
        renderLink={({ children, className, title }) => (
          <Link
            to="/songs/$songId/practice"
            params={{ songId: song.id }}
            className={className}
            title={title}
          >
            {children}
          </Link>
        )}
        className={layout === 'grid' ? 'h-full' : undefined}
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
    </>
  )
}
