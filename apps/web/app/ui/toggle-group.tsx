import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { toggleVariants } from '@/ui/toggle'

type GroupStyle = VariantProps<typeof toggleVariants> & { orientation?: 'horizontal' | 'vertical' }

type CapsuleBox = {
  x: number
  y: number
  width: number
  height: number
  slide: boolean
}

/**
 * Tracks the box of the one pressed item inside `group` (offsets ignore transforms, so a view
 * transition or a scaled ancestor never skews it). Measured after every commit, on resize, when items come and go and
 * when an uncontrolled group presses another item. `null` while there is no single visible
 * pressed item.
 */
function usePressedBox(group: React.RefObject<HTMLDivElement | null>) {
  const [box, setBox] = React.useState<CapsuleBox | null>(null)
  const measure = React.useCallback(() => {
    const root = group.current
    const pressed = root?.querySelectorAll<HTMLElement>(
      '[data-slot="toggle-group-item"][data-pressed]',
    )
    const item = pressed?.length === 1 ? pressed[0] : undefined
    setBox((previous) => {
      if (!item || item.offsetWidth === 0) return null
      const next = {
        x: item.offsetLeft,
        y: item.offsetTop,
        width: item.offsetWidth,
        height: item.offsetHeight,
      }
      if (
        previous?.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height
      )
        return previous
      // Appearing (first paint, the group shown again) places the capsule; only a move slides.
      return { ...next, slide: previous !== null }
    })
  }, [group])

  React.useLayoutEffect(measure)

  React.useEffect(() => {
    const root = group.current
    if (!root) return
    const resize = new ResizeObserver(measure)
    // Observing is idempotent, so items added later (a view that gains an option) are picked up too.
    const observeItems = () => {
      resize.observe(root)
      for (const item of root.querySelectorAll('[data-slot="toggle-group-item"]'))
        resize.observe(item)
    }
    observeItems()
    const changes = new MutationObserver(() => {
      observeItems()
      measure()
    })
    changes.observe(root, { attributeFilter: ['data-pressed'], subtree: true, childList: true })
    return () => {
      resize.disconnect()
      changes.disconnect()
    }
  }, [group, measure])

  return box
}

const ToggleGroupContext = React.createContext<GroupStyle>({
  size: 'md',
  variant: 'outline',
  orientation: 'horizontal',
})

/**
 * `.seg` (doc 26 §12.1): a --card track with a --border edge and 3 px padding, painted 42 px tall
 * behind items whose boxes are the target (44 browse, 48 practice) and whose faces are 34. The
 * pressed item is a raised --accent capsule with --foreground text (the capsule is the non-colour
 * cue). `variant` is kept for API compatibility; the track styles every item.
 *
 * The capsule is one element behind the items that slides (and resizes) to the pressed one on
 * --ease-snappy (26 §10), like a segmented Picker's selection. It takes the item's whole box and,
 * like the item, paints only the 34 px face inside a transparent pad. With no single pressed item
 * (none chosen, several, or before hydration) items show their own pressed style.
 * `capsuleClassName` recolours the capsule for groups whose items use another palette.
 */
function ToggleGroup({
  className,
  variant,
  size,
  orientation = 'horizontal',
  capsuleClassName,
  children,
  ...props
}: ToggleGroupPrimitive.Props & GroupStyle & { capsuleClassName?: string }) {
  const group = React.useRef<HTMLDivElement>(null)
  const box = usePressedBox(group)
  return (
    <ToggleGroupPrimitive
      ref={group}
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      data-capsule={box ? '' : undefined}
      orientation={orientation}
      className={cn(
        'group/toggle-group relative isolate flex w-fit flex-row items-center gap-0.5 px-0.75 py-px [--box:var(--control-size)] before:absolute before:inset-x-0 before:inset-y-[calc((var(--box)-2.5rem)/2)] before:-z-10 before:rounded-xl before:border before:border-border before:bg-card data-[size=practice-2]:[--box:var(--target-practice-2)] data-[size=practice]:[--box:var(--target-practice)] data-vertical:flex-col data-vertical:items-stretch data-vertical:py-0.75 data-vertical:before:inset-y-0',
        className,
      )}
      {...props}
    >
      {box && (
        <span
          aria-hidden
          data-slot="toggle-group-capsule"
          className={cn(
            'pointer-events-none absolute top-0 left-0 rounded-[var(--radius-lg)/calc(var(--radius-lg)+var(--pad))] border-y-(length:--pad) border-transparent bg-accent bg-clip-padding shadow-1 [--pad:calc((var(--box)-2.125rem)/2)] forced-colors:bg-card forced-colors:inset-ring forced-colors:inset-ring-signal',
            box.slide &&
              'transition-[translate,width,height] duration-(--duration-slower) ease-snappy',
            capsuleClassName,
          )}
          style={{
            translate: `${box.x}px ${box.y}px`,
            width: box.width,
            height: box.height,
          }}
        />
      )}
      <ToggleGroupContext.Provider value={{ variant, size, orientation }}>
        {children}
      </ToggleGroupContext.Provider>
    </ToggleGroupPrimitive>
  )
}

function ToggleGroupItem({
  className,
  children,
  variant,
  size,
  ...props
}: TogglePrimitive.Props & VariantProps<typeof toggleVariants>) {
  const context = React.useContext(ToggleGroupContext)
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        toggleVariants({ variant: context.variant ?? variant, size: context.size ?? size }),
        'relative rounded-[var(--radius-lg)/calc(var(--radius-lg)+var(--pad))] border-x-0 px-3.5 text-md font-semibold inset-ring-0 [--face:2.125rem] focus-visible:z-10 data-pressed:bg-accent data-pressed:text-foreground data-pressed:inset-ring-0 group-data-capsule/toggle-group:data-pressed:bg-transparent',
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
