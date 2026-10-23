import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { toggleVariants } from '@/ui/toggle'

type GroupStyle = VariantProps<typeof toggleVariants> & { orientation?: 'horizontal' | 'vertical' }

const ToggleGroupContext = React.createContext<GroupStyle>({
  size: 'md',
  variant: 'outline',
  orientation: 'horizontal',
})

/**
 * Segmented set of toggles (view Tab/Chords, mix presets, count-in): a sunken track with the pressed
 * item raised and edged in indigo. `variant` is kept for API compatibility; the track styles every item.
 */
function ToggleGroup({
  className,
  variant,
  size,
  orientation = 'horizontal',
  children,
  ...props
}: ToggleGroupPrimitive.Props & GroupStyle) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      data-variant={variant}
      data-size={size}
      orientation={orientation}
      className={cn(
        'group/toggle-group flex w-fit flex-row items-center gap-1 rounded-full bg-surface-sunken p-1 data-vertical:flex-col data-vertical:items-stretch data-vertical:rounded-2xl',
        className,
      )}
      {...props}
    >
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
        'shrink-0 rounded-full border-transparent bg-transparent hover:bg-surface-raised/50 focus-visible:z-10 data-pressed:border-primary data-pressed:bg-surface-raised data-pressed:font-semibold data-pressed:text-foreground data-pressed:shadow-1',
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
