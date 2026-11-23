import { pcOfName } from '@splitune/music-core'
import { Link } from '@tanstack/react-router'
import { ALargeSmallIcon, EllipsisIcon, KeyboardIcon } from 'lucide-react'
import { lazy, Suspense } from 'react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button, buttonVariants } from '@/ui/button'
import { chordText } from '@/ui/chord-chip'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { isPhone, type PracticeLayout } from './layout'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// Popover contents and the centre controls load on demand (12 §10 route budget).
const StatusControls = lazy(() =>
  import('./status-controls').then((module) => ({ default: module.StatusControls })),
)
const StatusLegend = lazy(() =>
  import('./status-controls').then((module) => ({ default: module.StatusLegend })),
)
const MorePanel = lazy(() =>
  import('./more-panel').then((module) => ({ default: module.MorePanel })),
)
const DisplayPanel = lazy(() =>
  import('./display-popover').then((module) => ({ default: module.DisplayPanel })),
)
const FixPill = lazy(() => import('./fix-mode').then((module) => ({ default: module.FixPill })))

const CHORDS_STAGE: string = 'chords'

// The practice top bar's content (27 §3.7.1; the focus shell draws the 52 px bar and "‹ Library"):
// the title over one meta line "{artist} · {part} · {key} · {bpm} BPM" (the key spelled in the
// song's own key; "key after chords" while the chords are on the way), the view tabs in the
// middle — or, while the analysis runs, its status — then the unsure chip, Display and reading
// (Aa), Keyboard & pedal and More (⋯). Everything here is quiet: no fill at rest, so the music
// below takes the ink. Phones keep back, the view tabs, Aa and ⋯ and nothing else, so nothing
// overlaps at 375 px; the title is read out there, as in Stage. In Fix mode (§3.7.4) the middle
// is the "Fixing" pill with Undo and Done, and the bar keeps only Display and More beside it.

export function PracticeStatus({ layout }: { layout: PracticeLayout }) {
  const { data, songId, guest, grid, music } = usePractice()
  const song = data.song.data
  const key = music?.chords?.key
  const tonicPc = key ? pcOfName(key.tonic) : null
  // Static message calls only: a computed m[...] would bundle every message into the route.
  const tonic = tonicPc !== null ? chordText(music?.noteNames[tonicPc] ?? '') : ''
  // "key after chords" while the chords are still to come in a running analysis.
  const analysis = data.analysis.data
  const chords = analysis?.stages[CHORDS_STAGE]?.status
  const chordsPending =
    (analysis?.status === 'queued' || analysis?.status === 'running') &&
    (chords === 'pending' || chords === 'running')
  const keyName =
    key && tonic
      ? key.mode === 'major'
        ? m['practice.key_major']({ tonic })
        : m['practice.key_minor']({ tonic })
      : chordsPending
        ? m['practice.key_after_chords']()
        : ''
  const partLine = song
    ? [
        song.artist,
        instrumentLabel(song.instrument),
        keyName,
        grid ? `${Math.round(grid.bpm)} BPM` : '',
      ]
        .filter(Boolean)
        .join(' · ')
    : ''
  const phone = isPhone(layout)
  const displayOpen = usePracticeUi((s) => s.displayOpen)
  const fixing = usePracticeUi((s) => s.fixing) && layout === 'desktop'
  return (
    <>
      {/* Phones keep the controls whole: the title is for screen readers there, as in Stage. */}
      <div className="flex min-w-0 shrink flex-col max-sm:sr-only in-data-[appearance=stage]:sr-only">
        <span className="truncate text-label" title={song?.title}>
          {song?.title}
        </span>
        {partLine && (
          <span className="truncate text-caption text-muted-foreground tabular-nums">
            {partLine}
          </span>
        )}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2">
        <Suspense fallback={null}>
          {fixing ? <FixPill /> : <StatusControls layout={layout} />}
        </Suspense>
      </div>
      <div className="flex shrink-0 items-center">
        {!fixing && !phone && (
          <Suspense fallback={null}>
            <StatusLegend />
          </Suspense>
        )}
        <Popover
          open={displayOpen}
          onOpenChange={(open) => usePracticeUi.setState({ displayOpen: open })}
        >
          <PopoverTrigger
            render={<Button variant="quiet" size="icon" aria-label={m['nav.display_reading']()} />}
          >
            <ALargeSmallIcon aria-hidden />
          </PopoverTrigger>
          <Suspense fallback={null}>
            <DisplayPanel />
          </Suspense>
        </Popover>
        {!phone && !fixing && (
          <Link
            to="/settings/keyboard"
            aria-label={m['nav.keyboard']()}
            className={buttonVariants({ variant: 'quiet', size: 'icon' })}
          >
            <KeyboardIcon aria-hidden />
          </Link>
        )}
        <Popover>
          <PopoverTrigger
            render={<Button variant="quiet" size="icon" aria-label={m['practice.more']()} />}
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
