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

// Continue (27 §3.5): the library's lead, with no box around it. The song's waveform with the
// place the learner stopped (`media`, a SongMedia lead) beside the song, its clip and bars, what
// the learner is working towards as plain words (the ladder in ink), the 30-day best-clean
// sparkline (`chart`, s39) and Resume practice, the page's one filled control, at the foot of the
// column (full width on phones). Below 768 px the waveform sits above the words. The section is
// named "Pick up where you left off" for assistive tech; the song's title is its heading.
export function ContinueBlock({
  song,
  media,
  chart,
  renderLink,
  className,
}: {
  song: ContinueSummary
  media: React.ReactNode
  chart?: React.ReactNode
  renderLink: LinkRenderer
  className?: string
}) {
  return (
    <section
      aria-label={m['library.pick_up']()}
      data-slot="continue"
      className={cn(
        'grid min-w-0 gap-x-10 gap-y-5 md:grid-cols-[minmax(0,14fr)_minmax(0,11fr)]',
        className,
      )}
    >
      {media}
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h2 className="text-display text-balance">{song.title}</h2>
          <p className="text-body text-pretty text-muted-foreground">
            {song.meta} · {song.when}
          </p>
          {song.notes.length > 0 && (
            <ul className="m-0 mt-1.5 flex list-none flex-col gap-1 p-0 text-label-sm tabular-nums">
              {song.notes.map((note) => (
                <li
                  key={note.label}
                  className={note.lead ? 'text-foreground' : 'font-normal text-muted-foreground'}
                >
                  {note.label}
                </li>
              ))}
            </ul>
          )}
        </div>
        {chart && <div className="max-w-64">{chart}</div>}
        {renderLink({
          className: buttonVariants({
            variant: 'primary',
            size: 'lg',
            className: 'self-start max-sm:self-stretch md:mt-auto',
          }),
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
