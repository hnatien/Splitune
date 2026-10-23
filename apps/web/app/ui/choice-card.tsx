import type * as React from 'react'
import { cn } from '@/lib/utils'

// Big tap-to-choose cards (27 §3.3: onboarding's instrument and level): an icon, a title and one
// line. Choosing acts at once, so these are buttons, not radios. Unavailable choices stay
// focusable and say why in their description (26 §12.3 disabled state).

type ChoiceCardProps = Omit<React.ComponentProps<'button'>, 'title'> & {
  icon?: React.ReactNode
  title: string
  description?: string | undefined
  unavailable?: boolean
}

function ChoiceCard({
  icon,
  title,
  description,
  unavailable = false,
  className,
  onClick,
  ...props
}: ChoiceCardProps) {
  return (
    <button
      type="button"
      data-slot="choice-card"
      aria-disabled={unavailable || undefined}
      onClick={unavailable ? undefined : onClick}
      className={cn(
        'flex min-h-target-practice w-full items-center gap-4 rounded-2xl border border-transparent bg-surface-raised p-4 text-left shadow-1 transition-shadow hover:shadow-2 contrast-more:border-input aria-disabled:cursor-not-allowed aria-disabled:border-input aria-disabled:bg-surface-sunken aria-disabled:shadow-none aria-disabled:hover:shadow-none [&_svg]:size-8 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden className="text-primary in-aria-disabled:text-muted-foreground">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-lg font-semibold">{title}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </span>
    </button>
  )
}

export { ChoiceCard }
