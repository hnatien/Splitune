// HTTP surface of the listening test: the page, blinded media and the answer endpoints.
import { createReadStream, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { Hono } from 'hono'
import { z } from 'zod'
import { type Manifest, mediaFiles, type Task, tasksFor } from './session.ts'
import type { Store } from './store.ts'

const PUBLIC = join(import.meta.dirname, '..', 'public')
const RaterId = z.uuid()
const NewRater = z.object({
  name: z.string().trim().min(1).max(80),
  instrument: z.string().trim().min(1).max(40),
  experience: z.enum(['learner', 'intermediate', 'teacher']),
})
const Rating = z.object({ rater: RaterId, item: z.string(), score: z.number().int().min(1).max(5) })
const Preference = z.object({
  rater: RaterId,
  pair: z.string(),
  choice: z.enum(['a', 'b', 'none']),
})

type Answered = Task & { answer: number | 'a' | 'b' | 'none' | null }

// One `bytes=start-end` / `bytes=start-` / `bytes=-suffix` range; null = whole file.
export function byteRange(
  header: string | undefined,
  size: number,
): [number, number] | null | 'invalid' {
  if (!header) return null
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim())
  if (!match || (match[1] === '' && match[2] === '')) return 'invalid'
  const [, first = '', last = ''] = match
  let start: number
  let end: number
  if (first === '') {
    start = Math.max(0, size - Number(last))
    end = size - 1
  } else {
    start = Number(first)
    end = last === '' ? size - 1 : Math.min(Number(last), size - 1)
  }
  return start <= end && start < size ? [start, end] : 'invalid'
}

export function createApp(manifest: Manifest, dir: string, store: Store): Hono {
  const media = mediaFiles(manifest)
  const items = new Set(manifest.items.map((i) => i.item))
  const pairs = new Map(manifest.pairs.map((p) => [p.pair, p]))
  const app = new Hono()

  app.get('/', (c) => c.html(readFileSync(join(PUBLIC, 'index.html'), 'utf8')))
  app.get('/app.js', (c) =>
    c.body(readFileSync(join(PUBLIC, 'app.js'), 'utf8'), 200, {
      'content-type': 'text/javascript',
    }),
  )

  // Safari only plays media from servers that answer byte-range requests (206 + Content-Range).
  app.get('/media/:token', (c) => {
    const file = media.get(c.req.param('token'))
    if (!file) return c.notFound()
    const path = join(dir, 'media', file)
    const size = statSync(path).size
    const headers: Record<string, string> = {
      'content-type': 'audio/mp4',
      'cache-control': 'no-store',
      'accept-ranges': 'bytes',
    }
    const range = byteRange(c.req.header('range'), size)
    if (range === 'invalid') {
      return c.body(null, 416, { ...headers, 'content-range': `bytes */${size}` })
    }
    const [start, end] = range ?? [0, size - 1]
    headers['content-length'] = String(end - start + 1)
    if (range) headers['content-range'] = `bytes ${start}-${end}/${size}`
    const stream = Readable.toWeb(createReadStream(path, { start, end })) as ReadableStream
    return c.body(stream, range ? 206 : 200, headers)
  })

  app.post('/api/raters', async (c) => {
    const body = NewRater.safeParse(await c.req.json().catch(() => null))
    if (!body.success) return c.json({ error: 'invalid_rater' }, 400)
    return c.json({ rater: await store.addRater(body.data) })
  })

  app.get('/api/tasks', async (c) => {
    const rater = RaterId.safeParse(c.req.query('rater'))
    if (!rater.success || !(await store.hasRater(rater.data)))
      return c.json({ error: 'unknown_rater' }, 404)
    const { ratings, preferred } = await store.answers(manifest.id, rater.data)
    const tasks: Answered[] = tasksFor(manifest, rater.data).map((task) => {
      if (task.type === 'rate') return { ...task, answer: ratings.get(task.id) ?? null }
      if (!preferred.has(task.id)) return { ...task, answer: null }
      const item = preferred.get(task.id)
      return { ...task, answer: item === null ? 'none' : item === task.a ? 'a' : 'b' }
    })
    return c.json({ question: manifest.question, tasks })
  })

  app.post('/api/ratings', async (c) => {
    const body = Rating.safeParse(await c.req.json().catch(() => null))
    if (!body.success || !items.has(body.data.item)) return c.json({ error: 'invalid_rating' }, 400)
    if (!(await store.hasRater(body.data.rater))) return c.json({ error: 'unknown_rater' }, 404)
    await store.saveRating(manifest.id, body.data.rater, body.data.item, body.data.score)
    return c.json({ ok: true })
  })

  app.post('/api/preferences', async (c) => {
    const body = Preference.safeParse(await c.req.json().catch(() => null))
    const pair = body.success ? pairs.get(body.data.pair) : undefined
    if (!body.success || !pair) return c.json({ error: 'invalid_preference' }, 400)
    if (!(await store.hasRater(body.data.rater))) return c.json({ error: 'unknown_rater' }, 404)
    // Store the preferred *item*, so the per-rater side shuffle never leaks into results.
    const task = tasksFor(manifest, body.data.rater).find(
      (t) => t.type === 'compare' && t.id === pair.pair,
    )
    if (task?.type !== 'compare') return c.json({ error: 'invalid_preference' }, 400)
    const choice = body.data.choice
    await store.savePreference(
      manifest.id,
      body.data.rater,
      pair.pair,
      choice === 'none' ? null : task[choice],
    )
    return c.json({ ok: true })
  })

  return app
}
