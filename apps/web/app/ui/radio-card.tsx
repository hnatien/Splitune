import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckDrawIcon } from '@/ui/icons/check-draw'

// Choice cards (27 §3.6 Full / Lite, onboarding's distances): a radio with a title, one line of
// description and optional meta (the allowance), on a hairline edge. Selected = the quiet ink wash,
// a 2 px ink edge and a check badge, never colour alone; forced colours drop the inset ring, so
// the edge is repeated as an outline.

function RadioCardGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-card-group"
      className={cn('grid gap-3 sm:grid-cols-2', className)}
      {...props}
    />
  )
}

type RadioCardProps = RadioPrimitive.Root.Props & {
  title: string
  description: string
  meta?: React.ReactNode
  /** A picture above the choice (onboarding's distance drawings); decorative. */
  media?: React.ReactNode
}

function RadioCard({ title, description, meta, media, className, ...props }: RadioCardProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI's Radio renders the control inside
    <label
      data-slot="radio-card"
      className={cn(
        'flex cursor-pointer flex-col gap-3.5 rounded-field border border-border bg-background p-4 transition-colors duration-(--duration-base) ease-standard hover:border-border-strong hover:bg-panel contrast-more:border-edge has-data-checked:border-foreground has-data-checked:bg-wash has-data-checked:inset-ring has-data-checked:inset-ring-foreground forced-colors:has-data-checked:outline-2 forced-colors:has-data-checked:outline-foreground forced-colors:has-data-checked:outline-solid has-data-disabled:cursor-not-allowed has-data-disabled:border-transparent has-data-disabled:bg-panel',
        className,
      )}
    >
      {media && (
        <span aria-hidden className="w-full">
          {media}
        </span>
      )}
      <span className="flex min-w-0 gap-3">
        <RadioPrimitive.Root
          className="group/radio relative mt-0.5 flex size-5 shrink-0 rounded-full border border-edge bg-background data-checked:border-2 data-checked:border-primary"
          {...props}
        >
          <RadioPrimitive.Indicator className="flex size-full animate-pop-in items-center justify-center rounded-full bg-primary text-primary-foreground">
            <CheckDrawIcon strokeWidth={3} className="size-3.5" />
          </RadioPrimitive.Indicator>
        </RadioPrimitive.Root>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="text-body font-medium">{title}</span>
          <span className="text-body-sm text-muted-foreground">{description}</span>
          {meta && <span className="text-body-sm text-foreground">{meta}</span>}
        </span>
      </span>
    </label>
  )
}

export { RadioCard, RadioCardGroup }
