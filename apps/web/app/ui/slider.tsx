import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

/**
 * Base UI Slider (doc 26 §12.1): horizontal, vertical (faders) and range (loop A/B). Always paired
 * with a NumberField or steppers (WCAG 2.5.7). Thumbs have a control-size hit area (44 px browse,
 * 48 px practice); Page Up/Down move by `largeStep` (10).
 */
function Slider({
  className,
  defaultValue,
  value,
  min = 0,
  max = 100,
  largeStep = 10,
  thumbLabels,
  ...props
}: SliderPrimitive.Root.Props & {
  /** Accessible name per thumb, e.g. ["Loop start", "Loop end"]; one name for a single thumb. */
  thumbLabels: string[]
}) {
  const values = Array.isArray(value) ? value : Array.isArray(defaultValue) ? defaultValue : [min]

  return (
    <SliderPrimitive.Root
      className={cn('data-horizontal:w-full data-vertical:h-full', className)}
      data-slot="slider"
      defaultValue={defaultValue}
      value={value}
      min={min}
      max={max}
      largeStep={largeStep}
      thumbAlignment="edge"
      {...props}
    >
      <SliderPrimitive.Control className="relative flex min-h-control w-full touch-none items-center select-none data-vertical:h-full data-vertical:min-h-40 data-vertical:w-auto data-vertical:min-w-control data-vertical:flex-col">
        <SliderPrimitive.Track
          data-slot="slider-track"
          className="relative grow rounded-full border border-input bg-surface-sunken select-none data-horizontal:h-2 data-horizontal:w-full data-vertical:h-full data-vertical:w-2"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="rounded-full bg-primary select-none data-horizontal:h-full data-vertical:w-full data-disabled:bg-input"
          />
        </SliderPrimitive.Track>
        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // Thumbs are positional; their order never changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: one thumb per value index
            key={index}
            aria-label={thumbLabels[index] ?? thumbLabels[0]}
            className="relative block size-5 shrink-0 rounded-full border-2 border-primary bg-card select-none after:absolute after:top-1/2 after:left-1/2 after:size-control after:-translate-1/2 after:rounded-full data-disabled:border-input data-disabled:bg-muted data-dragging:scale-110"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
