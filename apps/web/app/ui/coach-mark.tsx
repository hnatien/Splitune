import { LightbulbIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// A coach mark (27 §3.3): one short tip next to what it explains, dismissible, never modal and
// never over the transport (onboarding shows at most two). Announced politely when it appears.

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
        'flex max-w-md items-start gap-3 rounded-xl border border-primary bg-popover p-4 text-popover-foreground shadow-2',
        className,
      )}
    >
      <LightbulbIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-primary" />
      <p className="min-w-0 flex-1 text-base">{children}</p>
      <Button size="sm" variant="ghost" onClick={onDismiss}>
        {dismissLabel}
      </Button>
    </div>
  )
}

export { CoachMark }
