import { pcOfName } from '@splitune/music-core'
import { Link } from '@tanstack/react-router'
import { ALargeSmallIcon, EllipsisIcon, KeyboardIcon, PanelRightIcon } from 'lucide-react'
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

const CHORDS_STAGE: string = 'chords'

// The practice top bar's content (27 §3.7.1, Main.dc.html; the focus shell draws the bar, 60 px,
// and "‹ Library"): the title (16/650) over the part line "{artist} · {part} · {key} · {bpm} BPM"
// (the key spelled in the song's own key; "key after chords" while the chords are on the way), the
// centred view switch — or, while the analysis runs, the analysing badge — then the legend chip,
// Display and reading (Aa), Keyboard & pedal, Tools (the inspector's drawer below 1180 px) and More
// (⋯). Stage keeps the controls and drops the title for screen readers, as phones do.

export function PracticeStatus({
  layout,
  tools = false,
}: {
  layout: PracticeLayout
  /** The inspector is a drawer here: the bar gets its "Tools" button. */
  tools?: boolean
}) {
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
  const inspectorOpen = usePracticeUi((s) => s.inspectorOpen)
  const displayOpen = usePracticeUi((s) => s.displayOpen)
  return (
    <>
      <span aria-hidden className="h-8 w-px shrink-0 bg-border max-sm:hidden" />
      {/* Phones keep the controls, read from the stand, whole: the title is for screen readers
          there, as in Stage. */}
      <div className="flex min-w-0 shrink flex-col leading-tight max-sm:sr-only in-data-[appearance=stage]:sr-only">
        <span className="truncate text-button-lg font-[650]" title={song?.title}>
          {song?.title}
        </span>
        {partLine && <span className="truncate text-sm text-muted-foreground">{partLine}</span>}
      </div>
      <div className="flex min-w-0 flex-1 items-center justify-center gap-2 max-lg:justify-end">
        <Suspense fallback={null}>
          <StatusControls layout={layout} />
        </Suspense>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Suspense fallback={null}>
          <StatusLegend />
        </Suspense>
        <Popover
          open={displayOpen}
          onOpenChange={(open) => usePracticeUi.setState({ displayOpen: open })}
        >
          <PopoverTrigger
            render={<Button variant="ghost" size="icon" aria-label={m['nav.display_reading']()} />}
          >
            <ALargeSmallIcon aria-hidden />
          </PopoverTrigger>
          <Suspense fallback={null}>
            <DisplayPanel />
          </Suspense>
        </Popover>
        {!phone && (
          <Link
            to="/settings/keyboard"
            aria-label={m['nav.keyboard']()}
            className={buttonVariants({ variant: 'ghost', size: 'icon' })}
          >
            <KeyboardIcon aria-hidden />
          </Link>
        )}
        {tools && (
          <Button
            variant={inspectorOpen ? 'on' : 'ghost'}
            size="practice-2"
            aria-pressed={inspectorOpen}
            onClick={() => usePracticeUi.setState({ inspectorOpen: !inspectorOpen })}
          >
            <PanelRightIcon aria-hidden />
            {m['practice.tools']()}
          </Button>
        )}
        <Popover>
          <PopoverTrigger
            render={<Button variant="ghost" size="icon" aria-label={m['practice.more']()} />}
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
