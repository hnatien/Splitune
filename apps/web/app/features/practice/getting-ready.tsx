import { Probe, Tags } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CircleAlertIcon, RotateCwIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { client, orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, stageFailureMessage } from '@/lib/reasons'
import { stageLabel, stageRows } from '@/lib/stages'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { Button, buttonVariants } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { type Stage, StageList } from '@/ui/stage-list'
import { InlineError } from '@/ui/status-message'
import { WorkerStatus } from '@/ui/worker-status'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { analysisFailures } from './analysis-status'
import { artefactDocQuery, latestOf } from './model/data'
import {
  currentStage,
  etaMinutes,
  family,
  finished,
  overallProgress,
  remaining,
  running,
  type Unlock,
  unlocks,
} from './model/getting-ready'
import { usePractice } from './practice-context'

// The uploader loads only when an upload needs the learner (12 §10 route budget).
const ResumeFilePrompt = lazy(() =>
  import('../import/resume-file').then((module) => ({ default: module.ResumeFilePrompt })),
)
const retryUpload = (songId: string) =>
  import('../import/upload-manager').then((uploads) => uploads.retryUpload(songId))

// Getting ready (27 §3.7.3, Practice-Ready.dc.html): practice opens as soon as local playback works
// and fills in by stage. While the notation is empty this card sits over a faint empty staff:
// "Getting your part ready", what already works, the overall bar with an honest ETA, the stages
// with the artefact each leaves, the part question after tagging ("We hear guitar, bass, drums and
// vocals." / "Is guitar the part you play?" · Yes, guitar · Pick another) and Back to the library;
// beside it "What works now". The polite live region announces stage milestones only; a failed
// run shows the failure card, an offline worker its notice once, never a stalled bar. Loads with
// the placeholder, outside the route's JS budget.

const CONFIRMED_KEY = 'splitune.part-confirmed'

function confirmedPart(songId: string): boolean {
  try {
    return (localStorage.getItem(CONFIRMED_KEY) ?? '').split(',').includes(songId)
  } catch {
    return false
  }
}

function confirmPart(songId: string) {
  try {
    const seen = (localStorage.getItem(CONFIRMED_KEY) ?? '').split(',').filter(Boolean)
    localStorage.setItem(CONFIRMED_KEY, [...seen, songId].slice(-50).join(','))
  } catch {
    // Asked again next time.
  }
}

