import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import type * as React from 'react'
import { cn } from '@/lib/utils'

// Choice cards (27 §3.6 Full / Lite): a radio with a title, one line of description and optional
// meta (the allowance). Selected = indigo border + filled radio, never colour alone.

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
        'flex cursor-pointer gap-3 rounded-xl border border-input bg-card p-4 has-data-checked:border-2 has-data-checked:border-primary has-data-checked:bg-accent has-data-disabled:cursor-not-allowed has-data-disabled:bg-muted',
        className,
      )}
    >
      <RadioPrimitive.Root
        className="group/radio relative mt-0.5 flex size-5 shrink-0 rounded-full border border-input bg-card data-checked:border-2 data-checked:border-primary"
        {...props}
      >
        <RadioPrimitive.Indicator className="flex size-full items-center justify-center">
          <span className="size-2.5 rounded-full bg-primary" />
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
