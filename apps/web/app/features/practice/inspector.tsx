import { lazy, Suspense } from 'react'
import { m } from '@/lib/i18n'
import { Badge } from '@/ui/badge'
import { Drawer, DrawerContent, DrawerTitle } from '@/ui/drawer'
import { Skeleton } from '@/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { unsureSpots } from './model/view-model'
import { usePractice } from './practice-context'
import { INSPECTOR_TABS, type InspectorTab, openTab, usePracticeUi } from './practice-store'

// Each tab's body loads when the tab is first shown (12 §10, D6).
const LoopTab = lazy(() => import('./loop-tab').then((module) => ({ default: module.LoopTab })))
const MixTab = lazy(() => import('./mix-tab').then((module) => ({ default: module.MixTab })))
const ProgressTab = lazy(() =>
  import('./progress-tab').then((module) => ({ default: module.ProgressTab })),
)
const FixTab = lazy(() => import('./fix-tab').then((module) => ({ default: module.FixTab })))

// The inspector (27 §3.7.1, §3.7.4, 26 §12.2 InspectorTabs): tabs Loop · Mix · Progress · Fix, the
// Fix tab carrying the unsure count, 380 px at every tab (V14). Docked from 1180 px; below that a
// right drawer opened by "Tools" (and by the loop and mix pills), which never covers the dock.
// The tab is remembered per device and `?tab=` opens one. The whole inspector loads with the
// screen, outside the route's JS budget.

const LABEL: Record<InspectorTab, () => string> = {
  loop: () => m['practice.tab_loop'](),
  mix: () => m['practice.tab_mix'](),
  progress: () => m['practice.tab_progress'](),
  fix: () => m['practice.tab_fix'](),
}

function InspectorTabs() {
  const tab = usePracticeUi((s) => s.tab)
  const { view } = usePractice()
  const unsure = unsureSpots(view).count
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => openTab(next as InspectorTab)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <TabsList className="shrink-0 px-3">
        {INSPECTOR_TABS.map((value) => (
          <TabsTrigger key={value} value={value} className="min-h-target-practice-2 font-semibold">
            {LABEL[value]()}
            {value === 'fix' && unsure > 0 && (
              <Badge
                variant="unsure"
                aria-label={m['practice.fix_unsure_count']({ count: String(unsure) })}
              >
                {unsure > 99 ? '99+' : unsure}
              </Badge>
            )}
          </TabsTrigger>
        ))}
      </TabsList>
      <TabsContent
        value={tab}
        data-slot="inspector-body"
        className="flex min-h-0 flex-1 flex-col gap-4.5 overflow-y-auto p-4.5"
      >
        <Suspense fallback={<BodySkeleton />}>
          {tab === 'loop' && <LoopTab />}
          {tab === 'mix' && <MixTab />}
          {tab === 'progress' && <ProgressTab />}
          {tab === 'fix' && <FixTab />}
        </Suspense>
      </TabsContent>
    </Tabs>
  )
}

function BodySkeleton() {
  return (
    <div aria-hidden className="flex flex-col gap-3">
      <Skeleton className="h-7 w-40" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function Inspector({ docked }: { docked: boolean }) {
  const open = usePracticeUi((s) => s.inspectorOpen)
  if (docked) {
    return (
      <aside
        aria-label={m['practice.tools_label']()}
        data-slot="inspector"
        className="flex w-95 shrink-0 flex-col border-l border-border bg-card"
      >
        <InspectorTabs />
      </aside>
    )
  }
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => usePracticeUi.setState({ inspectorOpen: next })}
      swipeDirection="right"
      modal={false}
    >
      <DrawerContent
        data-slot="inspector"
        // Between the top bar and the dock: the drawer never covers the transport (2.4.11).
        className="data-[swipe-axis=x]:top-15! data-[swipe-axis=x]:bottom-24! data-[swipe-axis=x]:[--drawer-content-width:23.75rem]"
      >
        <DrawerTitle className="sr-only">{m['practice.tools_label']()}</DrawerTitle>
        <InspectorTabs />
      </DrawerContent>
    </Drawer>
  )
}
