import { pub } from './procedures.ts'
import { me } from './routes/me.ts'
import { songs } from './routes/songs.ts'
import { uploads } from './routes/uploads.ts'

export const router = pub.router({ me, songs, uploads })

export type Router = typeof router
