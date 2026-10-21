import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

/**
 * Base UI NumberField with ≥44 px steppers and tabular figures (doc 26 §12.1). The unit sits
 * outside the input ("70 %") and is announced through aria-describedby.
 */
function NumberField({
  className,
  unit,
  decrementLabel,
  incrementLabel,
  inputLabel,
  ...props
}: NumberFieldPrimitive.Root.Props & {
  unit?: string
  decrementLabel: string
  incrementLabel: string
  /** Accessible name when no visible <Label htmlFor> points at the input. */
  inputLabel?: string
}) {
  const unitId = useId()
  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <NumberFieldPrimitive.Group className="flex items-stretch overflow-hidden rounded-lg border border-input bg-card">
          <NumberFieldPrimitive.Decrement
            aria-label={decrementLabel}
            className="grid size-control place-items-center border-r border-input text-foreground hover:bg-muted data-disabled:text-muted-foreground [&_svg]:size-5"
          >
            <MinusIcon aria-hidden />
          </NumberFieldPrimitive.Decrement>
          <NumberFieldPrimitive.Input
            aria-label={inputLabel}
            aria-describedby={unit ? unitId : undefined}
            className="w-16 bg-transparent text-center text-base font-medium tabular-nums focus-visible:-outline-offset-2"
          />
          <NumberFieldPrimitive.Increment
            aria-label={incrementLabel}
            className="grid size-control place-items-center border-l border-input text-foreground hover:bg-muted data-disabled:text-muted-foreground [&_svg]:size-5"
          >
            <PlusIcon aria-hidden />
          </NumberFieldPrimitive.Increment>
        </NumberFieldPrimitive.Group>
        {unit && (
          <span id={unitId} className="text-base text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </NumberFieldPrimitive.Root>
  )
}

export { NumberField }
