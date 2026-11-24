import { Radio as RadioPrimitive } from '@base-ui/react/radio'
import { RadioGroup as RadioGroupPrimitive } from '@base-ui/react/radio-group'
import { CheckIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'

/**
 * ChoiceRowGroup and ChoiceRow (doc 26 §12.1): one of several, as rows. Onboarding's instrument
 * and level, Full or Lite analysis, the reading distance, the mix presets. Each row is a radio:
 * an optional icon, a label, an optional line under it and a trailing slot. The chosen row has
 * the 1.5 px ink edge and a check; the others a hairline edge that darkens on hover. `size="sm"`
 * is the list form (mix presets in the panel): no edge at rest, a check when chosen.
 */
function ChoiceRowGroup({ className, ...props }: RadioGroupPrimitive.Props) {
  return (
    <RadioGroupPrimitive
      data-slot="choice-row-group"
      className={cn('grid w-full gap-2', className)}
      {...props}
    />
  )
}

function ChoiceRow({
  icon,
  label,
  description,
  trailing,
  size = 'md',
  className,
  ...props
}: Omit<RadioPrimitive.Root.Props, 'children'> & {
  icon?: React.ReactNode
  label: React.ReactNode
  description?: React.ReactNode
  trailing?: React.ReactNode
  size?: 'sm' | 'md'
}) {
  return (
    <RadioPrimitive.Root
      data-slot="choice-row"
      data-size={size}
      className={cn(
        'group/choice-row flex w-full cursor-pointer items-center gap-3 text-left inset-ring transition-[background-color,box-shadow] duration-(--duration-fast) ease-standard hover:bg-hover data-checked:inset-ring-[1.5px] data-checked:inset-ring-selected data-disabled:cursor-not-allowed data-disabled:text-faint-foreground data-disabled:hover:bg-transparent [&_svg]:shrink-0',
        size === 'md'
          ? 'min-h-14 rounded-field px-4 py-2.5 inset-ring-border-strong hover:inset-ring-edge'
          : 'min-h-control rounded-field px-3 py-1.5 inset-ring-transparent',
        className,
      )}
      {...props}
    >
      {icon && (
        <span className="text-muted-foreground group-data-checked/choice-row:text-foreground [&_svg:not([class*='size-'])]:size-5">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label">{label}</span>
        {description && (
          <span className="text-body-sm text-muted-foreground group-data-disabled/choice-row:text-faint-foreground">
            {description}
          </span>
        )}
      </span>
      {trailing}
      <span className="grid size-5 shrink-0 place-items-center">
        <RadioPrimitive.Indicator data-slot="choice-row-indicator">
          <CheckIcon aria-hidden className="size-4 stroke-2" />
        </RadioPrimitive.Indicator>
      </span>
    </RadioPrimitive.Root>
  )
}

export { ChoiceRow, ChoiceRowGroup }
