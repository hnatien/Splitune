import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsLook = 'line' | 'pill'

const TabsLookContext = React.createContext<TabsLook>('line')

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
 * `.tabs` (doc 26 §12.1), two looks with one rule: the selected tab is marked by the ink.
 *
 * `line` (sections of a page or of the panel): a --border rule under tabs whose boxes are the
 * target; the selected tab is --foreground with a 2 px ink underline, the others muted.
 *
 * `pill` (views of one thing: Tab · Chords, File · Link · Record): compact rounded tabs that sit
 * side by side and never span the width; the selected tab carries the 1.5 px ink edge.
 */
function TabsList({
  className,
  look = 'line',
  children,
  ...props
}: TabsPrimitive.List.Props & { look?: TabsLook }) {
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-look={look}
      className={cn(
        look === 'pill'
          ? 'group/tabs-list flex w-fit items-center gap-0.5 text-muted-foreground'
          : 'group/tabs-list relative flex items-stretch gap-1 border-b border-border text-muted-foreground group-data-vertical/tabs:flex-col group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l',
        className,
      )}
      {...props}
    >
      <TabsLookContext.Provider value={look}>{children}</TabsLookContext.Provider>
    </TabsPrimitive.List>
  )
}

const TRIGGER = {
  line: '-mb-px min-h-control min-w-control border-b-2 border-transparent px-3 text-label group-data-vertical/tabs:-ml-px group-data-vertical/tabs:mb-0 group-data-vertical/tabs:justify-start group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l-2 data-active:border-selected',
  pill: 'min-h-(--box) rounded-full border-(length:--pad) border-transparent bg-clip-padding px-3.5 text-label inset-ring inset-ring-transparent [--box:var(--control-size)] [--face:2.25rem] [--pad:calc((var(--box)-var(--face))/2)] not-data-active:hover:bg-hover focus-visible:outline-offset-[calc(2px-var(--pad))] data-active:inset-ring-[1.5px] data-active:inset-ring-selected',
} as const

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const look = React.useContext(TabsLookContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors duration-(--duration-fast) hover:text-foreground focus-visible:-outline-offset-2 data-active:text-foreground disabled:pointer-events-none disabled:text-faint-foreground aria-disabled:pointer-events-none aria-disabled:text-faint-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
        TRIGGER[look],
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
      className={cn('flex-1 text-body', className)}
      {...props}
    />
  )
}

export { Tabs, TabsContent, TabsList, TabsTrigger }
