import { EllipsisIcon, SettingsIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { Popover, PopoverTrigger } from '@/ui/popover'
import type { PracticeLayout } from './layout'
import { usePractice } from './practice-context'

// Popover contents load on first open, the chip, view switch and video toggle with the bar
// (12 §10 route budget).
const StatusControls = lazy(() =>
  import('./status-controls').then((module) => ({ default: module.StatusControls })),
)
const MorePanel = lazy(() =>
  import('./more-panel').then((module) => ({ default: module.MorePanel })),
)
const DisplayPanel = lazy(() =>
  import('./display-popover').then((module) => ({ default: module.DisplayPanel })),
)

// Status bar content (27 §3.7.1): song title (truncates) and part, then the transcription chip
// (its legend and "Show uncertainty" in a popover, 26 §5), the Tab / Chords view, the video
// toggle when the import has one, ⚙ Display and ⋯ (shortcuts, the editor on desktop, key
// bindings). The loop lives in the transport, next to the hands. Stage drops the title, part
// and ⋯ (⚙ is the way back out of Stage).

export function PracticeStatus({ layout }: { layout: PracticeLayout }) {
  const { data, songId, guest, grid } = usePractice()
  const song = data.song.data
  return (
    <>
      {/* Phones keep the controls, read from the stand, whole: the title is for screen readers
          there, as in Stage. */}
      <div className="flex min-w-0 flex-col max-sm:sr-only in-data-[appearance=stage]:sr-only">
        <span className="truncate text-base leading-5 font-semibold" title={song?.title}>
          {song?.title}
        </span>
        {song && (
          <span className="truncate text-sm leading-5 text-muted-foreground">
            {instrumentLabel(song.instrument)}
            {grid ? ` · ${Math.round(grid.bpm)} BPM` : ''}
          </span>
        )}
      </div>
      <div className="ml-auto flex min-w-0 items-center gap-2">
        <Suspense fallback={null}>
          <StatusControls layout={layout} />
        </Suspense>
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
