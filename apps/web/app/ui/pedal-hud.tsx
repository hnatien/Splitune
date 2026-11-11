import type * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §4.7, §12.2, §13, 27 §3.7.4: confirms a key or pedal action within 100 ms as a toast-style
// chip at the top right of the notation — "{source} · {action}" ("Key , · Speed 70 %", "Pedal ·
// From the top of the loop") — for 1.2 s, with a polite announcement. Each press pops it in again.
// Focus never moves and the chip ignores the pointer, except when it carries an action ("Pedal
// detected? Set it up"): then it stays a little longer and its link can be clicked; keyboard users
// reach the same place from the top bar's Keyboard & pedal button, so the link isn't a tab stop.

export const PEDAL_HUD_MS = 1200
const ACTION_HUD_MS = 5000

type PedalHudProps = {
  /** The latest action; bump `sequence` to show the same text again. */
  message: string | null
  sequence: number
  /** What pressed it ("Key ,", "Pedal"); shown before the action. */
  source?: string | undefined
  icon?: React.ReactNode
  /** A link that acts on the message ("Set it up"), rendered as the whole chip. */
  action?: ((content: React.ReactNode, className: string) => React.ReactNode) | undefined
  className?: string
}

function PedalHud({ message, sequence, source, icon, action, className }: PedalHudProps) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    if (message === null || sequence === 0) return
    setVisible(true)
    const timer = setTimeout(() => setVisible(false), action ? ACTION_HUD_MS : PEDAL_HUD_MS)
    return () => clearTimeout(timer)
  }, [message, sequence, action])

  const line = source ? `${source} · ${message}` : message
  const content = (
    <>
      {icon}
      {line}
    </>
  )
  const chip = cn(
    'flex items-center gap-3 rounded-2xl border border-border-strong bg-hud-bg px-4 py-2.5 text-md font-semibold whitespace-nowrap text-hud-fg tabular-nums shadow-2 [&_svg]:size-5',
  )
  return (
    <>
      <div role="status" aria-live="polite" className="sr-only">
        {line}
      </div>
      <div
        key={sequence}
        aria-hidden
        data-slot="pedal-hud"
        data-visible={visible || undefined}
        className={cn(
          'pointer-events-none absolute top-3 right-3 z-(--z-hud) opacity-0 transition-opacity duration-(--duration-fast) data-visible:opacity-100 motion-safe:animate-pop-in',
          action && 'data-visible:pointer-events-auto',
          className,
        )}
      >
        {action && message !== null ? (
          action(content, cn(chip, 'underline-offset-4 hover:underline'))
        ) : (
          <div className={chip}>{content}</div>
        )}
      </div>
    </>
  )
}

export { PedalHud }
