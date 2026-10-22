import { and, desc, eq } from 'drizzle-orm'
import { type Database, withUser } from '../client.ts'
import { analyses, artefacts, loopClips, songs, users } from '../schema/index.ts'
import type { Analysis } from './analyses.ts'
import type { NewLoopClip } from './loops.ts'
import type { Song } from './songs.ts'

type ArtefactRow = typeof artefacts.$inferSelect

// An example song as the account gets it (03 "Example songs"): a lightweight song with a finished
// analysis whose artefact rows point at the shared objects under assets/examples/ (the RLS policy
// artefacts_example_insert allows nothing else).
export interface ExampleCopy {
  title: string
  artist: string | null
  instrument: Song['instrument']
  durationS: number
  audioHash: string
  analysis: Pick<
    Analysis,
    'pipelineVersion' | 'configProfile' | 'recommendedView' | 'idempotencyKey' | 'finishedAt'
  >
  artefacts: Pick<
    ArtefactRow,
    'kind' | 'version' | 'objectKey' | 'bytes' | 'sha256' | 'modelRefs'
  >[]
}

export interface ClaimedExample {
  song: Song
  // Latest artefact id per kind of the song's latest analysis (corrections attach to these).
  artefactIds: Map<string, string>
  created: boolean
}

// The system user owns the example songs' own analyses while `pnpm examples:build` runs them
// (03 "Notes"; `pnpm seed` creates it too).
export const SYSTEM_USER = {
  id: 'system',
  email: 'system@splitune.localhost',
  displayName: 'Splitune',
}

export function examplesRepo(db: Database) {
  return {
    // Creates the system user if this database doesn't have it yet (as the table owner: users
    // are otherwise created by Better Auth).
    ensureSystemUser: async () => {
      await db.insert(users).values(SYSTEM_USER).onConflictDoNothing({ target: users.id })
      return SYSTEM_USER.id
    },

    // Idempotent: the song is found again by (user, audio_hash, instrument), the songs table's
    // dedupe key, so a second claim (or the user's own upload of the same recording) reuses it.
    // Loops keep the ids the device gave them; ids already stored are skipped. `playerState`
    // applies only to a new song, never over one the user has practised since.
    claim: (
      userId: string,
      copy: ExampleCopy,
      progress: { playerState: Song['playerState']; loops: (NewLoopClip & { id: string })[] },
    ) =>
      withUser(db, userId, async (tx): Promise<ClaimedExample> => {
        const [existing] = await tx
          .select()
          .from(songs)
          .where(
            and(
              eq(songs.userId, userId),
              eq(songs.audioHash, copy.audioHash),
              eq(songs.instrument, copy.instrument),
            ),
          )
        let song: Song
        let artefactRows: ArtefactRow[]
        if (existing) {
          song = existing
          const [latest] = await tx
            .select({ id: analyses.id })
            .from(analyses)
            .where(and(eq(analyses.userId, userId), eq(analyses.songId, song.id)))
            .orderBy(desc(analyses.createdAt))
            .limit(1)
          artefactRows = latest
            ? await tx
                .select()
                .from(artefacts)
                .where(and(eq(artefacts.userId, userId), eq(artefacts.analysisId, latest.id)))
            : []
        } else {
          const now = new Date()
          const [inserted] = await tx
            .insert(songs)
            .values({
              userId,
              title: copy.title,
              artist: copy.artist,
              sourceKind: 'example',
              instrument: copy.instrument,
              durationS: copy.durationS,
              audioHash: copy.audioHash,
              status: 'ready',
              lastOpenedAt: now,
              playerState: progress.playerState,
            })
            .returning()
          song = inserted as Song
          const [analysis] = await tx
            .insert(analyses)
            .values({
              userId,
              songId: song.id,
              version: 1,
              pipelineVersion: copy.analysis.pipelineVersion,
              configProfile: copy.analysis.configProfile,
              requestedInstrument: copy.instrument,
              analysisType: 'full',
              status: 'done',
              progress: 1,
              idempotencyKey: copy.analysis.idempotencyKey,
              recommendedView: copy.analysis.recommendedView,
              finishedAt: copy.analysis.finishedAt ?? now,
            })
            .returning({ id: analyses.id })
          artefactRows = await tx
            .insert(artefacts)
            .values(
              copy.artefacts.map((a) => ({
                ...a,
                userId,
                analysisId: (analysis as { id: string }).id,
                // Shared objects: never swept with the user's stems.
                expiresAt: null,
              })),
            )
            .returning()
        }
        if (progress.loops.length > 0) {
          await tx
            .insert(loopClips)
            .values(progress.loops.map((loop) => ({ ...loop, userId, songId: song.id })))
            .onConflictDoNothing({ target: loopClips.id })
        }
        const latestByKind = new Map<string, ArtefactRow>()
        for (const row of artefactRows) {
          const best = latestByKind.get(row.kind)
          if (!best || row.version > best.version) latestByKind.set(row.kind, row)
        }
        return {
          song,
          artefactIds: new Map([...latestByKind].map(([kind, row]) => [kind, row.id])),
          created: !existing,
        }
      }),
  }
}
