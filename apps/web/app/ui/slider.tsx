import { Slider as SliderPrimitive } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

/**
 * `.range` (doc 26 §12.1): horizontal, vertical (faders) and range (loop A/B) on Base UI Slider.
 * Always paired with a NumberField or steppers (WCAG 2.5.7). A 6 px --accent track with an --input
 * edge and a --signal fill; each thumb is a control-size box (44 browse, 48 practice: the target,
 * §8) painting a 20 px --signal knob. Page Up/Down move by `largeStep` (10).
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
          className="relative grow rounded-full bg-accent inset-ring inset-ring-input select-none data-horizontal:h-1.5 data-horizontal:w-full data-vertical:h-full data-vertical:w-1.5"
        >
          <SliderPrimitive.Indicator
            data-slot="slider-range"
            className="rounded-full bg-signal select-none data-horizontal:h-full data-vertical:w-full data-disabled:bg-input"
          />
        </SliderPrimitive.Track>
        {values.map((_, index) => (
          <SliderPrimitive.Thumb
            data-slot="slider-thumb"
            // Thumbs are positional; their order never changes.
            // biome-ignore lint/suspicious/noArrayIndexKey: one thumb per value index
            key={index}
            aria-label={thumbLabels[index] ?? thumbLabels[0]}
            className="block size-control shrink-0 rounded-full border-[calc((var(--control-size)-1.25rem)/2)] border-transparent bg-signal bg-clip-padding select-none focus-visible:outline-offset-[calc(2px-(var(--control-size)-1.25rem)/2)] data-disabled:bg-faint-foreground data-dragging:scale-110"
          />
        ))}
      </SliderPrimitive.Control>
    </SliderPrimitive.Root>
  )
}

export { Slider }
