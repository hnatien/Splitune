import type { FollowMode } from '@/lib/display-store'
import { useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { useMediaQuery } from '@/lib/use-media-query'
import { usePractice } from './practice-context'

/**
 * How the notation moves (12 §3, 26 §10): the learner's follow mode and playhead style; reduced
 * motion allows Page only (Off stays Off), steps the playhead by beat and turns pages without
 * smooth scrolling.
 */
export function useNotationMotion() {
  const follow = usePracticeDefaults((s) => s.notationLayout)
  const playhead = usePracticeDefaults((s) => s.playhead)
  const motion = useDisplay((s) => s.motion)
  const systemReduce = useMediaQuery('(prefers-reduced-motion: reduce)', false)
  const reduced = motion === 'reduce' || (motion === 'system' && systemReduce)
  const layout: FollowMode = reduced && follow === 'scroll' ? 'page' : follow
  return { layout, playhead, stepped: reduced, smoothScroll: !reduced }
}

/** The loop bracket's badge (27 §3.7.1): "Loop · bars 25–28 · pass 2 at 75 %", or with the speed
 * ladder on the clean pass being played for, "pass 2 of 3 at 75 %". */
export function useLoopLabel(): string | undefined {
  const { player, ladder } = usePractice()
  const loop = player.loop
  if (!loop) return undefined
  const bars = `${loop.startBar + 1}–${loop.endBar + 1}`
  if (ladder) {
    return m['practice.loop_bracket_ladder']({
      bars,
      pass: String(ladder.pass),
      of: String(ladder.of),
      speed: formatPercent(ladder.speedPct),
    })
  }
  return player.pass > 0
    ? m['practice.loop_bracket']({
        bars,
        pass: String(player.pass),
        speed: formatPercent(player.speedPct),
      })
    : m['practice.loop_badge']({ bars })
}
