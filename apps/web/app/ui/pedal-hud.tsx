import type * as React from 'react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

// Doc 26 §4.7, §13, s47 direction §3, §7: confirms a key or pedal action within 100 ms with one
// quiet line naming the source and the action ("Key 4 · Loop bars 5–8", "Pedal ▶ · Play") on
// --raised with a hairline, for 1.2 s, with a polite announcement. Each press pops it in again.
// It sits in the flow where the screen puts it (the top bar or the status row), never over the
// notation, and keeps its box while hidden so nothing moves when it shows. Focus never moves and
// the line ignores the pointer, except when it carries an action ("Pedal detected? Set it up"):
// then it stays a little longer and its link can be clicked; keyboard users reach the same place
// from the top bar's Keyboard & pedal button, so the link isn't a tab stop.

export const PEDAL_HUD_MS = 1200
const ACTION_HUD_MS = 5000

type PedalHudProps = {
  /** The latest action; bump `sequence` to show the same text again. */
  message: string | null
  sequence: number
  /** What pressed it ("Key 4", "Pedal ▶"); shown before the action. */
  source?: string | undefined
  icon?: React.ReactNode
  /** A link that acts on the message ("Set it up"), rendered as the whole line. */
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
      {source && (
        <>
          <span className="text-muted-foreground">{source}</span>
          <span aria-hidden className="text-faint-foreground">
            ·
          </span>
        </>
      )}
      <span className="truncate">{message}</span>
    </>
  )
  const chip =
    'flex h-8 max-w-full min-w-0 items-center gap-1.5 rounded-full bg-hud-bg px-3 text-label-sm whitespace-nowrap text-hud-fg tabular-nums inset-ring inset-ring-border [&_svg]:size-4 [&_svg]:shrink-0 [&_.lucide]:stroke-[1.8]'
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
          'pointer-events-none inline-flex h-8 min-w-0 opacity-0 transition-opacity duration-(--duration-fast) ease-exit data-visible:opacity-100 motion-safe:data-visible:animate-pop-in',
          action && 'data-visible:pointer-events-auto',
          className,
        )}
      >
        {message !== null &&
          (action ? (
            action(content, cn(chip, 'underline-offset-4 hover:underline'))
          ) : (
            <div className={chip}>{content}</div>
          ))}
      </div>
    </>
  )
}

export { PedalHud }
