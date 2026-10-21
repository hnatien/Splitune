import { pub } from './procedures.ts'
import { analyses } from './routes/analyses.ts'
import { artefacts } from './routes/artefacts.ts'
import { me } from './routes/me.ts'
import { songs } from './routes/songs.ts'
import { system } from './routes/system.ts'
import { uploads } from './routes/uploads.ts'

export const router = pub.router({ me, songs, uploads, analyses, artefacts, system })

export type Router = typeof router
