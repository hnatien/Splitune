import type { StemKind } from '@splitune/ui-tokens'
import { GaugeIcon, HistoryIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'

// Doc 26 §12.2, 27 §3.5: library entries. Card grid on tablet/desktop, rows on phone. The title is
// the link (the whole card is clickable through it, and its focus ring outlines the card); long
// titles clamp with the full text in title. `actions` (the overflow menu) sits above the link's
// hit area; `progress` shows a compact analysis line while the song is analysed. `renderLink`
// lets the app use its router's link instead of a plain anchor. `leading` is an optional tile
// before the text, e.g. the instrument's `InstrumentTile`.

type SongSummary = {
  title: string
  artist?: string | undefined
  /** "Guitar" */
  instrument: string
  status: {
    label: string
    variant: 'success' | 'warning' | 'info' | 'neutral' | 'destructive'
    icon?: React.ReactNode
  }
  /** "Practised 3 days ago" */
  lastPractised?: string | undefined
  /** "Best clean pass: 85 %" */
  bestTempo?: string | undefined
  href: string
}

type LinkRenderer = (props: React.ComponentProps<'a'>) => React.ReactElement

type SongEntryProps = {
  song: SongSummary
  actions?: React.ReactNode
  progress?: React.ReactNode
  leading?: React.ReactNode
  renderLink?: LinkRenderer
  className?: string | undefined
}

const plainLink: LinkRenderer = (props) => <a {...props} />

// The stem colour of the song's instrument (§4.4) tints the tile; the instrument is always named
// in text next to it, so the tile is decorative.
const TILE_TONE: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar/12 text-stem-guitar',
  bass: 'bg-stem-bass/12 text-stem-bass',
  drums: 'bg-stem-drums/12 text-stem-drums',
  vocals: 'bg-stem-vocals/12 text-stem-vocals',
  keys: 'bg-stem-keys/12 text-stem-keys',
  other: 'bg-stem-other/12 text-stem-other',
  mix: 'bg-stem-mix/12 text-stem-mix',
}

function InstrumentTile({
  stem,
  icon,
  size = 'md',
  className,
}: {
  stem: StemKind
  icon: React.ReactNode
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      data-slot="instrument-tile"
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-xl contrast-more:border contrast-more:border-current',
        size === 'md' ? 'size-12 [&_svg]:size-6' : 'size-10 [&_svg]:size-5',
        TILE_TONE[stem],
        className,
      )}
    >
      {icon}
    </span>
  )
}

function Status({ song, className }: { song: SongSummary; className?: string }) {
  return (
    <span className={cn('flex flex-wrap items-center gap-2', className)}>
      <Badge variant={song.status.variant}>
        {song.status.icon}
        {song.status.label}
      </Badge>
      <span className="text-sm text-muted-foreground">{song.instrument}</span>
    </span>
  )
}

function Stats({ song, className }: { song: SongSummary; className?: string }) {
  if (!song.lastPractised && !song.bestTempo) return null
  return (
    <span
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground',
        className,
      )}
    >
      {song.lastPractised && (
        <span className="inline-flex items-center gap-1.5">
          <HistoryIcon aria-hidden className="size-4 shrink-0" />
          {song.lastPractised}
        </span>
      )}
      {song.bestTempo && (
        <span className="inline-flex items-center gap-1.5 tabular-nums">
          <GaugeIcon aria-hidden className="size-4 shrink-0" />
          {song.bestTempo}
        </span>
      )}
    </span>
  )
}

// A linked card lifts on hover (shadow-2, §9) and settles back while its link is pressed.
function SongCard({
  song,
  actions,
  progress,
  leading,
  renderLink = plainLink,
  className,
}: SongEntryProps) {
  return (
    <article
      data-slot="song-card"
      className={cn(
        'relative flex flex-col gap-4 rounded-2xl border border-transparent bg-surface-raised p-4 shadow-1 transition-[translate,box-shadow] duration-(--duration-base) ease-standard hover:-translate-y-0.5 hover:shadow-2 has-[a:active]:translate-y-0 has-[a:active]:shadow-1 contrast-more:border-border',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h3 className="text-lg leading-snug">
            {renderLink({
              href: song.href,
              title: song.title,
              className:
                'line-clamp-2 break-words after:absolute after:inset-0 after:rounded-2xl focus-visible:outline-none focus-visible:after:outline-(length:--focus-width) focus-visible:after:outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid',
              children: song.title,
            })}
          </h3>
          {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
        </div>
        {actions && <div className="relative -mt-2 -mr-2 shrink-0">{actions}</div>}
      </div>
      <Status song={song} />
      {progress && <div className="relative">{progress}</div>}
      <Stats song={song} className="mt-auto border-t border-border pt-3" />
    </article>
  )
}

// A row lays its parts out in fixed-width columns once the row itself is wide enough (a container
// query, so a narrow list never squeezes the title away), and badges and stats then line up from
// row to row whatever the instrument name and whether the song has stats. Narrower rows stack
// them under the title.
function SongRow({
  song,
  actions,
  progress,
  leading,
  renderLink = plainLink,
  className,
}: SongEntryProps) {
  return (
    <article
      data-slot="song-row"
      className={cn(
        'relative flex min-h-target items-start gap-3 px-4 py-3 transition-colors duration-(--duration-fast) hover:bg-surface-sunken/60 has-[a:active]:bg-surface-sunken @3xl/song-row:*:self-center @container/song-row',
        className,
      )}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex min-w-0 flex-col gap-2 @3xl/song-row:flex-row @3xl/song-row:items-center @3xl/song-row:gap-6">
          <div className="min-w-0 @3xl/song-row:flex-1">
            <h3 className="text-base font-semibold">
              {renderLink({
                href: song.href,
                title: song.title,
                className:
                  'line-clamp-1 break-all after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-(length:--focus-width) focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid',
                children: song.title,
              })}
            </h3>
            {song.artist && <p className="truncate text-sm text-muted-foreground">{song.artist}</p>}
          </div>
          <Status song={song} className="@3xl/song-row:w-60 @3xl/song-row:shrink-0" />
          <div className="empty:hidden @3xl/song-row:w-48 @3xl/song-row:shrink-0 @3xl/song-row:empty:block">
            <Stats song={song} className="@3xl/song-row:justify-end" />
          </div>
        </div>
        {progress && <div className="relative">{progress}</div>}
      </div>
      {actions && <div className="relative -my-1 shrink-0">{actions}</div>}
    </article>
  )
}

export type { SongSummary }
export { InstrumentTile, SongCard, SongRow }
