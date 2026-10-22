import { pub } from './procedures.ts'
import { analyses } from './routes/analyses.ts'
import { analytics } from './routes/analytics.ts'
import { artefacts } from './routes/artefacts.ts'
import { corrections } from './routes/corrections.ts'
import { examples } from './routes/examples.ts'
import { loops } from './routes/loops.ts'
import { me } from './routes/me.ts'
import { practice } from './routes/practice.ts'
import { songs } from './routes/songs.ts'
import { system } from './routes/system.ts'
import { uploads } from './routes/uploads.ts'

export const router = pub.router({
  me,
  songs,
  uploads,
  analyses,
  artefacts: { ...artefacts, ...corrections },
  loops,
  practice,
  system,
  examples,
  analytics,
})

export type Router = typeof router
