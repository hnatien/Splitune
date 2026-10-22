import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'

/**
 * Doc 26 §12.1: tooltips name the action and show its keyboard shortcut. They supplement a visible
 * label or `aria-label`; never put the only name of a control in a tooltip.
 */
export function TooltipContent({
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
            'inline-flex w-fit max-w-xs origin-(--transform-origin) items-center gap-2 rounded-md bg-foreground px-3 py-1.5 text-sm text-background duration-(--duration-base) data-[instant]:duration-0 data-open:animate-in data-open:ease-enter data-open:fade-in-0 data-closed:animate-out data-closed:ease-exit data-closed:fade-out-0',
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
