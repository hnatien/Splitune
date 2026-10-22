import type { ClaimExampleInput } from '@splitune/contracts'
import type { QueryClient } from '@tanstack/react-query'
import type { z } from 'zod'
import { answerLocally, client, orpc } from '@/lib/api'
import { meQuery } from '@/lib/session'
import { guestStore } from './guest-store'
import { clearGuestProgress } from './marker'

// The first sign-in claims what the visitor made on the example songs (13 §1): each example with
// progress becomes a song in the account (POST /v1/examples/{id}/claim) with its loops, passes,
// edits and resume state, and leaves the device. Client ids make a repeated claim harmless.

type ClaimInput = z.infer<typeof ClaimExampleInput>

const MAX_OPS = 500

let running: Promise<string[]> | undefined

/** Song ids of the claimed examples, in the account now. */
export function claimGuestProgress(queryClient: QueryClient): Promise<string[]> {
  running ??= claim(queryClient).finally(() => {
    running = undefined
  })
  return running
}

async function claim(queryClient: QueryClient): Promise<string[]> {
  // Sessions and passes reached the guest database as the practice outbox synced them (each
  // pass syncs at once; guest-link.ts answers the sync while a visitor practises).
  const { items } = await client.examples.list()
  const [profiles, loops, players, sessions, attempts, corrections] = await Promise.all([
    guestStore.all('profile'),
    guestStore.all('loops'),
    guestStore.all('players'),
    guestStore.all('sessions'),
    guestStore.all('attempts'),
    guestStore.all('corrections'),
  ])
  const profile = profiles[0]
  const claimed: string[] = []
  for (const example of items) {
    const songId = example.song.id
    const own = {
      loops: loops.filter((l) => l.song_id === songId),
      sessions: sessions.filter((s) => s.song_id === songId).slice(0, 100),
      player: players.find((p) => p.song_id === songId),
    }
    const sessionIds = new Set(own.sessions.map((s) => s.client_session_id))
    const ownAttempts = attempts.filter((a) => sessionIds.has(a.client_session_id)).slice(0, 1000)
    const kinds = new Map(example.song.artefacts.map((a) => [a.id, a.kind]))
    const ownCorrections = corrections.filter((c) => kinds.has(c.artefact_id))
    if (
      own.loops.length === 0 &&
      own.sessions.length === 0 &&
      ownCorrections.length === 0 &&
      !own.player
    ) {
      continue
    }
    const byKind = new Map<string, ClaimInput['corrections'][number]['ops']>()
    for (const c of ownCorrections.sort((a, b) => a.rev - b.rev)) {
      const kind = kinds.get(c.artefact_id) as string
      byKind.set(kind, [...(byKind.get(kind) ?? []), { client_op_id: c.client_op_id, op: c.op }])
    }
    const { song_id } = await client.examples.claim({
      id: example.id,
      ...(profile?.instrument ? { instrument: profile.instrument } : {}),
      ...(profile?.level ? { level: profile.level } : {}),
      ...(own.player ? { player_state: own.player.player_state } : {}),
      loops: own.loops
        .slice(0, 100)
        .map(
          ({ song_id: _song, best_clean_tempo_pct: _best, created_at: _created, ...loop }) => loop,
        ),
      sessions: own.sessions.map(({ song_id: _song, ...session }) => session),
      attempts: ownAttempts,
      corrections: [...byKind].map(([kind, ops]) => ({ kind, ops: ops.slice(0, MAX_OPS) })),
    })
    claimed.push(song_id)
    await Promise.all([
      guestStore.delete(
        'loops',
        own.loops.map((l) => l.id),
      ),
      guestStore.delete('sessions', [...sessionIds]),
      guestStore.delete(
        'attempts',
        ownAttempts.map((a) => a.client_attempt_id),
      ),
      guestStore.delete(
        'corrections',
        ownCorrections.map((c) => c.client_op_id),
      ),
      guestStore.delete('players', own.player ? [songId] : []),
    ])
  }
  await guestStore.delete('profile', ['me'])
  clearGuestProgress()
  answerLocally(undefined)
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: orpc.songs.list.key() }),
    queryClient.invalidateQueries({ queryKey: meQuery.queryKey }),
  ])
  return claimed
}
