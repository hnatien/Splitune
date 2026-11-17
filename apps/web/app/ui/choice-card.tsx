import type * as React from 'react'
import { cn } from '@/lib/utils'

// Big tap-to-choose rows (27 §3.3: onboarding's instrument and level): an icon, a title and one
// line on the page, with a hairline edge that fills on hover. Choosing acts at once, so these are
// buttons, not radios. Unavailable choices stay focusable, sit on the quiet fill and say why in
// their description (26 §12.3 disabled state).

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
        'flex min-h-target-practice w-full items-center gap-4 rounded-xl border border-border bg-background px-5 py-4 text-left transition-colors duration-(--duration-base) ease-standard hover:border-border-strong hover:bg-muted contrast-more:border-input aria-disabled:cursor-not-allowed aria-disabled:border-transparent aria-disabled:bg-muted aria-disabled:hover:border-transparent [&_svg]:size-6 [&_svg]:shrink-0',
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden className="text-muted-foreground in-aria-disabled:text-faint-foreground">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-lg in-aria-disabled:text-muted-foreground">{title}</span>
        {description && <span className="text-sm text-muted-foreground">{description}</span>}
      </span>
    </button>
  )
}

export { ChoiceCard }
