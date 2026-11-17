import { PlayIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { buttonVariants } from '@/ui/button'

export type ContinueSummary = {
  title: string
  /** "Mara Quinn · Guitar · bars 25–28" */
  meta: string
  /** "yesterday" */
  when: string
  badges: { label: string; variant: 'primary' | 'neutral' }[]
}

type LinkRenderer = (props: React.ComponentProps<'a'>) => React.ReactElement

// "Pick up where you left off" (27 §3.5, 26 §12.2 ContinueCard). Desktop: the page's lead, one quiet
// --muted panel with 12 px corners, the song as the page's h1 (the section's name is spoken, not
// shown), its meta line with when it was last practised, its badges, and Resume
// practice as the page's primary pill. `chart` is the 30-day sparkline (s39). Phone: one compact
// link with a round ink play mark.
export function ContinueCard({
  song,
  chart,
  renderLink,
  className,
}: {
  song: ContinueSummary
  chart?: React.ReactNode
  renderLink: LinkRenderer
  className?: string
}) {
  return (
    <section
      aria-labelledby="pick-up"
      data-slot="continue-card"
      className={cn('flex min-w-0 flex-col gap-3 rounded-xl bg-muted p-6 sm:p-8', className)}
    >
      <span id="pick-up" className="sr-only">
        {m['library.pick_up']()}
      </span>
      <div className="flex flex-wrap items-end gap-x-8 gap-y-6">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1">
          <h1 className="text-2xl">{song.title}</h1>
          <p className="text-base text-muted-foreground">
            {song.meta} · {song.when}
          </p>
          {song.badges.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {song.badges.map((badge) => (
                // On the --muted panel a neutral badge takes the outline, so it keeps its edge.
                <Badge
                  key={badge.label}
                  variant={badge.variant === 'neutral' ? 'outline' : badge.variant}
                >
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {chart && <div className="min-w-55 flex-[0_1_18.75rem]">{chart}</div>}
        {renderLink({
          className: buttonVariants({ variant: 'primary', size: 'lg' }),
          children: (
            <>
              <PlayIcon aria-hidden className="fill-current" />
              {m['library.resume']()}
            </>
          ),
        })}
      </div>
    </section>
  )
}

/** Phone-Library's compact card: the whole card is the link to Practice. */
export function ContinueCardCompact({
  song,
  renderLink,
}: {
  song: ContinueSummary
  renderLink: LinkRenderer
}) {
  return renderLink({
    className: 'flex flex-col rounded-xl bg-muted p-4 focus-visible:outline-offset-2',
    children: (
      <>
        <span className="sr-only">{m['library.pick_up']()}</span>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg">{song.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{song.meta}</span>
          </span>
          <span
            aria-hidden
            className="grid size-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground"
          >
            <PlayIcon className="size-5 fill-current" />
          </span>
        </span>
      </>
    ),
  })
}
