import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { CheckDrawIcon } from '@/ui/icons/check-draw'

// Choice cards (27 §3.6 Full / Lite): a radio with a title, one line of description and optional
// meta (the allowance). Selected = 2 px indigo ring + a check badge, never colour alone; forced
// colours drop shadows, so the ring is repeated as an outline.

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
}

function RadioCard({ title, description, meta, className, ...props }: RadioCardProps) {
  return (
    // biome-ignore lint/a11y/noLabelWithoutControl: Base UI's Radio renders the control inside
    <label
      data-slot="radio-card"
      className={cn(
        'flex cursor-pointer gap-3 rounded-2xl border border-transparent bg-surface-raised p-4 shadow-1 transition-shadow hover:shadow-2 contrast-more:border-input has-data-checked:ring-2 has-data-checked:ring-primary forced-colors:has-data-checked:outline-2 forced-colors:has-data-checked:outline-primary forced-colors:has-data-checked:outline-solid has-data-disabled:cursor-not-allowed has-data-disabled:bg-surface-sunken has-data-disabled:shadow-none',
        className,
      )}
    >
      <RadioPrimitive.Root
        className="group/radio relative mt-0.5 flex size-5 shrink-0 rounded-full border border-input bg-card data-checked:border-2 data-checked:border-primary"
        {...props}
      >
        <RadioPrimitive.Indicator className="flex size-full animate-pop-in items-center justify-center rounded-full bg-primary text-primary-foreground">
          <CheckDrawIcon strokeWidth={3} className="size-3.5" />
        </RadioPrimitive.Indicator>
      </RadioPrimitive.Root>
      <span className="flex min-w-0 flex-col gap-1">
        <span className="text-base font-semibold">{title}</span>
        <span className="text-sm text-muted-foreground">{description}</span>
        {meta && <span className="text-sm text-foreground">{meta}</span>}
      </span>
    </label>
  )
}

export { RadioCard, RadioCardGroup }
