import type { LoopClip as LoopClipSchema } from '@splitune/contracts'
import type { LoopClip, LoopClipPatch } from '@splitune/db'
import type { z } from 'zod'
import { apiError } from '../errors.ts'
import { authed } from '../procedures.ts'

// Saved loop clips per song (12 §5). Bars are the beat grid's 0-based bar_index; start_s/end_s
// are the times on the current grid, so a clip plays even before the grid is loaded.

type LoopOut = z.infer<typeof LoopClipSchema>

const toLoop = (clip: LoopClip): LoopOut => ({
  id: clip.id,
  song_id: clip.songId,
  name: clip.name,
  start_bar: clip.startBar,
  start_beat: clip.startBeat,
  end_bar: clip.endBar,
  end_beat: clip.endBeat,
  start_s: clip.startS,
  end_s: clip.endS,
  rest_between: clip.restBetween,
  count_in_bars: clip.countInBars,
  trainer: clip.trainer ?? null,
  best_clean_tempo_pct: clip.bestCleanTempoPct,
  created_at: clip.createdAt.toISOString(),
})

const emptyRange = () =>
  apiError('invalid_input', { details: { issues: [{ path: 'end_s', code: 'empty_range' }] } })

export const loops = {
  list: authed.loops.list.handler(async ({ context, input }) => {
    const { deps, userId } = context
    if (!(await deps.repos.songs.get(userId, input.id))) throw apiError('not_found')
    return { items: (await deps.repos.loops.list(userId, input.id)).map(toLoop) }
  }),

  create: authed.loops.create.handler(async ({ context, input }) => {
    const { deps, userId } = context
    if (input.end_s <= input.start_s) throw emptyRange()
    if (!(await deps.repos.songs.get(userId, input.id))) throw apiError('not_found')
    const clip = await deps.repos.loops.create(userId, input.id, {
      name: input.name ?? null,
      startBar: input.start_bar,
      startBeat: input.start_beat,
      endBar: input.end_bar,
      endBeat: input.end_beat,
      startS: input.start_s,
      endS: input.end_s,
      ...(input.rest_between === undefined ? {} : { restBetween: input.rest_between }),
      ...(input.count_in_bars === undefined ? {} : { countInBars: input.count_in_bars }),
      trainer: input.trainer ?? null,
    })
    return toLoop(clip)
  }),

  update: authed.loops.update.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const current = await deps.repos.loops.get(userId, input.loop_id)
    if (!current || current.songId !== input.id) throw apiError('not_found')
    if ((input.end_s ?? current.endS) <= (input.start_s ?? current.startS)) throw emptyRange()
    const patch: LoopClipPatch = {}
    if (input.name !== undefined) patch.name = input.name
    if (input.start_bar !== undefined) patch.startBar = input.start_bar
    if (input.start_beat !== undefined) patch.startBeat = input.start_beat
    if (input.end_bar !== undefined) patch.endBar = input.end_bar
    if (input.end_beat !== undefined) patch.endBeat = input.end_beat
    if (input.start_s !== undefined) patch.startS = input.start_s
    if (input.end_s !== undefined) patch.endS = input.end_s
    if (input.rest_between !== undefined) patch.restBetween = input.rest_between
    if (input.count_in_bars !== undefined) patch.countInBars = input.count_in_bars
    if (input.trainer !== undefined) patch.trainer = input.trainer
    const clip =
      Object.keys(patch).length > 0
        ? await deps.repos.loops.update(userId, input.loop_id, patch)
        : current
    if (!clip) throw apiError('not_found')
    return toLoop(clip)
  }),

  delete: authed.loops.delete.handler(async ({ context, input }) => {
    const { deps, userId } = context
    const current = await deps.repos.loops.get(userId, input.loop_id)
    if (!current || current.songId !== input.id) throw apiError('not_found')
    await deps.repos.loops.delete(userId, input.loop_id)
  }),
}
