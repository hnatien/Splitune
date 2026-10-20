// A listening session (written by services/ml/eval/p1.py export): clips, the stems to rate and
// the A/B pairs. Raters only ever see opaque tokens and a per-rater shuffled order (blind test,
// 08 §1); which system produced an item stays on the server.
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { z } from 'zod'

const Token = z.string().regex(/^[a-z0-9]{12,32}$/)
const File = z.string().regex(/^[a-z0-9][a-z0-9_.-]*\.m4a$/)

export const Manifest = z.object({
  id: z.string().regex(/^[a-z0-9-]{1,64}$/),
  question: z.string().min(1),
  clips: z.array(
    z.object({
      clip: z.string().min(1),
      target: z.enum(['guitar', 'bass', 'piano', 'drums', 'vocals']),
      mixture: z.object({ token: Token, file: File }),
    }),
  ),
  items: z.array(
    z.object({
      item: Token,
      clip: z.string().min(1),
      kind: z.enum(['isolated', 'mix_minus']),
      system: z.string().min(1), // e.g. "bs_roformer_sw" or "htdemucs_6s:complement"; never sent
      file: File,
    }),
  ),
  pairs: z.array(z.object({ pair: Token, clip: z.string().min(1), a: Token, b: Token })),
})
export type Manifest = z.infer<typeof Manifest>

export function loadManifest(dir: string): Manifest {
  return Manifest.parse(JSON.parse(readFileSync(join(dir, 'session.json'), 'utf8')))
}

export type Task =
  | { type: 'rate'; id: string; target: string; kind: 'isolated' | 'mix_minus'; mixture: string }
  | {
      type: 'compare'
      id: string
      target: string
      kind: 'isolated' | 'mix_minus'
      mixture: string
      a: string
      b: string
    }

// Deterministic per rater: the same rater resumes in the same order, different raters differ.
function order(rater: string, id: string): string {
  return createHash('sha256').update(`${rater}:${id}`).digest('hex')
}

export function tasksFor(manifest: Manifest, rater: string): Task[] {
  const clips = new Map(manifest.clips.map((c) => [c.clip, c]))
  const items = new Map(manifest.items.map((i) => [i.item, i]))
  const clipOf = (name: string) => {
    const clip = clips.get(name)
    if (!clip) throw new Error(`session refers to unknown clip ${name}`)
    return clip
  }
  const rate: Task[] = manifest.items.map((i) => {
    const clip = clipOf(i.clip)
    return {
      type: 'rate',
      id: i.item,
      target: clip.target,
      kind: i.kind,
      mixture: clip.mixture.token,
    }
  })
  const compare: Task[] = manifest.pairs.map((p) => {
    const clip = clipOf(p.clip)
    const a = items.get(p.a)
    if (!a || !items.has(p.b)) throw new Error(`pair ${p.pair} refers to an unknown item`)
    // Which side is "A" is shuffled per rater as well.
    const [first, second] =
      order(rater, `${p.pair}:side`) < order(rater, `${p.pair}:flip`) ? [p.a, p.b] : [p.b, p.a]
    return {
      type: 'compare',
      id: p.pair,
      target: clip.target,
      kind: a.kind,
      mixture: clip.mixture.token,
      a: first,
      b: second,
    }
  })
  // Ratings first (absolute judgements unprimed by comparisons), each block shuffled.
  const shuffle = (tasks: Task[]) =>
    tasks.sort((x, y) => (order(rater, x.id) < order(rater, y.id) ? -1 : 1))
  return [...shuffle(rate), ...shuffle(compare)]
}

// token -> file inside the session directory; anything else is a 404.
export function mediaFiles(manifest: Manifest): Map<string, string> {
  return new Map([
    ...manifest.clips.map((c) => [c.mixture.token, c.mixture.file] as const),
    ...manifest.items.map((i) => [i.item, i.file] as const),
  ])
}
