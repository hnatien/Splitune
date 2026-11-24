import { Probe, Tags } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { CheckIcon, RotateCwIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { client, orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, stageFailureMessage } from '@/lib/reasons'
import { stageLabel, stageRows } from '@/lib/stages'
import { Button, buttonVariants } from '@/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu'
import { ListGroup, ListRow } from '@/ui/list-row'
import { type Stage, StageList } from '@/ui/stage-list'
import { Status } from '@/ui/status'
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

// Getting ready (27 §3.7.3, s47 direction §6): practice opens as soon as local playback works and
// fills in by stage. While the notation is empty the paper holds, from the top: anything that
// needs the learner (the part question after tagging, a failed upload or run, the queued line
// while the machine is offline), then "Getting your part ready" with what already works, the
// overall bar with an honest ETA (none while the song is queued) and the stages with the artefact
// each leaves; beside it, "What works now" as hairline rows with a status glyph and a word. No
// cards and no box: the status sits on the paper. On a phone's glance view the compact form keeps
// the decisions and one status line. The polite live region announces stage milestones only.
// Loads with the placeholder, outside the route's JS budget.

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

export function GettingReady({ compact = false }: { compact?: boolean }) {
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
  // While the machine is offline the song is queued: no time is promised until it is back.
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
          state?.status === 'running' && !waiting
            ? etaMinutes(timings.find((t) => t.stage === row.id)?.median_s)
            : undefined
        return {
          ...row,
          detail: detail(row.id, finished(state)),
          ...(minutes ? { statusText: `~${minutes}\u00a0min` } : {}),
        }
      })
    : []
  const minutes =
    analysis.data && !waiting ? etaMinutes(remaining(analysis.data, timings)) : undefined
  const separation = Object.entries(analysis.data?.stages ?? {}).find(
    ([stage]) => family(stage) === 'separate',
  )?.[1]
  const askPart =
    busy &&
    heard.length > 0 &&
    separation !== undefined &&
    !finished(separation) &&
    !confirmedPart(songId)

  const notices = (
    <>
      <p ref={announcement} aria-live="polite" className="sr-only" />
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
            <Button variant="outline" onClick={() => void retryUpload(songId)}>
              {m['common.retry']()}
            </Button>
          }
        />
      )}
      {waiting && <WorkerStatus online={false} text={m['analysis.queued_offline']()} />}
      {failed && <Failure retrying={retrying} onRetry={retry} />}
      {askPart && <PartQuestion heard={heard} onConfirm={() => confirmPart(songId)} />}
    </>
  )

  // A phone's glance view: what needs the learner, and one line for the rest.
  if (compact) {
    return (
      <div data-slot="getting-ready-compact" className="flex w-full flex-col gap-2">
        {notices}
        {analysis.data && busy && !waiting && (
          <Status
            kind="working"
            progress={overallProgress(analysis.data, timings) / 100}
            className="py-2"
          >
            {m['practice.analysing']()}
            {minutes && ` · ${m['analysis.eta_inline']({ minutes })}`}
          </Status>
        )}
      </div>
    )
  }

  return (
    <div className="relative flex w-full flex-col items-center gap-8 px-4 pt-6 pb-8 sm:px-7 lg:flex-row lg:items-start lg:justify-center">
      <div className="relative flex w-full max-w-140 flex-col gap-6">
        {notices}
        {!failed && analysis.data ? (
          <section
            aria-labelledby="getting-ready"
            data-slot="getting-ready"
            className="flex flex-col gap-4"
          >
            <div className="flex flex-col gap-1.5">
              <h2 id="getting-ready" className="text-heading">
                {m['practice.getting_ready']()}
              </h2>
              {audioStatus === 'ready' && (
                <p className="text-body text-muted-foreground">
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
            <Link
              to="/library"
              className={buttonVariants({ variant: 'quiet', className: 'self-start' })}
            >
              {m['practice.back_to_library']()}
            </Link>
          </section>
        ) : (
          !analysis.data &&
          !upload &&
          song.isSuccess && <InlineError tone="info" title={m['practice.not_uploaded']()} />
        )}
      </div>
      {analysis.data && !failed && <WhatWorksNow waiting={waiting} />}
    </div>
  )
}

// The part question (27 §3.7.3): after tagging and before separation, the part can still change.
// It is the one decision the analysis waits on, so it comes first, marked by the ink line on its
// leading edge; its answers are everyday buttons, so Play stays the screen's one filled control.
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
    <section
      aria-labelledby="part-question"
      data-slot="part-question"
      className="flex flex-col gap-3 border-l-2 border-ink py-1 pl-4"
    >
      <div className="flex flex-col gap-1">
        <h2 id="part-question" className="text-title">
          {m['analysis.wrong_instrument']({ instrument: part })}
        </h2>
        <p className="text-body-sm text-muted-foreground">
          {m['analysis.heard']({ instruments: list(heard.map(lower)) })}
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          variant="outline"
          onClick={() => {
            onConfirm()
            setAnswered(true)
          }}
        >
          <CheckIcon aria-hidden />
          {m['practice.yes_instrument']({ instrument: part })}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger render={<Button variant="quiet" />}>
            {m['practice.pick_another']()}
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" aria-label={m['practice.pick_part']()}>
            {INSTRUMENTS.filter((i) => i !== data.instrument).map((instrument) => (
              <DropdownMenuItem key={instrument} onClick={() => void pick(instrument)}>
                {instrumentLabel(instrument)}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {error && <InlineError title={error} />}
    </section>
  )
}

// Reasons that lie in the file itself: running the analysis again can't fix them, another file can.
const UNREADABLE = new Set(['unsupported_media', 'decode_failed', 'decode_timeout', 'audio_empty'])

// A failed run (27 §3.11): what happened and why in one unboxed message, the reason and that it
// used no analysis below the title, then what can fix it (Try again, or Choose another file when
// the file itself can't be read) and the way back. The song's own audio still plays, so Play stays
// the screen's filled control.
function Failure({ retrying, onRetry }: { retrying: boolean; onRetry: () => void }) {
  const { data } = usePractice()
  const failure = analysisFailures(data)[0]
  const said = failure ? stageFailureMessage(failure) : ''
  // The catch-all already names what failed in the title.
  const reason = said === m['analysis.failed']() ? '' : said
  const unused = m['library.didnt_use']()
  const description = reason.endsWith(unused) ? reason : [reason, unused].filter(Boolean).join(' ')
  const unreadable = UNREADABLE.has(failure?.errorCode ?? '')
  return (
    <InlineError
      title={m['analysis.failed_title']()}
      description={description}
      actions={
        <>
          {unreadable ? (
            <Link
              to="/library"
              search={{ add: 'file' }}
              className={buttonVariants({ variant: 'outline' })}
            >
              {m['import.choose_another']()}
            </Link>
          ) : (
            <Button variant="outline" loading={retrying} onClick={onRetry}>
              <RotateCwIcon aria-hidden />
              {m['common.try_again']()}
            </Button>
          )}
          <Link to="/library" className={buttonVariants({ variant: 'quiet' })}>
            {m['practice.back_to_library']()}
          </Link>
        </>
      }
    />
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

// What works now (27 §3.7.3): hairline rows, each with its state as a glyph and a word (Ready ·
// Soon · Later) and when, never a tinted pill. While the machine is offline nothing turns and no
// time is promised: what isn't ready yet is Waiting, with the queued glyph.
function WhatWorksNow({ waiting }: { waiting: boolean }) {
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
    <ListGroup
      aria-label={m['practice.what_works_now']()}
      title={m['practice.what_works_now']()}
      className="relative w-full max-w-140 lg:max-w-80"
    >
      {rows.map((row) => (
        <ListRow
          key={row.id}
          className="hover:bg-transparent"
          title={
            row.id === 'notation' && data.instrument !== 'guitar' && data.instrument !== 'bass'
              ? m['practice.view_notes']()
              : UNLOCK_NAME[row.id]()
          }
          meta={
            row.state === 'ready'
              ? row.id === 'loop'
                ? m['practice.unlock_loop_when']()
                : row.id === 'count-in'
                  ? m['practice.unlock_count_in_when']()
                  : m['practice.unlock_now']()
              : waiting
                ? m['practice.unlock_queued_when']()
                : row.minutes
                  ? m['practice.unlock_in']({ minutes: row.minutes })
                  : m['practice.unlock_waiting']()
          }
          aside={
            row.state === 'ready' ? (
              <Status kind="ready">{m['practice.unlock_ready']()}</Status>
            ) : waiting ? (
              <Status kind="queued">{m['practice.unlock_queued']()}</Status>
            ) : (
              <Status kind={row.state === 'soon' ? 'working' : 'queued'}>
                {row.state === 'soon' ? m['practice.unlock_soon']() : m['practice.unlock_later']()}
              </Status>
            )
          }
        />
      ))}
    </ListGroup>
  )
}
