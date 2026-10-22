import { ORPCError } from '@orpc/client'
import type {
  CorrectionsBatchInput,
  CreateLoopInput,
  Example,
  PracticeSyncInput,
  UpdateLoopInput,
  UpdateSongInput,
} from '@splitune/contracts'
import type { z } from 'zod'
import type { ApiClient, LocalProcedures } from '@/lib/api'
import type { GuestLoop, GuestStore } from './guest-store'

// A visitor's example songs (13 §1), answered on the device: the song and its finished analysis
// come from GET /v1/examples, documents and stems are signed by GET /v1/examples/{id}/url, and
// everything the practice screen saves (resume state, loops, passes, edits) goes to the guest
// database until the first sign-in claims it. Registered for the rest of the page once a visitor
// practises (practice-sync's outbox may flush as the page goes) and by the claim itself. Same procedures and shapes as the API, so the
// practice screen needs no special case.

type ExampleT = z.infer<typeof Example>

const notFound = () => new ORPCError('not_found', { status: 404 })

export function guestProcedures(examples: ExampleT[], store: GuestStore): LocalProcedures {
  const bySong = new Map(examples.map((e) => [e.song.id, e]))
  const byAnalysis = new Map(
    examples.flatMap((e) => (e.song.latest_analysis ? [[e.song.latest_analysis.id, e]] : [])),
  )
  const byArtefact = new Map(
    examples.flatMap((e) => e.song.artefacts.map((a) => [a.id, e] as const)),
  )
  const idOf = (input: unknown) => (input as { id?: unknown } | null)?.id
  const song = (id: unknown) => (typeof id === 'string' ? bySong.get(id) : undefined)

  const loopsOf = async (songId: string) => {
    const [loops, attempts] = await Promise.all([store.all('loops'), store.all('attempts')])
    return loops
      .filter((l) => l.song_id === songId)
      .map((loop) => {
        // The progress metric (12 §5), as the API derives it: fastest clean pass on the clip.
        const clean = attempts.filter((a) => a.loop_clip_id === loop.id && a.outcome === 'clean')
        return {
          ...loop,
          best_clean_tempo_pct:
            clean.length > 0 ? Math.max(...clean.map((a) => a.tempo_pct)) : null,
        }
      })
      .sort((a, b) => a.start_s - b.start_s || a.created_at.localeCompare(b.created_at))
  }

  const handlers: Record<string, (input: never, api: ApiClient) => Promise<unknown>> = {
    'songs.get': async ({ id }: { id: string }) => {
      const example = song(id)
      if (!example) throw notFound()
      const players = await store.all('players')
      const saved = players.find((p) => p.song_id === id)?.player_state
      return { ...example.song, player_state: saved ?? {} }
    },
    'songs.update': async (input: z.infer<typeof UpdateSongInput>) => {
      const example = song(input.id)
      if (!example) throw notFound()
      if (input.player_state) {
        await store.put('players', { song_id: input.id, player_state: input.player_state })
      }
      return { ...example.song, player_state: input.player_state ?? {} }
    },
    'songs.mediaUrl': async () => {
      throw notFound()
    },
    'analyses.get': async ({ id }: { id: string }) => {
      const analysis = byAnalysis.get(id)?.song.latest_analysis
      if (!analysis) throw notFound()
      return analysis
    },
    'artefacts.url': async (
      input: { id: string; stem_id?: string; variant?: 'aac_mp4' | 'opus_webm' },
      api: ApiClient,
    ) => {
      const example = byArtefact.get(input.id)
      if (!example) throw notFound()
      return api.examples.url({
        id: example.id,
        artefact_id: input.id,
        ...(input.stem_id === undefined ? {} : { stem_id: input.stem_id }),
        ...(input.variant === undefined ? {} : { variant: input.variant }),
      })
    },
    'artefacts.listCorrections': async ({ id }: { id: string }) => {
      const ops = (await store.all('corrections'))
        .filter((c) => c.artefact_id === id)
        .sort((a, b) => a.rev - b.rev)
      return {
        ops: ops.map((c) => ({
          rev: c.rev,
          client_op_id: c.client_op_id,
          op: c.op,
          created_at: c.created_at,
        })),
      }
    },
    'artefacts.applyCorrections': async (input: z.infer<typeof CorrectionsBatchInput>) => {
      const stored = (await store.all('corrections')).filter((c) => c.artefact_id === input.id)
      const revs = new Map(stored.map((c) => [c.client_op_id, c.rev]))
      let rev = Math.max(0, ...stored.map((c) => c.rev))
      for (const { client_op_id, op } of input.ops) {
        if (revs.has(client_op_id)) continue
        rev += 1
        revs.set(client_op_id, rev)
        await store.put('corrections', {
          client_op_id,
          artefact_id: input.id,
          rev,
          op,
          created_at: new Date().toISOString(),
        })
      }
      return {
        applied: input.ops.map((o) => ({
          client_op_id: o.client_op_id,
          rev: revs.get(o.client_op_id) as number,
        })),
      }
    },
    'loops.list': async ({ id }: { id: string }) => ({ items: await loopsOf(id) }),
    'loops.create': async (input: z.infer<typeof CreateLoopInput>) => {
      const loop: GuestLoop = {
        name: input.name ?? null,
        start_bar: input.start_bar,
        start_beat: input.start_beat,
        end_bar: input.end_bar,
        end_beat: input.end_beat,
        start_s: input.start_s,
        end_s: input.end_s,
        rest_between: input.rest_between ?? 'none',
        count_in_bars: input.count_in_bars ?? 1,
        trainer: input.trainer ?? null,
        id: crypto.randomUUID(),
        song_id: input.id,
        best_clean_tempo_pct: null,
        created_at: new Date().toISOString(),
      }
      await store.put('loops', loop)
      return loop
    },
    'loops.update': async (input: z.infer<typeof UpdateLoopInput>) => {
      const { id: songId, loop_id, ...patch } = input
      const loop = (await store.all('loops')).find((l) => l.id === loop_id && l.song_id === songId)
      if (!loop) throw notFound()
      const defined = Object.fromEntries(Object.entries(patch).filter(([, v]) => v !== undefined))
      const next: GuestLoop = { ...loop, ...defined }
      await store.put('loops', next)
      return (await loopsOf(songId)).find((l) => l.id === loop_id) ?? next
    },
    'loops.delete': async ({ loop_id }: { loop_id: string }) => {
      await store.delete('loops', [loop_id])
    },
    // Sessions of example songs stay on the device; any others (a real song's outbox from before)
    // still go to the API.
    'practice.sync': async (input: z.infer<typeof PracticeSyncInput>, api: ApiClient) => {
      const guestSessions = input.sessions.filter((s) => bySong.has(s.song_id))
      const stored = new Set([
        ...guestSessions.map((s) => s.client_session_id),
        ...(await store.all('sessions')).map((s) => s.client_session_id),
      ])
      const guestAttempts = input.attempts.filter((a) => stored.has(a.client_session_id))
      for (const session of guestSessions) await store.put('sessions', session)
      for (const attempt of guestAttempts) await store.put('attempts', attempt)
      const rest = {
        sessions: input.sessions.filter((s) => !bySong.has(s.song_id)),
        attempts: input.attempts.filter((a) => !stored.has(a.client_session_id)),
      }
      const remote =
        rest.sessions.length > 0 || rest.attempts.length > 0
          ? await api.practice.sync(rest)
          : { accepted_sessions: [], accepted_attempts: [] }
      return {
        accepted_sessions: [
          ...guestSessions.map((s) => s.client_session_id),
          ...remote.accepted_sessions,
        ],
        accepted_attempts: [
          ...guestAttempts.map((a) => a.client_attempt_id),
          ...remote.accepted_attempts,
        ],
      }
    },
  }

  const owns = (key: string, input: unknown): boolean => {
    const id = idOf(input)
    switch (key) {
      case 'songs.get':
      case 'songs.update':
      case 'songs.mediaUrl':
      case 'loops.list':
      case 'loops.create':
      case 'loops.update':
      case 'loops.delete':
        return typeof id === 'string' && bySong.has(id)
      case 'analyses.get':
      case 'analyses.events':
        return typeof id === 'string' && byAnalysis.has(id)
      case 'artefacts.url':
      case 'artefacts.listCorrections':
      case 'artefacts.applyCorrections':
        return typeof id === 'string' && byArtefact.has(id)
      // Attempts of an earlier, already synced session carry no song id: the handler sorts
      // every batch into the device's part and the API's.
      case 'practice.sync':
        return true
      default:
        return false
    }
  }

  return {
    handles: (path, input) => owns(path.join('.'), input),
    call: (path, input, api) => {
      const handler = handlers[path.join('.')]
      if (!handler) return Promise.reject(notFound())
      return handler(input as never, api)
    },
  }
}
