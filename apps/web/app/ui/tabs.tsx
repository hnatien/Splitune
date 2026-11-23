import { Tabs as TabsPrimitive } from '@base-ui/react/tabs'
import * as React from 'react'
import { cn } from '@/lib/utils'

type TabsLook = 'line' | 'segmented'

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
 * `.tabs` (doc 26 §12.1): a --border rule under tabs whose boxes are the target (44 browse, 48 in
 * the practice inspector); the selected tab is --foreground with a 2 px --signal underline (the
 * shape cue), the others --muted-foreground.
 *
 * `look="segmented"` draws the tabs as a segmented control (§12.1, like `ToggleGroup`): a quiet
 * 40 px pill track with equal items, and the selected tab on a raised capsule that slides between
 * them on --ease-standard (the capsule is the non-colour cue). For switching views of one task, such
 * as Add song's File · Link · Record.
 */
function TabsList({
  className,
  look = 'line',
  children,
  ...props
}: TabsPrimitive.List.Props & { look?: TabsLook }) {
  const segmented = look === 'segmented'
  return (
    <TabsPrimitive.List
      data-slot="tabs-list"
      data-look={look}
      className={cn(
        segmented
          ? 'group/tabs-list relative isolate flex items-center gap-0.5 px-0.75 [--box:var(--control-size)] before:absolute before:inset-x-0 before:inset-y-[calc((var(--box)-2.5rem)/2)] before:-z-10 before:rounded-full before:bg-panel contrast-more:before:border contrast-more:before:border-border-strong forced-colors:before:border forced-colors:before:border-border'
          : 'group/tabs-list relative flex items-stretch gap-1 border-b border-border text-muted-foreground group-data-vertical/tabs:flex-col group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l',
        className,
      )}
      {...props}
    >
      <TabsLookContext.Provider value={look}>{children}</TabsLookContext.Provider>
      {segmented && (
        <TabsPrimitive.Indicator
          data-slot="tabs-capsule"
          className="pointer-events-none absolute top-(--active-tab-top) left-(--active-tab-left) -z-10 h-(--active-tab-height) w-(--active-tab-width) transition-[left,width] duration-(--duration-slower) ease-standard before:absolute before:inset-x-0 before:inset-y-[calc((var(--active-tab-height)-2.125rem)/2)] before:rounded-full before:bg-raised before:shadow-raised forced-colors:before:bg-raised forced-colors:before:inset-ring forced-colors:before:inset-ring-signal"
        />
      )}
    </TabsPrimitive.List>
  )
}

const TRIGGER = {
  line: '-mb-px border-b-2 border-transparent px-3.5 text-label group-data-vertical/tabs:-ml-px group-data-vertical/tabs:mb-0 group-data-vertical/tabs:justify-start group-data-vertical/tabs:border-b-0 group-data-vertical/tabs:border-l-2 data-active:border-signal',
  segmented:
    'min-h-(--box) flex-1 rounded-full px-4 text-label font-medium text-muted-foreground forced-colors:data-active:underline',
} as const

function TabsTrigger({ className, ...props }: TabsPrimitive.Tab.Props) {
  const look = React.useContext(TabsLookContext)
  return (
    <TabsPrimitive.Tab
      data-slot="tabs-trigger"
      className={cn(
        "inline-flex min-h-control items-center justify-center gap-2 whitespace-nowrap transition-colors hover:text-foreground focus-visible:-outline-offset-2 data-active:text-foreground disabled:pointer-events-none disabled:text-faint-foreground aria-disabled:pointer-events-none aria-disabled:text-faint-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4 [&_.lucide]:stroke-[1.8]",
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
