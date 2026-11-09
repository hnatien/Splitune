import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

function Tabs({ className, orientation = 'horizontal', ...props }: TabsPrimitive.Root.Props) {
  return (
    <TabsPrimitive.Root
      data-slot="tabs"
      data-orientation={orientation}
      orientation={orientation}
      className={cn('group/tabs flex gap-4 data-horizontal:flex-col', className)}
      {...props}
    />
  )
}

/**
 * `.tabs` (doc 26 §12.1): a --border rule under tabs whose boxes are the target (44 browse, 48 in
 * the practice inspector); the selected tab is --foreground with a 2 px --signal underline (the
 * shape cue), the others --muted-foreground.
 */
function TabsList({ className, ...props }: TabsPrimitive.List.Props) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      className={cn(
        'group/tabs-list relative flex items-stretch gap-1 border-b border-border text-muted-foreground group-data-vertical/tabs:flex-col group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l',
        className,
      )}
      {...props}
    />
  )
}

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "-mb-px inline-flex min-h-control items-center justify-center gap-2 border-b-2 border-transparent px-3.5 text-md whitespace-nowrap transition-colors group-data-vertical/tabs:-ml-px group-data-vertical/tabs:mb-0 group-data-vertical/tabs:justify-start group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l-2 hover:text-foreground focus-visible:-outline-offset-2 data-active:border-signal data-active:text-foreground disabled:pointer-events-none disabled:text-faint-foreground aria-disabled:pointer-events-none aria-disabled:text-faint-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
        className,
      )}
      {...props}
    />
  )
}

function TabsContent({ className, ...props }: TabsPrimitive.Panel.Props) {
  return (
    <TabsPrimitive.Panel
      data-slot="tabs-content"
      className={cn('flex-1 text-base', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
