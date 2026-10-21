import type { Database } from '../client.ts'
import { analysesRepo } from './analyses.ts'
import { artefactsRepo } from './artefacts.ts'
import { correctionsRepo } from './corrections.ts'
import { loopsRepo } from './loops.ts'
import { practiceRepo } from './practice.ts'
import { songsRepo } from './songs.ts'
import { uploadsRepo } from './uploads.ts'
import { usageRepo } from './usage.ts'
import { usersRepo } from './users.ts'

export type * from './analyses.ts'
export type * from './artefacts.ts'
export type * from './corrections.ts'
export type * from './loops.ts'
export type * from './practice.ts'
export type * from './songs.ts'
export { libraryCursor } from './songs.ts'
export type * from './uploads.ts'
export type * from './usage.ts'
export type * from './users.ts'

// User-scoped data access. Every function takes the user id first, filters on it and runs inside
// withUser(), so RLS backs up the explicit filter.
export function createRepositories(db: Database) {
  return {
    users: usersRepo(db),
    songs: songsRepo(db),
    uploads: uploadsRepo(db),
    analyses: analysesRepo(db),
    artefacts: artefactsRepo(db),
    corrections: correctionsRepo(db),
    loops: loopsRepo(db),
    practice: practiceRepo(db),
    usage: usageRepo(db),
  }
}

export type Repositories = ReturnType<typeof createRepositories>