const lower = (instrument: InstrumentName) => instrumentLabel(instrument).toLowerCase()
const list = (words: string[]) =>
  new Intl.ListFormat('en-GB', { type: 'conjunction' }).format(words)
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`

export function GettingReady() {
  const practice = usePractice()
  const { data, songId, layers, audioStatus, grid } = practice
  const { song, upload, analysis, live } = data
  const busy = running(analysis.data)
  // Stage timings are for signed-in learners (the route answers guests 401); guests get defaults.
  const stats = useQuery({ ...statsQuery, enabled: busy && !practice.guest })
  const worker = useQuery({ ...workerStatusQuery, enabled: busy })
  const entries = analysis.data?.artefacts ?? []
  const tags = useQuery(artefactDocQuery(latestOf(entries, 'tags'), Tags))
  const probe = useQuery(artefactDocQuery(latestOf(entries, 'probe'), Probe))
  const [retrying, setRetrying] = useState(false)

  // The upload finished and its analysis started: the song now names it.
  useEffect(() => {
    if (upload?.analysisId && !song.data?.latest_analysis) void song.refetch()
  }, [upload?.analysisId, song.data?.latest_analysis, song.refetch])

  // One polite announcement per stage milestone (26 §13), not the whole list.
  const announcement = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const event = live.lastEvent
    if (!event || !announcement.current) return
    if (event.type === 'stage.completed' || event.type === 'stage.failed') {
      const status =
        event.type === 'stage.completed' ? m['stage.status.done']() : m['stage.status.failed']()
      announcement.current.textContent = `${stageLabel(event.stage)}: ${status}`
    } else if (event.type === 'analysis.done') {
      announcement.current.textContent = m['practice.analysis_done']()
    }
  }, [live.lastEvent])

  const timings = stats.data?.stages ?? []
  const failed = analysis.data?.status === 'failed'
  const waiting = busy && (live.waitingFor !== undefined || worker.data?.online === false)

  const retry = async () => {
    if (!analysis.data) return
    setRetrying(true)
    try {
      await client.analyses.rerun({ id: analysis.data.id })
      await song.refetch()
    } finally {
      setRetrying(false)
    }
  }

  const heard = (tags.data?.instruments ?? [])
    .filter((tag) => tag.present_prob >= 0.5)
    .map((tag) => tag.instrument)
  const detail = (stage: string, done: boolean): string | undefined => {
    switch (family(stage)) {
      case 'url_import':
        return m['stage.detail.url_import']()
      case 'decode': {
        const stream = probe.data?.audio_stream
        const seconds = probe.data?.source_duration_s ?? song.data?.duration_s
        return done && typeof seconds === 'number' && stream?.channels
          ? m['stage.detail.decode_done']({
              duration: clock(seconds),
              channels: stream.channels > 1 ? m['stage.detail.stereo']() : m['stage.detail.mono'](),
            })
          : m['stage.detail.decode']()
      }
      case 'beats': {
        if (!done || !grid) return m['stage.detail.beats']()
        const meter = `${grid.beatsOf(grid.firstBar < 0 ? 0 : grid.firstBar).length || 4}/4`
        const bpm = String(Math.round(grid.bpm))
        return grid.firstBar < 0
          ? m['stage.detail.beats_pickup']({ bpm, meter })
          : m['stage.detail.beats_done']({ bpm, meter })
      }
      case 'tag':
        return done && heard.length > 0
          ? list(heard.map(instrumentLabel)).replace(/^./, (c) => c.toUpperCase())
          : m['stage.detail.tag']()
      case 'separate':
        return m['stage.detail.separate']({ instrument: lower(data.instrument) })
      case 'stem_post':
        return m['stage.detail.stem_post']()
      case 'chords':
        return m['stage.detail.chords']()
      case 'notes':
        return m['stage.detail.notes']()
      case 'finalize':
        return data.instrument === 'guitar' || data.instrument === 'bass'
          ? m['stage.detail.finalize']()
          : m['stage.detail.finalize_notes']()
      default:
        return undefined
    }
  }
  const stages: Stage[] = analysis.data
    ? stageRows(analysis.data, undefined).map((row) => {
        const state = analysis.data?.stages[row.id]
        const minutes =
          state?.status === 'running'
            ? etaMinutes(timings.find((t) => t.stage === row.id)?.median_s)
            : undefined
        return {
          ...row,
          detail: detail(row.id, finished(state)),
          ...(minutes ? { statusText: `~${minutes}${' '}min` } : {}),
        }
      })
    : []
  const minutes = analysis.data ? etaMinutes(remaining(analysis.data, timings)) : undefined
  const separation = Object.entries(analysis.data?.stages ?? {}).find(
    ([stage]) => family(stage) === 'separate',
  )?.[1]
  const askPart =
    busy &&
    heard.length > 0 &&
    separation !== undefined &&
    !finished(separation) &&
    !confirmedPart(songId)

  return (
    <div className="relative flex w-full items-start justify-center gap-7 px-7 pt-9 max-lg:flex-col max-lg:items-center">
      <EmptyStaff />
      <p ref={announcement} aria-live="polite" className="sr-only" />
      <div className="relative flex w-full max-w-140 flex-col gap-4">
        {upload?.phase === 'needs_file' && (
          <Suspense fallback={null}>
            <ResumeFilePrompt songId={songId} title={upload.title} />
          </Suspense>
        )}
        {upload?.phase === 'failed' && (
          <InlineError
            title={
              upload.errorCode === 'upload_failed'
                ? m['upload.failed']()
                : apiErrorMessage(
                    upload.errorCode as Parameters<typeof apiErrorMessage>[0],
                    upload.errorData,
                  )
            }
            actions={
              <Button variant="secondary" onClick={() => void retryUpload(songId)}>
                {m['common.retry']()}
              </Button>
            }
          />
        )}
        {waiting && <WorkerStatus online={false} text={m['analysis.queued_offline']()} />}
        {failed ? (
          <FailureCard retrying={retrying} onRetry={retry} />
        ) : analysis.data ? (
          <section
            aria-labelledby="getting-ready"
            data-slot="getting-ready"
            className="flex flex-col gap-4.5 rounded-4xl border border-border bg-card p-6 shadow-2"
          >
            <div className="flex flex-col gap-1.5">
              <h2 id="getting-ready" className="text-xl">
                {m['practice.getting_ready']()}
              </h2>
              {audioStatus === 'ready' && (
                <p className="text-muted-foreground">
                  {layers.beats
                    ? m['practice.practise_already_beats']()
                    : m['practice.practise_already']()}
                </p>
              )}
            </div>
            <StageList
              stages={stages}
              progress={overallProgress(analysis.data, timings)}
              progressLabel={m['practice.analysing']()}
              eta={minutes ? m['analysis.eta_inline']({ minutes }) : undefined}
              valueText={stageLabel(currentStage(analysis.data) ?? '')}
            />
            {askPart && <PartQuestion heard={heard} onConfirm={() => confirmPart(songId)} />}
            <div className="flex flex-wrap gap-2.5">
              <Link to="/library" className={buttonVariants({ variant: 'ghost' })}>
                {m['practice.back_to_library']()}
              </Link>
            </div>
          </section>
        ) : (
          !upload &&
          song.isSuccess && <InlineError tone="info" title={m['practice.not_uploaded']()} />
        )}
      </div>
      {analysis.data && !failed && <WhatWorksNow />}
    </div>
  )
}

// A faint empty staff behind the card while the notation is empty (Practice-Ready.dc.html).
function EmptyStaff() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-10 top-15 flex flex-col gap-17.5"
    >
      {[0, 1, 2].map((system) => (
        <div key={system} className="flex flex-col gap-4.75">
          {[0, 1, 2, 3, 4, 5].map((line) => (
            <span key={line} className="h-px bg-border" />
          ))}
        </div>
      ))}
    </div>
  )
}

// The part question (27 §3.7.3): after tagging and before separation, the part can still change.
function PartQuestion({ heard, onConfirm }: { heard: InstrumentName[]; onConfirm: () => void }) {
  const { data, songId } = usePractice()
  const queryClient = useQueryClient()
  const [answered, setAnswered] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (answered) return null
  const part = lower(data.instrument)
  // Pick another: the song keeps its loops; a new analysis for the chosen part reuses the decode
  // and the beat (the existing analyses route; it counts as an analysis like any other).
  const pick = async (instrument: InstrumentName) => {
    setError(null)
    try {
      await client.songs.update({ id: songId, instrument })
      await client.analyses.create({
        song_id: songId,
        instrument,
        type: data.analysis.data?.type === 'lite' ? 'lite' : 'full',
      })
      setAnswered(true)
      await queryClient.invalidateQueries({
        queryKey: orpc.songs.get.queryKey({ input: { id: songId } }),
      })
    } catch (failure) {
      const code = (failure as { code?: string }).code
      setError(apiErrorMessage(code as Parameters<typeof apiErrorMessage>[0]))
    }
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-3xl border border-border bg-muted px-3.5 py-3">
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="font-semibold">
            {m['analysis.heard']({ instruments: list(heard.map(lower)) })}
          </span>
          <span className="text-sm text-muted-foreground">
            {m['analysis.wrong_instrument']({ instrument: part })}
          </span>
        </span>
        <Button
          size="sm"
          variant="primary"
          onClick={() => {
            onConfirm()
            setAnswered(true)
          }}
        >
          {m['practice.yes_instrument']({ instrument: part })}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button size="sm" variant="secondary" />}>
            {m['practice.pick_another']()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" aria-label={m['practice.pick_part']()}>
            {INSTRUMENTS.filter((i) => i !== data.instrument).map((instrument) => (
              <DropdownMenuItem key={instrument} onClick={() => void pick(instrument)}>
                {instrumentLabel(instrument)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <InlineError title={error} />}
    </div>
  )
}

// The failure card (27 §3.11): what happened, that it didn't use an analysis, and Try again.
function FailureCard({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { data } = usePractice()
  const failures = analysisFailures(data)
  return (
    <section
      role="alert"
      className="flex flex-col gap-3 rounded-4xl border border-border bg-card p-6 shadow-2"
    >
      <CircleAlertIcon aria-hidden className="size-7 text-destructive" />
      <h2 className="text-lg">{m['analysis.failed']()}</h2>
      {failures[0] && <p className="text-muted-foreground">{stageFailureMessage(failures[0])}</p>}
      <div className="flex flex-wrap gap-2.5">
        <Button variant="primary" loading={retrying} onClick={onRetry}>
          <RotateCwIcon aria-hidden />
          {m['common.try_again']()}
        </Button>
        <Link to="/library" className={buttonVariants({ variant: 'ghost' })}>
          {m['practice.back_to_library']()}
        </Link>
      </div>
    </section>
  )
}

const UNLOCK_NAME: Record<Unlock['id'], () => string> = {
  loop: () => m['practice.unlock_loop'](),
  'count-in': () => m['practice.unlock_count_in'](),
  mixer: () => m['practice.unlock_mixer'](),
  chords: () => m['practice.unlock_chords'](),
  // Tab for guitar and bass; the other parts' notation reads as notes (27 §3.7.5).
  notation: () => m['practice.unlock_tab'](),
}

// What works now (27 §3.7.3): Ready (success) · Soon (primary) · Later (neutral), with when.
function WhatWorksNow() {
  const { data, layers, audioStatus, guest } = usePractice()
  const analysis = data.analysis.data
  const stats = useQuery({ ...statsQuery, enabled: running(analysis) && !guest })
  if (!analysis) return null
  const rows = unlocks({
    analysis,
    timings: stats.data?.stages ?? [],
    layers: {
      audio: audioStatus === 'ready',
      beats: layers.beats,
      stems: layers.stems,
      chords: layers.chords,
      notation: layers.tab || layers.roll || layers.melody || layers.drums,
    },
  })
  return (
    <section
      aria-labelledby="works-now"
      className="relative flex w-full max-w-75 flex-col gap-3 rounded-3xl border border-border bg-card p-4.5"
    >
      <h2
        id="works-now"
        className="text-xs font-semibold tracking-wider text-faint-foreground uppercase"
      >
        {m['practice.what_works_now']()}
      </h2>
      <ul className="flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.id} className="flex items-start gap-2.5">
            <Badge
              variant={
                row.state === 'ready' ? 'success' : row.state === 'soon' ? 'primary' : 'neutral'
              }
              className={cn('mt-px min-w-16 justify-center')}
            >
              {row.state === 'ready'
                ? m['practice.unlock_ready']()
                : row.state === 'soon'
                  ? m['practice.unlock_soon']()
                  : m['practice.unlock_later']()}
            </Badge>
            <span className="flex min-w-0 flex-col">
              <span className="text-md font-semibold">
                {row.id === 'notation' && data.instrument !== 'guitar' && data.instrument !== 'bass'
                  ? m['practice.view_notes']()
                  : UNLOCK_NAME[row.id]()}
              </span>
              <span className="text-sm text-faint-foreground">
                {row.state === 'ready'
                  ? row.id === 'loop'
                    ? m['practice.unlock_loop_when']()
                    : row.id === 'count-in'
                      ? m['practice.unlock_count_in_when']()
                      : m['practice.unlock_now']()
                  : row.minutes
                    ? m['practice.unlock_in']({ minutes: row.minutes })
                    : m['practice.unlock_waiting']()}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}
