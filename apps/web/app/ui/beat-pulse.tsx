import { cn } from '@/lib/utils'

// Doc 26 §4.7, §10, §12.2 (V9): the beat pulse, static until s42 animates it. One dot per beat of
// the bar (meter-aware): the downbeat is a square, the others round, so the downbeat reads by
// shape; beats played are filled `--beat-done`, the current beat `--beat-now` with the glow,
// upcoming ones an outline in `--beat-slot`. A small dot, never a flash (2.3.1).

const SIZES = {
  sm: 'size-3.5',
  md: 'size-5',
  lg: 'size-5.5',
  xl: 'size-6.5',
} as const

type BeatPulseProps = {
  /** Beats in the bar (4 in 4/4, 3 in 3/4…). */
  beats: number
  /** The beat being played, 0-based; -1 before the first. */
  current: number
  /** 14 / 20 / 22 / 26 px dots. */
  size?: keyof typeof SIZES
  /** "Beat 3 of 4". */
  label: string
  className?: string
}

function BeatPulse({ beats, current, size = 'sm', label, className }: BeatPulseProps) {
  return (
    <div
      role="img"
      aria-label={label}
      data-slot="beat-pulse"
      className={cn('flex items-center', size === 'sm' ? 'gap-2.5' : 'gap-3.5', className)}
    >
      {Array.from({ length: Math.max(1, beats) }, (_, beat) => (
        <span
          // The bar's beats are fixed positions; their state changes, never their order.
          // biome-ignore lint/suspicious/noArrayIndexKey: one dot per beat of the bar
          key={beat}
          data-beat={beat < current ? 'done' : beat === current ? 'now' : 'next'}
          className={cn(
            'block shrink-0 border-2',
            SIZES[size],
            beat === 0 ? 'rounded-xs' : 'rounded-full',
            beat < current && 'border-beat-done bg-beat-done',
            beat === current && 'border-beat-now bg-beat-now shadow-glow',
            beat > current && 'border-beat-slot',
          )}
        />
      ))}
    </div>
  )
}

export { BeatPulse }
