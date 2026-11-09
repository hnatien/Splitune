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

const EYEBROW = 'text-xs tracking-[0.08em] text-faint-foreground uppercase'

// "Pick up where you left off" (27 §3.5, 26 §12.2 ContinueCard). Desktop: a card spanning two grid
// columns on the --muted → --card gradient, the song as the page's h1, its badges and Resume
// practice (56 px; secondary, so Add song stays the view's one primary, 26 §4.5). `chart` is the
// 30-day sparkline (s39). Phone: one compact link with a round play mark.
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
      className={cn(
        'flex min-w-0 flex-col gap-4.5 rounded-3xl border border-border bg-linear-135 from-muted to-card p-6',
        className,
      )}
    >
      <p className="flex items-center gap-2.5">
        <span id="pick-up" className={EYEBROW}>
          {m['library.pick_up']()}
        </span>
        <span className="text-sm text-faint-foreground">· {song.when}</span>
      </p>
      <div className="flex flex-wrap items-end gap-6">
        <div className="flex min-w-0 flex-[1_1_20rem] flex-col gap-1.5">
          <h1 className="text-2xl">{song.title}</h1>
          <p className="text-base text-muted-foreground">{song.meta}</p>
          {song.badges.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {song.badges.map((badge) => (
                <Badge key={badge.label} variant={badge.variant}>
                  {badge.label}
                </Badge>
              ))}
            </div>
          )}
        </div>
        {chart && <div className="min-w-55 flex-[0_1_18.75rem]">{chart}</div>}
        {renderLink({
          className: buttonVariants({ variant: 'secondary', size: 'xl' }),
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
    className:
      'flex flex-col gap-3 rounded-3xl border border-border bg-muted p-4 focus-visible:outline-offset-2',
    children: (
      <>
        <span className={EYEBROW}>{m['library.pick_up']()}</span>
        <span className="flex items-center gap-3">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-lg">{song.title}</span>
            <span className="block truncate text-sm text-muted-foreground">{song.meta}</span>
          </span>
          <span
            aria-hidden
            className="grid size-13 shrink-0 place-items-center rounded-full bg-accent text-foreground inset-ring inset-ring-border-strong"
          >
            <PlayIcon className="size-6 fill-current" />
          </span>
        </span>
      </>
    ),
  })
}
