import { randomUUID } from 'node:crypto'
import type { Database } from '../src/client.ts'
import {
  analyses,
  analyticsEvents,
  artefacts,
  correctionOps,
  loopClips,
  practiceAttempts,
  practiceSessions,
  songs,
  stageRuns,
  users,
} from '../src/schema/index.ts'

// A deterministic week of synthetic product data for the dashboards (16 §3): onboarding, practice,
// analyses with stage runs and corrections, imports, platform probes and billing events, for
// `users` made-up learners. Used by the dashboard tests and `pnpm --filter @splitune/db
// seed:dashboards` (local Grafana). Every user id starts with `synthetic-`.

const DAY = 86_400_000
const BEATS_MODEL = {
  model_id: 'beat_this/final0',
  version: '1.1.0',
  weights_sha256: 'a'.repeat(64),
  provider: 'self_hosted' as const,
  register_tier: 'green' as const,
}
const NOTES_MODEL = { ...BEATS_MODEL, model_id: 'basic_pitch/nmp', version: '0.4.0' }
const CHORDS_MODEL = { ...BEATS_MODEL, model_id: 'btc/sevenths', version: '1.0.0' }

export async function seedSyntheticWeek(
  db: Database,
  { start, users: count = 6 }: { start: Date; users?: number },
): Promise<{ userIds: string[] }> {
  const at = (day: number, minute: number) =>
    new Date(start.getTime() + day * DAY + minute * 60_000)
  const userIds: string[] = []
  for (let u = 0; u < count; u++) {
    const id = `synthetic-${randomUUID().slice(0, 8)}`
    userIds.push(id)
    await db.insert(users).values({ id, email: `${id}@synthetic.splitune.localhost` })
  }
  const events: (typeof analyticsEvents.$inferInsert)[] = []
  for (let day = 0; day < 7; day++) {
    for (const [u, userId] of userIds.entries()) {
      const userHash = `synthetic-hash-${u}`
      const minute = 60 * (9 + u) + day
      for (const step of ['instrument', 'level', 'screen', 'song', 'loop']) {
        // Fewer learners get further each step (a funnel).
        if (step === 'loop' && u % 3 === 0) continue
        events.push({
          userHash: null,
          name: 'onboarding_step_viewed',
          props: { step, instrument: 'guitar', level: 'few_songs' },
          at: at(day, minute),
        })
      }
      events.push(
        {
          userHash: null,
          name: 'example_song_opened',
          props: { example_id: 'ill-fate' },
          at: at(day, minute + 1),
        },
        {
          userHash: null,
          name: 'first_isolated_playback',
          props: { ms_since_song_selected: 20_000 + u * 5_000, source: 'example' },
          at: at(day, minute + 2),
        },
        {
          userHash,
          name: 'speed_changed',
          props: { speed_pct: 70, input_mode: u % 2 ? 'pedal' : 'touch' },
          at: at(day, minute + 3),
        },
        {
          userHash,
          name: 'loop_pass_completed',
          props: { tempo_pct: 70, outcome: 'clean', input_mode: u % 2 ? 'keyboard' : 'touch' },
          at: at(day, minute + 4),
        },
        {
          userHash,
          name: 'capability_probe',
          props: {
            browser: u % 2 ? 'webkit' : 'chromium',
            device_class: u % 2 ? 'tablet' : 'desktop',
            audio_worklet: true,
            wasm_simd: true,
            webcodecs: u % 2 === 0,
            opus_ok: true,
            output_latency_ms: 20,
            webgpu: false,
            wake_lock: true,
            midi: false,
          },
          at: at(day, minute),
        },
        {
          userHash,
          name: 'upload_started',
          props: { source: 'file', bytes_bucket: 'lt_10mb' },
          at: at(day, minute + 5),
        },
        {
          userHash,
          name: u === 0 ? 'upload_failed' : 'upload_completed',
          props:
            u === 0
              ? { source: 'file', bytes_bucket: 'lt_10mb', error_code: 'network_error' }
              : { source: 'file', bytes_bucket: 'lt_10mb' },
          at: at(day, minute + 6),
        },
        {
          userHash,
          name: 'display_settings_changed',
          props: {
            appearance: u % 2 ? 'dark' : 'stage',
            score_surface: 'paper',
            distance: 'stand',
            calibration_pct: 100,
            hyperlegible: false,
            reduced_motion: 'system',
            contrast: 'system',
          },
          at: at(day, minute + 7),
        },
      )
      if (u % 3 !== 0) {
        events.push({
          userHash: null,
          name: 'first_loop_reduced_speed',
          props: { ms_since_landing: 120_000 + u * 10_000, tempo_pct: 70 },
          at: at(day, minute + 3),
        })
      }
      if (u === 1) {
        events.push(
          {
            userHash,
            name: 'audio_underrun',
            props: { browser: 'webkit', device_class: 'tablet', rate: 0.7, preset: 'high' },
            at: at(day, minute + 8),
          },
          {
            userHash,
            name: 'paywall_viewed',
            props: { trigger: 'cap_lite' },
            at: at(day, minute + 9),
          },
          {
            userHash,
            name: 'upgrade_clicked',
            props: { trigger: 'cap_lite', plan: 'paid_monthly' },
            at: at(day, minute + 10),
          },
        )
      }
      if (u === 1 && day === 3) {
        events.push({
          userHash,
          name: 'checkout_completed',
          props: { plan: 'paid_monthly' },
          at: at(day, minute + 11),
        })
      }

      // One song, one Full analysis, one practice session with three passes per learner and day.
      const [song] = await db
        .insert(songs)
        .values({
          userId,
          title: 'Synthetic song',
          sourceKind: day % 2 ? 'url' : 'upload',
          instrument: u % 2 ? 'bass' : 'guitar',
          status: 'ready',
          createdAt: at(day, minute),
        })
        .returning()
      if (!song) throw new Error('seed failed')
      const created = at(day, minute)
      const [analysis] = await db
        .insert(analyses)
        .values({
          userId,
          songId: song.id,
          version: 1,
          pipelineVersion: 'synthetic',
          configProfile: 'production',
          requestedInstrument: song.instrument,
          analysisType: 'full',
          status: 'done',
          idempotencyKey: randomUUID(),
          recommendedView: u % 4 === 3 ? 'chords_only' : 'tab',
          createdAt: created,
          finishedAt: new Date(created.getTime() + 150_000 + u * 4_000),
        })
        .returning()
      if (!analysis) throw new Error('seed failed')
      const stage = (
        name: string,
        offsetS: number,
        durationS: number,
        status: 'done' | 'fallback' | 'failed',
        models: (typeof BEATS_MODEL)[],
      ) => ({
        analysisId: analysis.id,
        stage: name as typeof stageRuns.$inferInsert.stage,
        status,
        modelRefs: models,
        cacheKey: randomUUID(),
        gpuSeconds: name === 'separate' ? durationS : null,
        startedAt: new Date(created.getTime() + offsetS * 1000),
        finishedAt: new Date(created.getTime() + (offsetS + durationS) * 1000),
      })
      const notesStage = `notes.${song.instrument}`
      await db
        .insert(stageRuns)
        .values([
          ...(song.sourceKind === 'url'
            ? [stage('url_import', 0, 15, u === 2 ? 'failed' : 'done', [])]
            : []),
          stage('decode', 16, 2, 'done', []),
          stage('beats', 18, 3 + u, 'done', [BEATS_MODEL]),
          stage('separate', 22, 120 + u, 'done', []),
          stage('chords', 143, 8, u === 4 ? 'fallback' : 'done', [CHORDS_MODEL]),
          stage(notesStage, 143, 4, 'done', [NOTES_MODEL]),
          stage('finalize', 152, 1, 'done', []),
        ])
      const [chords] = await db
        .insert(artefacts)
        .values({
          userId,
          analysisId: analysis.id,
          kind: 'chords',
          version: 1,
          objectKey: `u/${userId}/a/${analysis.id}/v1/chords.json`,
          bytes: 100,
          sha256: 'c'.repeat(64),
          modelRefs: [CHORDS_MODEL],
        })
        .returning()
      if (!chords) throw new Error('seed failed')
      await db.insert(correctionOps).values([
        {
          userId,
          artefactId: chords.id,
          rev: 1,
          op: { op: 'set_chord', segment_id: 's1', label: 'A:min' },
          clientOpId: randomUUID(),
          createdAt: at(day, minute + 20),
        },
        ...(u % 2
          ? [
              {
                userId,
                artefactId: chords.id,
                rev: 2,
                op: { op: 'report_wrong' as const, entity_id: 's2' },
                clientOpId: randomUUID(),
                createdAt: at(day, minute + 21),
              },
            ]
          : []),
      ])
      const [loop] = await db
        .insert(loopClips)
        .values({
          userId,
          songId: song.id,
          startBar: 4,
          endBar: 7,
          endBeat: 4,
          startS: 9.6,
          endS: 19.2,
        })
        .returning()
      const [session] = await db
        .insert(practiceSessions)
        .values({
          userId,
          songId: song.id,
          startedAt: at(day, minute + 30),
          endedAt: at(day, minute + 45),
          inputMode: u % 2 ? 'pedal' : 'touch',
          clientSessionId: randomUUID(),
        })
        .returning()
      if (!loop || !session) throw new Error('seed failed')
      await db.insert(practiceAttempts).values(
        [60, 70, 80].map((tempoPct, i) => ({
          userId,
          sessionId: session.id,
          loopClipId: loop.id,
          tempoPct,
          outcome: (i === 2 && u % 2 ? 'not_yet' : 'clean') as 'clean' | 'not_yet',
          at: at(day, minute + 31 + i),
          clientAttemptId: randomUUID(),
        })),
      )
    }
  }
  await db.insert(analyticsEvents).values(events)
  return { userIds }
}
