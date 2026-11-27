import { cn } from '@/lib/utils'

/** `levels` thinned to `count` bars, each the loudest of the levels it stands for. */
function thin(levels: readonly number[], count: number): number[] {
  if (levels.length <= count) return [...levels]
  return Array.from({ length: count }, (_, bar) => {
    const from = Math.floor((bar * levels.length) / count)
    const to = Math.max(from + 1, Math.floor(((bar + 1) * levels.length) / count))
    return Math.max(...levels.slice(from, to))
  })
}

/**
 * WaveformBars (doc 26 §4.7): a song's waveform in miniature, as a still picture. Rounded bars
 * centred on the middle line, in the song map's own colours: `--waveform-peak` for what is still
 * to come and the stronger `--waveform-played` up to `played` (0–1). Decorative: whatever it shows
 * is also said in words beside it. It fills its box, so the caller sets the size.
 */
function WaveformBars({
  levels,
  bars = levels.length,
  played = 0,
  className,
}: {
  /** Loudness per slice, 0–100. */
  levels: readonly number[]
  /** How many bars to draw; fewer than the levels thins them out for a narrow box. */
  bars?: number
  played?: number
  className?: string
}) {
  const shown = thin(levels, bars)
  const done = Math.round(Math.min(1, Math.max(0, played)) * shown.length)
  return (
    <div
      data-slot="waveform-bars"
      aria-hidden
      className={cn('flex items-center gap-0.5', className)}
    >
      {shown.map((level, index) => (
        <span
          // biome-ignore lint/suspicious/noArrayIndexKey: the bars are positional
          key={index}
          className={cn(
            'min-h-1 min-w-0 flex-1 rounded-full',
            index < done ? 'bg-waveform-played' : 'bg-waveform-peak',
          )}
          style={{ height: `${level}%` }}
        />
      ))}
    </div>
  )
}

export { WaveformBars }
