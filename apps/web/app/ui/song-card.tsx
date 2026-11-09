import type { StemKind } from '@splitune/ui-tokens'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'

// Doc 26 §12.2, 27 §3.5: library entries. `SongCard` for the grid (tablet, desktop), `SongRow` for
// phones and the list view. The title and its meta line are the link (named by that visible text,
// WCAG 2.5.3; at least 44 px tall, 26 §8); its ::after covers the rest of the entry, so the whole
// card opens Practice and the focus ring outlines it. Long titles clamp with the full text in `title`.
// `actions` (the More menu) sits above the link's hit area; `preview` is the 28 px waveform when the
// song has one; `progress` the analysing bar or the failure line. `renderLink` lets the app use its
// router's link.

type SongSummary = {
  title: string
  /** "Mara Quinn · Guitar · 3:50" */
  subtitle: string
  status: {
    label: string
    variant: 'primary' | 'success' | 'warning' | 'info' | 'neutral' | 'destructive'
    icon?: React.ReactNode
  }
  /** After the badge: "Practised yesterday · best 80 % on bars 25–28", "You can loop it already". */
  meta?: string | undefined
  href: string
}

type LinkRenderer = (props: React.ComponentProps<'a'>) => React.ReactElement

type SongEntryProps = {
  song: SongSummary
  /** The stem tile (`InstrumentTile`). */
  leading?: React.ReactNode
  actions?: React.ReactNode
  preview?: React.ReactNode
  progress?: React.ReactNode
  /** Offline and not saved on this device (27 §4): dimmed, with the reason after the badge. */
  unavailable?: string | undefined
  renderLink?: LinkRenderer
  className?: string | undefined
}

const plainLink: LinkRenderer = (props) => <a {...props} />

// The stem colour of the song's part (§4.4) fills the tile; the part is always named in the text
// next to it, so the tile is decorative.
const TILE_FILL: Record<StemKind, string> = {
  guitar: 'bg-stem-guitar',
  bass: 'bg-stem-bass',
  drums: 'bg-stem-drums',
  vocals: 'bg-stem-vocals',
  keys: 'bg-stem-keys',
  other: 'bg-stem-other',
  mix: 'bg-stem-mix',
}

/** `.tile`: the part's letters ("Gt") on its stem colour, 40 px (32 in lists of results). */
function InstrumentTile({
  stem,
  label,
  size = 'md',
  className,
}: {
  stem: StemKind
  label: string
  size?: 'sm' | 'md'
  className?: string
}) {
  return (
    <span
      data-slot="instrument-tile"
      aria-hidden
      className={cn(
        'grid shrink-0 place-items-center rounded-lg font-[750] text-tile-foreground contrast-more:border contrast-more:border-current forced-colors:border forced-colors:border-current in-data-unavailable:bg-accent in-data-unavailable:text-muted-foreground',
        size === 'md' ? 'size-10 text-md' : 'size-8 text-xs',
        TILE_FILL[stem],
        className,
      )}
    >
      {label}
    </span>
  )
}

function Status({ song, unavailable }: { song: SongSummary; unavailable?: string | undefined }) {
  const meta = unavailable ?? song.meta
  return (
    <span className="flex flex-wrap items-center gap-2">
      <Badge variant={song.status.variant}>
        {song.status.icon}
        {song.status.label}
      </Badge>
      {meta && <span className="text-sm text-faint-foreground">{meta}</span>}
    </span>
  )
}

const LINK_FOCUS =
  'after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-(length:--focus-width) focus-visible:after:outline-ring focus-visible:after:outline-solid'

function SongCard({
  song,
  leading,
  actions,
  preview,
  progress,
  unavailable,
  renderLink = plainLink,
  className,
}: SongEntryProps) {
  return (
    <article
      data-slot="song-card"
      data-unavailable={unavailable ? '' : undefined}
      className={cn(
        'relative flex flex-col gap-3 rounded-3xl border border-border bg-card p-4 transition-colors duration-(--duration-fast) hover:border-border-strong data-unavailable:text-muted-foreground',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        {leading}
        {renderLink({
          href: song.href,
          title: song.title,
          className: cn(
            'flex min-h-11 min-w-0 flex-1 flex-col gap-0.5 after:rounded-3xl focus-visible:after:outline-offset-2',
            LINK_FOCUS,
          ),
          children: (
            <>
              <h3 className="line-clamp-2 text-button-lg font-[650] leading-tight break-words">
                {song.title}
              </h3>
              <span className="truncate text-sm text-faint-foreground">{song.subtitle}</span>
            </>
          ),
        })}
        {actions && <div className="relative -mt-1.5 -mr-2 shrink-0">{actions}</div>}
      </div>
      {preview && <div className="h-7">{preview}</div>}
      <Status song={song} unavailable={unavailable} />
      {progress && <div className="relative">{progress}</div>}
    </article>
  )
}

// Phone rows (Phone-Library): tile, title and meta, the badge at the end, at least 60 px tall.
function SongRow({
  song,
  leading,
  actions,
  progress,
  unavailable,
  renderLink = plainLink,
  className,
}: SongEntryProps) {
  const meta = unavailable ?? song.meta ?? song.subtitle
  return (
    <article
      data-slot="song-row"
      data-unavailable={unavailable ? '' : undefined}
      className={cn(
        'relative flex min-h-15 items-center gap-3 rounded-lg px-1 py-2 has-data-[slot=song-progress]:items-start transition-colors duration-(--duration-fast) hover:bg-muted data-unavailable:text-muted-foreground',
        className,
      )}
    >
      {leading}
      <div className="flex min-w-0 flex-1 flex-col">
        {renderLink({
          href: song.href,
          title: song.title,
          className: cn(
            'flex min-h-11 min-w-0 flex-col justify-center after:rounded-lg focus-visible:after:-outline-offset-2',
            LINK_FOCUS,
          ),
          children: (
            <>
              <h3 className="truncate text-base font-[650]">{song.title}</h3>
              <span className="truncate text-sm text-faint-foreground">{meta}</span>
            </>
          ),
        })}
        {progress && (
          <div data-slot="song-progress" className="relative mt-1">
            {progress}
          </div>
        )}
      </div>
      <Badge variant={song.status.variant}>
        {song.status.icon}
        {song.status.label}
      </Badge>
      {actions && <div className="relative -mr-2 shrink-0">{actions}</div>}
    </article>
  )
}

export type { SongSummary }
export { InstrumentTile, SongCard, SongRow }
