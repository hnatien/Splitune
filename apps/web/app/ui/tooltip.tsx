import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'

function TooltipProvider({ delay = 400, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * Doc 26 §12.1: tooltips name the action and show its keyboard shortcut. They supplement a visible
 * label or `aria-label`; never put the only name of a control in a tooltip.
 */
function TooltipContent({
  className,
  side = 'top',
  sideOffset = 8,
  align = 'center',
  alignOffset = 0,
  shortcut,
  children,
  ...props
}: TooltipPrimitive.Popup.Props &
  Pick<TooltipPrimitive.Positioner.Props, 'align' | 'alignOffset' | 'side' | 'sideOffset'> & {
    /** Key or keys for the action, e.g. "Space" or ["⇧", "←"]. */
    shortcut?: string | string[] | undefined
  }) {
  const keys = shortcut === undefined ? [] : Array.isArray(shortcut) ? shortcut : [shortcut]
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Positioner
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
        className="isolate z-(--z-popover)"
      >
        <TooltipPrimitive.Popup
          data-slot="tooltip-content"
          className={cn(
            'inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background duration-(--duration-base) data-[instant]:duration-0 data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0',
            className,
          )}
          {...props}
        >
          {children}
          {keys.length > 0 && (
            <span className="inline-flex items-center gap-1">
              {keys.map((key) => (
                <Kbd key={key}>{key}</Kbd>
              ))}
            </span>
          )}
        </TooltipPrimitive.Popup>
      </TooltipPrimitive.Positioner>
    </TooltipPrimitive.Portal>
  )
}

/** A trigger with a tooltip, for the common case of an icon button that needs a hint. */
function WithTooltip({
  label,
  shortcut,
  side,
  children,
}: {
  label: React.ReactNode
  shortcut?: string | string[] | undefined
  side?: TooltipPrimitive.Positioner.Props['side']
  children: React.ReactElement
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side} shortcut={shortcut}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger, WithTooltip }
