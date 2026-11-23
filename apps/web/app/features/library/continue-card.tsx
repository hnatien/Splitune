import { PlayIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { buttonVariants } from '@/ui/button'

export type ContinueSummary = {
  title: string
  /** "Mara Quinn · Guitar · clip **Chorus riff**, bars 25–28" */
  meta: React.ReactNode
  /** "yesterday, 24 min" */
  when: string
  /** "Ladder at 75 % → 100 %" (the lead), "Best clean 80 %", "Yesterday's first clean pass: 70 %" */
  notes: { label: string; lead: boolean }[]
}

type LinkRenderer = (props: React.ComponentProps<'a'>) => React.ReactElement

// Continue (s47 direction §6, 27 §3.5): the library's lead, with no box around it. "Pick up where
// you left off" and when, the song, its clip and bars, what the learner is working towards as
// plain words (the ladder in ink), the 30-day best-clean sparkline (`chart`, s39) and Resume
// practice, the page's one filled control (full width on phones).
export function ContinueBlock({
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
      aria-label={m['library.pick_up']()}
      data-slot="continue"
      className={cn('flex min-w-0 flex-col gap-4', className)}
    >
      <div className="flex min-w-0 flex-col gap-1">
        <p className="text-caption text-muted-foreground">{m['library.pick_up']()}</p>
        <h2 className="text-heading text-balance">{song.title}</h2>
        <p className="text-body-sm text-muted-foreground">
          {song.meta} · {song.when}
        </p>
        {song.notes.length > 0 && (
          <ul className="m-0 mt-1 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-label-sm tabular-nums">
            {song.notes.map((note) => (
              <li
                key={note.label}
                className={note.lead ? 'text-foreground' : 'text-muted-foreground'}
              >
                {note.label}
              </li>
            ))}
          </ul>
        )}
      </div>
      {chart && <div className="max-w-80">{chart}</div>}
      {renderLink({
        className: buttonVariants({
          variant: 'primary',
          size: 'lg',
          className: 'self-start max-sm:self-stretch',
        }),
        children: (
          <>
            <PlayIcon aria-hidden className="fill-current" />
            {m['library.resume']()}
          </>
        ),
      })}
    </section>
  )
}
