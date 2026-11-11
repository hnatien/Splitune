import { z } from 'zod'

// The speed ladder (21 V1, 12 §5), stored on the loop clip: the speed climbs from start_pct to
// end_pct in step_pct steps. `plays_per_step` counts clean passes ("Felt clean") per step, not
// plays: the trainer was behind `v1.speed_trainer` until the ladder shipped, so no stored clip
// carries the old meaning. `drop_after_misses` "Not yet" in a row go back one step (0 = never);
// `on_goal` says what a finished ladder does. The last three fields are where the learner is on
// the ladder, written as passes are rated so a reload picks up on the same rung.
export const SpeedTrainer = z.object({
  start_pct: z.number().int().min(25).max(200),
  end_pct: z.number().int().min(25).max(200),
  step_pct: z.number().int().min(1).max(50),
  plays_per_step: z.number().int().min(1).max(20),
  count_in_each_pass: z.boolean(),
  drop_after_misses: z.number().int().min(0).max(5),
  on_goal: z.enum(['keep', 'stop']),
  current_pct: z.number().int().min(25).max(200).optional(),
  clean_count: z.number().int().min(0).max(20).optional(),
  miss_count: z.number().int().min(0).max(5).optional(),
})

export const RestBetween = z.enum(['none', 'beat', 'bar'])

// Bars use the beat grid's bar_index (0-based); beats are 1-based within the bar. start_s/end_s
// are the resolved times for the current beat grid.
const LoopFields = z.object({
  name: z.string().trim().min(1).max(100).nullable(),
  start_bar: z.number().int().min(-1),
  start_beat: z.number().int().positive(),
  end_bar: z.number().int().min(-1),
  end_beat: z.number().int().positive(),
  start_s: z.number().nonnegative(),
  end_s: z.number().nonnegative(),
  rest_between: RestBetween,
  count_in_bars: z.number().int().min(0).max(4),
  trainer: SpeedTrainer.nullable(),
})

export const LoopClip = LoopFields.extend({
  id: z.uuid(),
  song_id: z.uuid(),
  best_clean_tempo_pct: z.number().int().min(1).max(200).nullable(),
  created_at: z.iso.datetime(),
})

export const ListLoopsInput = z.object({ id: z.uuid() }) // song id

export const ListLoopsOutput = z.object({ items: z.array(LoopClip) })

export const CreateLoopInput = LoopFields.partial({
  name: true,
  rest_between: true,
  count_in_bars: true,
  trainer: true,
}).extend({ id: z.uuid() }) // song id

export const UpdateLoopInput = LoopFields.partial().extend({ id: z.uuid(), loop_id: z.uuid() })

export const DeleteLoopInput = z.object({ id: z.uuid(), loop_id: z.uuid() })
