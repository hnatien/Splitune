import { lazy, Suspense, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Drawer, DrawerContent, DrawerTitle } from '@/ui/drawer'
import { Panel, PanelHeader } from '@/ui/panel'
import { Skeleton } from '@/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/ui/tabs'
import { isPhone, type PracticeLayout } from './layout'
import { unsureSpots } from './model/view-model'
import { usePractice } from './practice-context'
import { INSPECTOR_TABS, type InspectorTab, openTab, usePracticeUi } from './practice-store'

// Each tab's body loads when the tab is first shown (12 §10, D6).
const LoopTab = lazy(() => import('./loop-tab').then((module) => ({ default: module.LoopTab })))
const MixTab = lazy(() => import('./mix-tab').then((module) => ({ default: module.MixTab })))
const MiniMixer = lazy(() =>
  import('./mini-mixer').then((module) => ({ default: module.MiniMixer })),
)
const ProgressTab = lazy(() =>
  import('./progress-tab').then((module) => ({ default: module.ProgressTab })),
)
const FixTab = lazy(() => import('./fix-tab').then((module) => ({ default: module.FixTab })))

// The tools panel (27 §3.7.1, §3.7.4, 26 §12.2): the one panel the practice screen has, with the
// tabs Loop · Mix · Progress · Fix. It is closed until asked for (Tools, X, the loop line, the
// unsure chip, `?tab=`), so the notation keeps the width. From 1180 px it docks beside the music;
// below that it is a drawer over the music's edge; on phones and upright tablets it is a sheet
// above the transport, at most 60 % of the height. It never covers the transport (2.4.11) and
// Esc closes it. The Mix tab carries a dot while the mix isn't its default (12 §7) and the Fix
// tab the number of unsure spots, both in words for assistive technology.

const LABEL: Record<InspectorTab, () => string> = {
  loop: () => m['practice.tab_loop'](),
  mix: () => m['practice.tab_mix'](),
  progress: () => m['practice.tab_progress'](),
  fix: () => m['practice.tab_fix'](),
}

const close = () => usePracticeUi.setState({ inspectorOpen: false })

/** A phone's Mix opens on the two-fader mini-mixer and grows to every stem (27 §3.7.2). */
function PhoneMix() {
  const [all, setAll] = useState(false)
  return all ? <MixTab orientation="vertical" /> : <MiniMixer onAllStems={() => setAll(true)} />
}

function InspectorTabs({ layout }: { layout: PracticeLayout }) {
  const tab = usePracticeUi((s) => s.tab)
  const { view, mixChanged } = usePractice()
  const unsure = unsureSpots(view).count
  return (
    <Tabs
      value={tab}
      onValueChange={(next) => openTab(next as InspectorTab)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <PanelHeader className="pr-1 pl-2" onClose={close} closeLabel={m['practice.close_tools']()}>
        <TabsList className="border-b-0">
          {INSPECTOR_TABS.map((value) => (
            <TabsTrigger key={value} value={value}>
              {LABEL[value]()}
              {value === 'mix' && mixChanged && (
                <span data-slot="mix-changed" className="size-1.5 rounded-full bg-foreground">
                  <span className="sr-only">{m['practice.mix_changed']()}</span>
                </span>
              )}
              {value === 'fix' && unsure > 0 && (
                <span
                  data-slot="fix-count"
                  className="text-caption text-muted-foreground tabular-nums"
                >
                  <span aria-hidden>{unsure > 99 ? '99+' : unsure}</span>
                  <span className="sr-only">
                    {m['practice.fix_unsure_count']({ count: String(unsure) })}
                  </span>
                </span>
              )}
            </TabsTrigger>
          ))}
        </TabsList>
      </PanelHeader>
      <TabsContent
        value={tab}
        data-slot="inspector-body"
        className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain border-t border-border p-4"
      >
        <Suspense fallback={<BodySkeleton />}>
          {tab === 'loop' && <LoopTab />}
          {tab === 'mix' && (layout === 'phone-portrait' ? <PhoneMix /> : <MixTab />)}
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

export function Inspector({ docked, layout }: { docked: boolean; layout: PracticeLayout }) {
  const open = usePracticeUi((s) => s.inspectorOpen)
  if (docked) {
    if (!open) return null
    return (
      <Panel
        aria-label={m['practice.tools_label']()}
        data-slot="inspector"
        onKeyDown={(event) => {
          if (event.key === 'Escape' && !event.defaultPrevented) close()
        }}
      >
        <InspectorTabs layout={layout} />
      </Panel>
    )
  }
  // A sheet from the bottom where the screen is upright, a drawer from the side where it is wide.
  const sheet = isPhone(layout) || layout === 'tablet-portrait'
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => usePracticeUi.setState({ inspectorOpen: next })}
      swipeDirection={sheet ? 'down' : 'right'}
      modal={false}
    >
      <DrawerContent
        data-slot="inspector"
        data-practice-keys=""
        // Between the top bar and the transport: the panel never covers the transport (2.4.11),
        // so the sheet has no bleed under it either (it would paint over the status row).
        className={
          sheet
            ? 'bottom-(--transport-height)! [--bleed:0px] [--drawer-height:min(60dvh,34rem)]'
            : 'data-[swipe-axis=x]:top-13! data-[swipe-axis=x]:bottom-(--transport-height)! data-[swipe-axis=x]:[--drawer-content-width:21.25rem]'
        }
      >
        <DrawerTitle className="sr-only">{m['practice.tools_label']()}</DrawerTitle>
        <InspectorTabs layout={layout} />
        {sheet && (
          <div className="flex justify-end border-t border-border p-2">
            <Button variant="quiet" size="sm" onClick={close}>
              {m['practice.close_tools']()}
            </Button>
          </div>
        )}
      </DrawerContent>
    </Drawer>
  )
}
