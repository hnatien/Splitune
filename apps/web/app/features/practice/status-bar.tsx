import { EllipsisIcon, SettingsIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { LoopBadge, type LoopState } from '@/ui/loop-badge'
import { Popover, PopoverTrigger } from '@/ui/popover'
import type { PracticeLayout } from './layout'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Popover contents load on first open (12 §10 route budget).
const LoopPanel = lazy(() =>
  import('./loop-panel').then((module) => ({ default: module.LoopPanel })),
)
const MorePanel = lazy(() =>
  import('./more-panel').then((module) => ({ default: module.MorePanel })),
)
const DisplayPanel = lazy(() =>
  import('./display-popover').then((module) => ({ default: module.DisplayPanel })),
)

// Status bar content (27 §3.7.1): song title (truncates) and part, the loop badge for distance
// reading, ⚙ Display and ⋯ (shortcuts and the editor on desktop, key bindings). Stage keeps only
// the loop badge and ⚙ (the way back out of Stage) of the chrome.

export function PracticeStatus({ layout }: { layout: PracticeLayout }) {
  const { data, songId, guest } = usePractice()
  const song = data.song.data
  return (
    <>
      {/* Phones keep the loop badge, read from the stand, whole: the title is for screen readers
          there, as in Stage. */}
      <span
        className="min-w-0 truncate text-base font-semibold max-sm:sr-only in-data-[appearance=stage]:sr-only"
        title={song?.title}
      >
        {song?.title}
      </span>
      {song && (
        <span className="shrink-0 text-sm text-muted-foreground max-sm:hidden in-data-[appearance=stage]:hidden">
          {instrumentLabel(song.instrument)}
        </span>
      )}
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <LoopControl />
        <Popover>
          <PopoverTrigger
            render={
              <Button variant="ghost" size="icon-practice-2" aria-label={m['practice.display']()} />
            }
          >
            <SettingsIcon aria-hidden />
          </PopoverTrigger>
          <Suspense fallback={null}>
            <DisplayPanel />
          </Suspense>
        </Popover>
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="icon-practice-2"
                className="in-data-[appearance=stage]:hidden"
                aria-label={m['practice.more']()}
              />
            }
          >
            <EllipsisIcon aria-hidden />
          </PopoverTrigger>
          <Suspense fallback={null}>
            <MorePanel desktop={layout === 'desktop'} editor={!guest} songId={songId} />
          </Suspense>
        </Popover>
      </div>
    </>
  )
}

// The loop badge ("Loop · bars 17–20 · pass 3") mirrors the loop for distance reading and opens
// the loop's options.
function LoopControl() {
  const { player, state } = usePractice()
  const selection = usePracticeUi((s) => s.selection)
  const loop = player.loop
  const badge: LoopState =
    selection.kind === 'armed'
      ? 'armed'
      : !loop || !player.loopOn
        ? 'off'
        : state === 'loopRest' || state === 'assess'
          ? 'resting'
          : 'active'
  const bars = loop ? `${loop.startBar + 1}–${loop.endBar + 1}` : ''
  const text = loop
    ? player.pass > 0
      ? m['practice.loop_badge_pass']({ bars, pass: String(player.pass) })
      : m['practice.loop_badge']({ bars })
    : selection.kind === 'armed'
      ? m['practice.loop_armed']({ bar: String(selection.bar + 1) })
      : m['practice.loop_off']()
  return (
    <Popover>
      <PopoverTrigger render={<LoopBadge state={badge}>{text}</LoopBadge>} />
      <Suspense fallback={null}>
        <LoopPanel />
      </Suspense>
    </Popover>
  )
}
