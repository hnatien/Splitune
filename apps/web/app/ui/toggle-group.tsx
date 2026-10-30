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
  radius: string
  slide: boolean
}

/**
 * Tracks the one pressed item's box and corner radius inside `group` (offsets ignore transforms, so
 * a view transition or a scaled ancestor never skews it). Measured after every commit, on resize,
 * when items come and go and when an uncontrolled group presses another item. `null` while there
 * is no single visible pressed item.
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
        radius: getComputedStyle(item).borderRadius,
      }
      if (
        previous?.x === next.x &&
        previous.y === next.y &&
        previous.width === next.width &&
        previous.height === next.height &&
        previous.radius === next.radius
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
 * Segmented set of toggles (view Tab/Chords, mix presets, count-in): a sunken track with the pressed
 * item raised and edged in indigo. `variant` is kept for API compatibility; the track styles every item.
 *
 * The raised, indigo-edged surface is one capsule behind the items that slides (and resizes) to the
 * pressed one on --ease-snappy (26 §10), like a segmented Picker's selection, taking that item's
 * corner radius. Pressed items stay bold, so the state never rests on the capsule alone; with no
 * single pressed item (none chosen, several, or before hydration) items show their own pressed
 * style. `capsuleClassName` recolours the capsule for groups whose items use another palette.
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
        'group/toggle-group relative flex w-fit flex-row items-center gap-1 rounded-full bg-surface-sunken p-1 data-vertical:flex-col data-vertical:items-stretch data-vertical:rounded-2xl',
        className,
      )}
      {...props}
    >
      {box && (
        <span
          aria-hidden
          data-slot="toggle-group-capsule"
          className={cn(
            'pointer-events-none absolute top-0 left-0 border border-primary bg-surface-raised shadow-1',
            box.slide &&
              'transition-[translate,width,height,border-radius] duration-(--duration-slower) ease-snappy',
            capsuleClassName,
          )}
          style={{
            translate: `${box.x}px ${box.y}px`,
            width: box.width,
            height: box.height,
            borderRadius: box.radius,
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
        'relative shrink-0 rounded-full border-transparent bg-transparent hover:bg-surface-raised/50 focus-visible:z-10 data-pressed:border-primary data-pressed:bg-surface-raised data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-1 group-data-capsule/toggle-group:data-pressed:border-transparent group-data-capsule/toggle-group:data-pressed:bg-transparent group-data-capsule/toggle-group:data-pressed:shadow-none',
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
