import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import { ToggleGroup as ToggleGroupPrimitive } from '@base-ui/react/toggle-group'
import type { VariantProps } from 'class-variance-authority'
import * as React from 'react'
import { cn } from '@/lib/utils'
import { toggleVariants } from '@/ui/toggle'

type GroupStyle = VariantProps<typeof toggleVariants> & { orientation?: 'horizontal' | 'vertical' }

const ToggleGroupContext = React.createContext<GroupStyle>({
  size: 'md',
  variant: 'default',
  orientation: 'horizontal',
})

/**
 * A row of choices (doc 26 §12.1): pills side by side with no track behind them. The chosen one
 * carries the 1.5 px ink edge and ink text; the others are muted text that darkens on hover. The
 * edge is the cue (≥ 3:1 against every surface), so nothing slides and no surface changes.
 */
function ToggleGroup({
  className,
  variant = 'default',
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
        'group/toggle-group flex w-fit items-center gap-0.5 data-[orientation=vertical]:flex-col data-[orientation=vertical]:items-stretch',
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
        'focus-visible:z-10',
        className,
      )}
      {...props}
    >
      {children}
    </TogglePrimitive>
  )
}

export { ToggleGroup, ToggleGroupItem }
