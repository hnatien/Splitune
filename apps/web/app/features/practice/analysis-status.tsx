import { useQuery } from '@tanstack/react-query'
import { RotateCwIcon } from 'lucide-react'
import { lazy, Suspense, useEffect, useRef, useState } from 'react'
import { client } from '@/lib/api'
import { m } from '@/lib/i18n'
import { apiErrorMessage, type StageFailure, stageFailureMessage } from '@/lib/reasons'
import { etaText, progressPercent, remainingSeconds, stageLabel, stageRows } from '@/lib/stages'
import { Button } from '@/ui/button'
import { StageList } from '@/ui/stage-list'
import { InlineError } from '@/ui/status-message'
import { WorkerStatus } from '@/ui/worker-status'
import { statsQuery, workerStatusQuery } from '../library/queries'
import type { PracticeData } from './model/data'
import { usePractice } from './practice-context'

// The uploader loads only when an upload needs the learner (12 §10 route budget).
const ResumeFilePrompt = lazy(() =>
  import('../import/resume-file').then((module) => ({ default: module.ResumeFilePrompt })),
)
const retryUpload = (songId: string) =>
  import('../import/upload-manager').then((uploads) => uploads.retryUpload(songId))

// The analysis while it runs (27 §3.7.3): shown on the notation's paper until the tab arrives,
// with the upload's needs, the worker's state and the stages with an honest ETA, in a raised card.
// Once the beats are found it says the original can already be looped and slowed. Stage changes
// arrive over SSE; one polite announcement per change.

export function analysisFailures(data: PracticeData): StageFailure[] {
  return [
    ...data.live.failures,
    ...Object.entries(data.analysis.data?.stages ?? {})
      .filter(
        ([stage, state]) =>
          state.status === 'failed' && !data.live.failures.some((f) => f.stage === stage),
      )
      .map(([stage, state]) => ({ stage, errorCode: state.error_code })),
  ]
}

export function AnalysisStatus({ data, songId }: { data: PracticeData; songId: string }) {
  const { song, upload, analysis, live } = data
  const { layers } = usePractice()
  const running =
    analysis.data && (analysis.data.status === 'queued' || analysis.data.status === 'running')
  // Stage times feed the ETA, which only a running analysis shows.
  const stats = useQuery({ ...statsQuery, enabled: Boolean(running) })
  const worker = useQuery({ ...workerStatusQuery, enabled: Boolean(running) })
  const [retrying, setRetrying] = useState(false)

  // The upload finished and its analysis started: the song now names it.
  useEffect(() => {
    if (upload?.analysisId && !song.data?.latest_analysis) void song.refetch()
  }, [upload?.analysisId, song.data?.latest_analysis, song.refetch])

  // One polite announcement per stage change (26 §13), not the whole list.
  const announcement = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    const event = live.lastEvent
    if (!event || !announcement.current) return
    if (
      event.type === 'stage.completed' ||
      event.type === 'stage.started' ||
      event.type === 'stage.failed'
    ) {
      const status =
        event.type === 'stage.started'
          ? m['stage.status.running']()
          : event.type === 'stage.completed'
            ? m['stage.status.done']()
            : m['stage.status.failed']()
      announcement.current.textContent = `${stageLabel(event.stage)}: ${status}`
    } else if (event.type === 'analysis.done') {
      announcement.current.textContent = m['practice.analysis_done']()
    }
  }, [live.lastEvent])

  const failures = analysisFailures(data)
  const ended = analysis.data && !running
  const failed = analysis.data?.status === 'failed'
  const eta = analysis.data
    ? etaText(remainingSeconds(analysis.data, stats.data?.stages ?? []))
    : undefined
  const waiting =
    Boolean(running) && (live.waitingFor !== undefined || worker.data?.online === false)

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

  return (
    <div className="flex w-full max-w-reading flex-col gap-6">
      <p ref={announcement} aria-live="polite" className="sr-only" />
      {/* Upload progress is the status bar's pill; here only what needs the learner. */}
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
      {analysis.data ? (
        <section
          aria-labelledby="stages"
          className="flex flex-col gap-4 rounded-2xl bg-surface-raised p-6 text-foreground shadow-1"
        >
          <h2 id="stages" className="text-2xl">
            {m['practice.stages_title']()}
          </h2>
          {layers.beats && !layers.tab && <p>{m['practice.can_loop_now']()}</p>}
          <StageList
            stages={stageRows(analysis.data, eta)}
            progress={progressPercent(analysis.data)}
            progressLabel={
              ended
                ? m['practice.analysis_done']()
                : eta
                  ? m['practice.analysing_eta']({ eta })
                  : m['practice.analysing']()
            }
          />
          {failed && (
            <InlineError
              title={m['analysis.failed']()}
              description={failures[0] ? stageFailureMessage(failures[0]) : undefined}
              actions={
                <Button variant="outline" loading={retrying} onClick={retry}>
                  <RotateCwIcon aria-hidden />
                  {m['common.try_again']()}
                </Button>
              }
            />
          )}
        </section>
      ) : (
        !upload &&
        song.isSuccess && <InlineError tone="info" title={m['practice.not_uploaded']()} />
      )}
    </div>
  )
}
