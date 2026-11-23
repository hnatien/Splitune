import { cn } from '@/lib/utils'

// Onboarding progress (27 §3.3, 26 §12.2): 8 px dots, the current one a 22 × 8 pill; done and
// current filled with the ink, upcoming with --edge (≥ 3:1); plus the "Step 2 of 5" text, so
// progress never relies on the dots (colour and shape) alone. Nothing animates but the colour.

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
      <ol aria-label={label} className="flex items-center gap-1.5">
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1
          return (
            <li
              key={n}
              aria-current={n === step ? 'step' : undefined}
              className={cn(
                'size-2 rounded-full bg-edge transition-colors duration-(--duration-base) ease-standard forced-colors:border forced-colors:border-current',
                n <= step && 'bg-foreground',
                n === step && 'w-5.5',
              )}
            >
              <span className="sr-only">{n}</span>
            </li>
          )
        })}
      </ol>
      <span className="text-body-sm text-faint-foreground tabular-nums">{text}</span>
    </div>
  )
}

export { StepDots }
