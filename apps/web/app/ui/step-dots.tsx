import { cn } from '@/lib/utils'

// Onboarding progress (27 §3.3): one dot per step (the current one a 24 px pill) plus the
// "Step 2 of 5" text, so progress never relies on the dots (colour and shape) alone.

function StepDots({
  step,
  total,
  text,
  label,
  className,
}: {
  /** 1-based. */
  step: number
  total: number
  /** "Step 2 of 5". */
  text: string
  /** Accessible name of the group, e.g. "Onboarding progress". */
  label: string
  className?: string
}) {
  return (
    <div data-slot="step-dots" className={cn('flex items-center gap-3', className)}>
      <ol aria-label={label} className="flex items-center gap-2">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          return (
            <li
              key={n}
              aria-current={n === step ? 'step' : undefined}
              className={cn(
                'size-2.5 rounded-full border border-primary transition-[width] duration-(--duration-base)',
                n < step && 'bg-primary',
                n === step && 'w-6 bg-primary',
              )}
            >
              <span className="sr-only">{n}</span>
            </li>
          )
        })}
      </ol>
      <span className="text-sm text-muted-foreground tabular-nums">{text}</span>
    </div>
  )
}

export { StepDots }
