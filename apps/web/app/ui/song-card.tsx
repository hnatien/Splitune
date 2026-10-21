import { GaugeIcon } from 'lucide-react'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'

// Doc 26 §12.2, 27 §3.5: library entries. Card grid on tablet/desktop, rows on phone. The title is
// the link (the whole card is clickable through it, and its focus ring outlines the card); long
// titles clamp with the full text in title.

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

function Meta({ song }: { song: SongSummary }) {
  return (
    <>
      <span className="flex flex-wrap items-center gap-2">
        <Badge variant={song.status.variant}>
          {song.status.icon}
          {song.status.label}
        </Badge>
        <span className="text-sm text-muted-foreground">{song.instrument}</span>
      </span>
      {(song.lastPractised || song.bestTempo) && (
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          {song.lastPractised && <span>{song.lastPractised}</span>}
          {song.bestTempo && (
            <span className="inline-flex items-center gap-1 tabular-nums">
              <GaugeIcon aria-hidden className="size-4" />
              {song.bestTempo}
            </span>
          )}
        </span>
      )}
    </>
  )
}

function SongCard({ song, className }: { song: SongSummary; className?: string }) {
  return (
    <article
      data-slot="song-card"
      className={cn(
        'relative flex flex-col gap-3 rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-2',
        className,
      )}
    >
      <h3 className="text-lg leading-snug">
        <a
          href={song.href}
          title={song.title}
          className="line-clamp-2 break-words after:absolute after:inset-0 after:rounded-xl focus-visible:outline-none focus-visible:after:outline-(length:--focus-width) focus-visible:after:outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid"
        >
          {song.title}
        </a>
      </h3>
      {song.artist && <p className="-mt-2 truncate text-sm text-muted-foreground">{song.artist}</p>}
      <Meta song={song} />
    </article>
  )
}

function SongRow({ song, className }: { song: SongSummary; className?: string }) {
  return (
    <article
      data-slot="song-row"
      className={cn(
        'relative flex min-h-target flex-col gap-2 border-b border-border px-4 py-3',
        className,
      )}
    >
      <h3 className="text-base font-semibold">
        <a
          href={song.href}
          title={song.title}
          className="line-clamp-1 break-all after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-(length:--focus-width) focus-visible:after:-outline-offset-2 focus-visible:after:outline-ring focus-visible:after:outline-solid"
        >
          {song.title}
        </a>
      </h3>
      <Meta song={song} />
    </article>
  )
}

export type { SongSummary }
export { SongCard, SongRow }
