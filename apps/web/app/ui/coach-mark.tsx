import { LightbulbIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// A coach mark (27 §3.3): one short tip next to what it explains, dismissible, never modal and
// never over the transport (onboarding shows at most two). Announced politely when it appears.
// A floating popover: hairline edge, the one shadow floating layers get, a muted bulb (26 §12.2).

function CoachMark({
  children,
  dismissLabel,
  onDismiss,
  className,
}: {
  children: React.ReactNode
  /** "Got it". */
  dismissLabel: string
  onDismiss: () => void
  className?: string
}) {
  return (
    <div
      data-slot="coach-mark"
      role="status"
      className={cn(
        'flex max-w-md animate-pop-in items-center gap-3 rounded-2xl border border-border bg-popover py-2 pr-2 pl-4 text-popover-foreground shadow-2',
        className,
      )}
    >
      <LightbulbIcon
        aria-hidden
        strokeWidth={1.8}
        className="size-5 shrink-0 text-muted-foreground"
      />
      <p className="min-w-0 flex-1 py-2 text-base">{children}</p>
      <Button size="sm" variant="secondary" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  )
}

export { CoachMark }
