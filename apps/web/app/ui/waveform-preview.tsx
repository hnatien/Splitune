import { cn } from '@/lib/utils'

// Static waveform of a picked file (27 §3.6 file row): one bar per peak, mirrored around the
// centre line, in the neutral waveform colour. The interactive WaveformTimeline is step 12's.

type WaveformPreviewProps = {
  /** Peak |sample| per bin, 0–1. */
  peaks: number[]
  /** Text alternative, e.g. "Waveform of song.mp3, 3:42". */
  label: string
  className?: string
}

function WaveformPreview({ peaks, label, className }: WaveformPreviewProps) {
  const height = 100
  return (
    <svg
      data-slot="waveform-preview"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${Math.max(1, peaks.length)} ${height}`}
      preserveAspectRatio="none"
      className={cn('h-16 w-full fill-waveform-peak', className)}
    >
      {peaks.map((peak, i) => {
        const bar = Math.max(2, Math.min(1, peak) * height)
        return (
          // biome-ignore lint/suspicious/noArrayIndexKey: bins are positional and never reorder
          <rect key={i} x={i + 0.15} y={(height - bar) / 2} width={0.7} height={bar} />
        )
      })}
    </svg>
  )
}

export { WaveformPreview }
