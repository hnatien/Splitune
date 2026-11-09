import { NumberField as NumberFieldPrimitive } from '@base-ui/react/number-field'
import { MinusIcon, PlusIcon } from 'lucide-react'
import { useId } from 'react'
import { cn } from '@/lib/utils'

// Each step half is a control-size box (44 browse, 48 practice: the target, §8) whose transparent
// border pads its 36 × 38 face into the 40 px well; negative margins keep the well 40 tall (V12).
const STEP =
  '-my-[calc((var(--control-size)-2.5rem)/2)] grid size-control place-items-center rounded-[calc(var(--radius-lg)+var(--pad))] border-x-(length:--pad-x) border-y-(length:--pad) border-transparent bg-clip-padding text-muted-foreground transition-colors [--pad-x:calc((var(--control-size)-2.25rem)/2)] [--pad:calc((var(--control-size)-2.375rem)/2)] hover:bg-muted hover:text-foreground focus-visible:outline-offset-[calc(-1*var(--pad-x))] data-disabled:bg-transparent data-disabled:text-faint-foreground [&_svg]:size-4 [&_.lucide]:stroke-[1.8]'

/**
 * `.stepper` (doc 26 §12.1): a 40 px --background well with an --input edge, the value in mono
 * with tabular figures between the step halves. The unit sits outside the value ("70 %") and is
 * announced through aria-describedby.
 */
function NumberField({
  className,
  unit,
  decrementLabel,
  incrementLabel,
  inputLabel,
  fill = false,
  ...props
}: NumberFieldPrimitive.Root.Props & {
  unit?: string
  decrementLabel: string
  incrementLabel: string
  /** Accessible name when no visible <Label htmlFor> points at the input. */
  inputLabel?: string
  /** Stretch the field to its container's width (the input takes the room). */
  fill?: boolean
}) {
  const unitId = useId()
  return (
    <NumberFieldPrimitive.Root
      data-slot="number-field"
      className={cn('flex flex-col gap-2', className)}
      {...props}
    >
      <div className="flex items-center gap-2">
        <NumberFieldPrimitive.Group
          className={cn(
            'flex h-10 items-stretch rounded-lg bg-background inset-ring inset-ring-input',
            fill && 'min-w-0 flex-1',
          )}
        >
          <NumberFieldPrimitive.Decrement aria-label={decrementLabel} className={STEP}>
            <MinusIcon aria-hidden />
          </NumberFieldPrimitive.Decrement>
          <NumberFieldPrimitive.Input
            aria-label={inputLabel}
            aria-describedby={unit ? unitId : undefined}
            className={cn(
              'bg-transparent text-center font-mono text-base font-semibold tabular-nums focus-visible:-outline-offset-2 disabled:text-faint-foreground',
              fill ? 'w-12 min-w-0 flex-1' : 'w-16',
            )}
          />
          <NumberFieldPrimitive.Increment aria-label={incrementLabel} className={STEP}>
            <PlusIcon aria-hidden />
          </NumberFieldPrimitive.Increment>
        </NumberFieldPrimitive.Group>
        {unit && (
          <span id={unitId} className="text-sm text-muted-foreground">
            {unit}
          </span>
        )}
      </div>
    </NumberFieldPrimitive.Root>
  )
}

export { NumberField }
