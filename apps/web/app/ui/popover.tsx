import { Popover as PopoverPrimitive } from '@base-ui/react/popover'

// Root and trigger only: the positioned parts are in popover-content.tsx, so a page whose popover
// contents load on demand doesn't load the positioning code with its triggers.

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />
}

export { Popover, PopoverTrigger }
