import { useQuery } from '@tanstack/react-query'
import { RotateCwIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useAnalysisEvents } from '@/lib/analysis-events'
import { client, errorCode, orpc } from '@/lib/api'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { apiErrorMessage, isFallback, type StageFailure, stageFailureMessage } from '@/lib/reasons'
import { etaText, progressPercent, remainingSeconds, stageLabel, stageRows } from '@/lib/stages'
import { Button } from '@/ui/button'
import { StageList } from '@/ui/stage-list'
import { Banner, InlineError } from '@/ui/status-message'
import { WorkerStatus } from '@/ui/worker-status'
import { ResumeFilePrompt } from '../import/resume-file'
import { retryUpload } from '../import/upload-manager'
import { useUploads } from '../import/upload-store'
import { statsQuery, workerStatusQuery } from '../library/queries'
import { FocusShell } from '../shell/focus-shell'
import { PracticeLoading } from './practice-loading'

// Provisional practice page (step 10): the song's analysis as it progresses, until step 12's
// progressive practice screen replaces it (27 §3.7.3, "Local audio only" → "+ tab"). Stage changes
// arrive over SSE; the StageList shows an ETA from recent median stage times.

export function ProgressPage({ songId }: { songId: string }) {
  const song = useQuery(orpc.songs.get.queryOptions({ input: { id: songId } }))
  const upload = useUploads((state) => state.items[songId])
  const analysisId = song.data?.latest_analysis?.id ?? upload?.analysisId
  const analysis = useQuery({
    ...orpc.analyses.get.queryOptions({ input: { id: analysisId ?? '' } }),
    enabled: Boolean(analysisId),
  })
  const live = useAnalysisEvents(analysisId, songId)
  const stats = useQuery(statsQuery)
  const running =
    analysis.data && (analysis.data.status === 'queued' || analysis.data.status === 'running')
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

  if (song.isPending) return <PracticeLoading />
  if (song.isError) {
    return (
      <FocusShell>
        <div className="mx-auto w-full max-w-page px-4 py-6">
          <InlineError title={apiErrorMessage(errorCode(song.error))} />
        </div>
      </FocusShell>
    )
  }

  const data = song.data
  const failures: StageFailure[] = [
    ...live.failures,
    ...Object.entries(analysis.data?.stages ?? {})
      .filter(
        ([stage, state]) =>
          state.status === 'failed' && !live.failures.some((f) => f.stage === stage),
      )
      .map(([stage, state]) => ({ stage, errorCode: state.error_code })),
  ]
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
    <FocusShell
      status={
        <>
          <span className="truncate text-base font-semibold" title={data.title}>
            {data.title}
          </span>
          <span className="hidden text-sm text-muted-foreground sm:inline">
            {instrumentLabel(data.instrument)}
          </span>
        </>
      }
    >
      <p ref={announcement} aria-live="polite" className="sr-only" />
      {failures.filter(isFallback).map((failure) => (
        <Banner key={failure.stage} tone="warning" title={stageFailureMessage(failure)} />
      ))}
      <div className="mx-auto flex w-full max-w-page flex-1 flex-col gap-6 px-4 py-6">
        {/* Upload progress is the status bar's pill; here only what needs the learner. */}
        {upload?.phase === 'needs_file' && (
          <ResumeFilePrompt songId={songId} title={upload.title} />
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
              <Button variant="outline" onClick={() => retryUpload(songId)}>
                {m['common.retry']()}
              </Button>
            }
          />
        )}
        {waiting && <WorkerStatus online={false} text={m['analysis.queued_offline']()} />}

        <section className="flex min-h-64 flex-col items-center justify-center gap-6 rounded-lg border border-border bg-paper p-6 text-ink">
          <p className="text-center text-read-label">
            {ended && !failed ? m['practice.preview_note']() : m['practice.placeholder']()}
          </p>
        </section>

        {analysis.data ? (
          <section aria-labelledby="stages" className="flex flex-col gap-4">
            <h2 id="stages" className="text-xl">
              {m['practice.stages_title']()}
            </h2>
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
          !upload && <InlineError tone="info" title={m['practice.not_uploaded']()} />
        )}
      </div>
    </FocusShell>
  )
}
