import { Tooltip as TooltipPrimitive } from '@base-ui/react/tooltip'
import type * as React from 'react'
import { lazy, Suspense, useState } from 'react'

// The popup loads on the first open (the hover delay hides it): positioning code stays out of
// every route that only shows triggers (12 §10 practice route budget).
const TooltipContent = lazy(() =>
  import('./tooltip-content').then((module) => ({ default: module.TooltipContent })),
)

function TooltipProvider({ delay = 400, ...props }: TooltipPrimitive.Provider.Props) {
  return <TooltipPrimitive.Provider data-slot="tooltip-provider" delay={delay} {...props} />
}

function Tooltip(props: TooltipPrimitive.Root.Props) {
  return <TooltipPrimitive.Root data-slot="tooltip" {...props} />
}

function TooltipTrigger(props: TooltipPrimitive.Trigger.Props) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
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
  const [opened, setOpened] = useState(false)
  return (
    <Tooltip onOpenChange={(open) => open && setOpened(true)}>
      <TooltipTrigger render={children} />
      {opened && (
        <Suspense fallback={null}>
          <TooltipContent side={side} shortcut={shortcut}>
            {label}
          </TooltipContent>
        </Suspense>
      )}
    </Tooltip>
  )
}

export { Tooltip, TooltipProvider, TooltipTrigger, WithTooltip }
