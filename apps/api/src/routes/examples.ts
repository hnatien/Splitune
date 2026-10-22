import type { Analysis as AnalysisSchema, Example as ExampleSchema } from '@splitune/contracts'
import type { ManifestExample } from '@splitune/contracts/examples-manifest'
import { exampleKey, examplePrefix } from '@splitune/storage'
import type { z } from 'zod'
import { apiError } from '../errors.ts'
import { CONFIG_PROFILE } from '../pipeline.ts'
import { type ApiDeps, authed, ipRateLimit, pub } from '../procedures.ts'
import { signArtefact } from './artefacts.ts'

// Example songs (13 §1, 03 "Example songs"), from the manifest `pnpm examples:build` writes.
// Visitors list and play them without an account; a signed-in user claims one, with the progress
// their device kept, as a `source_kind: example` song pointing at the shared artefacts.

type Example = z.infer<typeof ManifestExample>

function find(deps: ApiDeps, id: string): Example {
  const example = deps.config.examples.examples.find((e) => e.id === id)
  if (!example) throw apiError('not_found')
  return example
}

// The example as a finished song, in the shapes the practice screen reads for any song.
export function toPublicExample(example: Example): z.infer<typeof ExampleSchema> {
  const { analysis } = example
  const artefacts = example.artefacts.map((a) => ({
    id: a.id,
    kind: a.kind,
    version: a.version,
    bytes: a.bytes,
    sha256: a.sha256,
    created_at: analysis.finished_at,
  }))
  const latest: z.infer<typeof AnalysisSchema> = {
    id: analysis.id,
    song_id: example.song_id,
    version: 1,
    type: 'full',
    requested_instrument: example.instrument,
    status: 'done',
    progress: 1,
    pipeline_version: analysis.pipeline_version,
    stages: analysis.stages,
    artefacts,
    created_at: analysis.created_at,
    finished_at: analysis.finished_at,
  }
  return {
    id: example.id,
    title: example.title,
    artist: example.artist,
    instrument: example.instrument,
    part: example.part,
    duration_s: example.duration_s,
    loop: example.loop,
    speed_pct: example.speed_pct,
    song: {
      id: example.song_id,
      title: example.title,
      artist: example.artist,
      instrument: example.instrument,
      source_kind: 'example',
      source_url: null,
      duration_s: example.duration_s,
      status: 'ready',
      player_state: {},
      last_opened_at: null,
      created_at: analysis.created_at,
      latest_analysis: latest,
      artefacts,
      youtube: null,
    },
  }
}

export const examples = {
  list: pub.examples.list.handler(({ context }) => ({
    items: context.deps.config.examples.examples.map(toPublicExample),
  })),

  url: pub.use(ipRateLimit('examples')).examples.url.handler(async ({ context, input }) => {
    const example = find(context.deps, input.id)
    const artefact = example.artefacts.find((a) => a.id === input.artefact_id)
    if (!artefact) throw apiError('not_found')
    return signArtefact(
      context.deps,
      { kind: artefact.kind, objectKey: exampleKey(example.id, example.build, artefact.path) },
      input,
      examplePrefix(example.id, example.build),
    )
  }),

  // Idempotent by the song's dedupe key and the device's client ids, so a retry, a second tab or
  // a second sign-in sends the same progress again without doubling it.
  claim: authed.examples.claim.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const example = find(deps, input.id)
    const claimed = await deps.repos.examples.claim(
      userId,
      {
        title: example.title,
        artist: example.artist,
        instrument: example.instrument,
        durationS: example.duration_s,
        audioHash: example.audio_hash,
        analysis: {
          pipelineVersion: example.analysis.pipeline_version,
          configProfile: CONFIG_PROFILE,
          recommendedView: example.analysis.recommended_view,
          idempotencyKey: `example:${example.id}:${example.build}`,
          finishedAt: new Date(example.analysis.finished_at),
        },
        artefacts: example.artefacts.map((a) => ({
          kind: a.kind,
          version: a.version,
          objectKey: exampleKey(example.id, example.build, a.path),
          bytes: a.bytes,
          sha256: a.sha256,
          modelRefs: a.model_refs,
        })),
      },
      {
        playerState: input.player_state ?? {},
        loops: input.loops.map((loop) => ({
          id: loop.id,
          name: loop.name ?? null,
          startBar: loop.start_bar,
          startBeat: loop.start_beat,
          endBar: loop.end_bar,
          endBeat: loop.end_beat,
          startS: loop.start_s,
          endS: loop.end_s,
          ...(loop.rest_between === undefined ? {} : { restBetween: loop.rest_between }),
          ...(loop.count_in_bars === undefined ? {} : { countInBars: loop.count_in_bars }),
          ...(loop.trainer === undefined ? {} : { trainer: loop.trainer }),
        })),
      },
    )
    const songId = claimed.song.id
    await deps.repos.practice.upsertSessions(
      userId,
      input.sessions.map((s) => ({
        clientSessionId: s.client_session_id,
        songId,
        startedAt: new Date(s.started_at),
        endedAt: s.ended_at === undefined ? null : new Date(s.ended_at),
        inputMode: s.input_mode,
      })),
    )
    await deps.repos.practice.recordAttempts(
      userId,
      input.attempts.map((a) => ({
        clientAttemptId: a.client_attempt_id,
        clientSessionId: a.client_session_id,
        loopClipId: a.loop_clip_id ?? null,
        tempoPct: a.tempo_pct,
        outcome: a.outcome,
        override: a.override ?? false,
        at: new Date(a.at),
      })),
    )
    for (const batch of input.corrections) {
      const artefactId = claimed.artefactIds.get(batch.kind)
      if (artefactId === undefined) continue
      await deps.repos.corrections.append(
        userId,
        artefactId,
        batch.ops.map((o) => ({ clientOpId: o.client_op_id, op: o.op })),
      )
    }
    // Onboarding's instrument and level become the profile's, unless it has its own already.
    const profile = await deps.repos.users.get(userId)
    if (profile) {
      await deps.repos.users.updateProfile(userId, {
        ...(profile.primaryInstrument === null
          ? { primaryInstrument: input.instrument ?? example.instrument }
          : {}),
        ...(profile.level === null && input.level !== undefined ? { level: input.level } : {}),
      })
    }
    return { song_id: songId }
  }),
}
