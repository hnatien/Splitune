import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, §13: confirms a key or pedal action ("Loop on", "Speed 75 %") with a large label
// for 1.2 s and a polite live announcement. Focus never moves; the HUD ignores the pointer.

export const PEDAL_HUD_MS = 1200

type PedalHudProps = {
  /** The latest action; bump `sequence` to show the same text again. */
  message: string | null
  sequence: number
  icon?: React.ReactNode
  className?: string
}

function PedalHud({ message, sequence, icon, className }: PedalHudProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (message === null || sequence === 0) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), PEDAL_HUD_MS)
    return () => clearTimeout(timer)
  }, [message, sequence])

  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {message}
      </div>
      <div
        aria-hidden
        data-slot="pedal-hud"
        data-visible={visible || undefined}
        className={cn(
          'pointer-events-none fixed top-[40%] left-1/2 z-(--z-hud) flex -translate-x-1/2 -translate-y-1/2 items-center gap-3 rounded-xl bg-hud-bg px-7 py-4 font-reading text-read-readout font-semibold whitespace-nowrap text-hud-fg tabular-nums opacity-0 transition-opacity duration-(--duration-base) data-visible:opacity-100 [&_svg]:size-[1em]',
          className,
        )}
      >
        {icon}
        {message}
      </div>
    </>
  )
}

export { PedalHud }
