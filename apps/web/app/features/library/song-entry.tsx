import type { LibrarySong } from '@splitune/contracts'
import type { StemKind } from '@splitune/ui-tokens'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useRouter } from '@tanstack/react-router'
import {
  AudioWaveformIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleXIcon,
  DrumIcon,
  EllipsisVerticalIcon,
  GuitarIcon,
  ListMusicIcon,
  LoaderIcon,
  LockIcon,
  type LucideIcon,
  MicIcon,
  PianoIcon,
  TimerOffIcon,
  TriangleAlertIcon,
  UploadIcon,
} from 'lucide-react'
import { useState } from 'react'
import type { z } from 'zod'
import { client, errorCode, errorData, orpc } from '@/lib/api'
import { barNumber, formatPercent, formatRelativeDate } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, stageFailureMessage } from '@/lib/reasons'
import { reloadMe } from '@/lib/reload-me'
import { meQuery } from '@/lib/session'
import { currentStage, etaText, remainingSeconds, stageLabel } from '@/lib/stages'
import { Button } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { BassIcon } from '@/ui/icons/bass'
import { Progress, ProgressLabel } from '@/ui/progress'
import { InstrumentTile, SongCard, SongRow, type SongSummary } from '@/ui/song-card'
import { toast } from '@/ui/toast'
import { UpgradeSheet } from '../billing/upgrade-sheet'
import { analysisAvailability } from '../import/analysis-choice'
import { uploadPercent, useUploads } from '../import/upload-store'
import { statsQuery } from './queries'
import { DeleteSongDialog, RenameSongDialog } from './song-dialogs'
import { type CardStatus, cardStatus, isInProgress } from './song-status'

type Song = z.infer<typeof LibrarySong>

// The stem colour and icon the mixer uses for the same part (26 §4.4).
const INSTRUMENT_TILE: Record<InstrumentName, { stem: StemKind; Icon: LucideIcon }> = {
  guitar: { stem: 'guitar', Icon: GuitarIcon },
  bass: { stem: 'bass', Icon: BassIcon },
  piano: { stem: 'keys', Icon: PianoIcon },
  drums: { stem: 'drums', Icon: DrumIcon },
  vocals: { stem: 'vocals', Icon: MicIcon },
  other: { stem: 'other', Icon: AudioWaveformIcon },
}

const spinning = 'animate-spin motion-reduce:animate-none'

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
        icon: <LoaderIcon aria-hidden className={spinning} />,
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
        icon: <LoaderIcon aria-hidden className={spinning} />,
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
  if (status.kind === 'failed') {
    if (!analysis) return null
    const failed = Object.entries(analysis.stages).find(([, s]) => s.status === 'failed')
    return (
      <p className="text-sm text-muted-foreground">
        {failed
          ? stageFailureMessage({ stage: failed[0], errorCode: failed[1].error_code })
          : m['analysis.failed']()}
      </p>
    )
  }
  const stage = analysis && currentStage(analysis)
  const eta = analysis && etaText(remainingSeconds(analysis, stats.data?.stages ?? []))
  const line = stage
    ? eta
      ? m['library.stage_eta']({ stage: stageLabel(stage), eta })
      : stageLabel(stage)
    : undefined
  // The bar comes from the list's stage counts, so it shows before the stage name has loaded.
  if (status.kind === 'analysing') {
    return (
      <Progress
        value={Math.round((status.done / Math.max(1, status.total)) * 100)}
        aria-label={line ? undefined : badge(status, undefined).label}
      >
        {line && (
          <ProgressLabel className="font-normal text-muted-foreground tabular-nums">
            {line}
          </ProgressLabel>
        )}
      </Progress>
    )
  }
  if (!line) return null
  return <p className="text-sm text-muted-foreground tabular-nums">{line}</p>
}

export function SongEntry({ song, layout }: { song: Song; layout: 'grid' | 'list' }) {
  const upload = useUploads((s) => s.items[song.id])
  const uploading = upload !== undefined && !['done', 'failed', 'needs_file'].includes(upload.phase)
  const status = cardStatus(song, uploading)
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
      // The allowance meter in the shell reads route context.
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
    ) : status.kind === 'uploading' && upload ? (
      <Progress
        value={uploadPercent(upload)}
        aria-label={badge(status, uploadPercent(upload)).label}
      />
    ) : undefined

  const tile = INSTRUMENT_TILE[song.instrument]
  const Entry = layout === 'grid' ? SongCard : SongRow
  return (
    <>
      <Entry
        song={summary(song, status, upload ? uploadPercent(upload) : undefined)}
        actions={actions}
        progress={followUp}
        leading={
          <InstrumentTile
            stem={tile.stem}
            icon={<tile.Icon />}
            size={layout === 'grid' ? 'md' : 'sm'}
          />
        }
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
      <UpgradeSheet
        open={upgrading}
        onClose={() => setUpgrading(false)}
        trigger="lite_song"
        returnPath="/library"
      />
    </>
  )
}
