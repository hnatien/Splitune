import { ServerAnalyticsEvent } from '@splitune/contracts'
import { eq } from 'drizzle-orm'
import type { z } from 'zod'
import type { Executor } from '../client.ts'
import { analyses, analyticsEvents, stageRuns } from '../schema/index.ts'

type ServerEvent = z.infer<typeof ServerAnalyticsEvent>

const ms = (from: Date | null, to: Date | null) =>
  from && to ? Math.min(Math.max(0, to.getTime() - from.getTime()), 86_400_000) : null

// The pipeline events of 16 §2 for one finished analysis, as the node worker (role node_worker)
// records them after finalize: one analysis_stage_completed per stage run and one analysis_done.
// Rows carry the user's salted hash, never the id.
export async function recordAnalysisTelemetry(
  db: Executor,
  analysisId: string,
  hashUser: (userId: string) => string,
): Promise<number> {
  const [analysis] = await db.select().from(analyses).where(eq(analyses.id, analysisId))
  if (!analysis?.finishedAt) return 0
  const runs = await db.select().from(stageRuns).where(eq(stageRuns.analysisId, analysisId))
  const events: ServerEvent[] = runs
    .filter((run) => run.status !== 'pending' && run.status !== 'running')
    .map((run) => {
      const model = run.modelRefs[0]
      return {
        name: 'analysis_stage_completed',
        props: {
          stage: run.stage,
          status: run.status as 'done' | 'fallback' | 'failed' | 'skipped',
          duration_ms: ms(run.startedAt, run.finishedAt),
          model_ref: model ? `${model.model_id}@${model.version}` : null,
        },
      }
    })
  events.push({
    name: 'analysis_done',
    props: {
      status: analysis.status,
      type: analysis.analysisType,
      instrument: analysis.requestedInstrument,
      total_ms: ms(analysis.createdAt, analysis.finishedAt) ?? 0,
      compute_ms: Math.min(
        86_400_000,
        runs.reduce((sum, run) => sum + (ms(run.startedAt, run.finishedAt) ?? 0), 0),
      ),
      recommended_view: analysis.recommendedView,
      fallback_stages: runs.filter((run) => run.status === 'fallback').map((run) => run.stage),
    },
  })
  const userHash = hashUser(analysis.userId)
  // Parsing keeps only the declared props (and fails loudly on a taxonomy mismatch).
  await db.insert(analyticsEvents).values(
    events.map((event) => {
      const parsed = ServerAnalyticsEvent.parse(event)
      return { userHash, name: parsed.name, props: parsed.props }
    }),
  )
  return events.length
}
