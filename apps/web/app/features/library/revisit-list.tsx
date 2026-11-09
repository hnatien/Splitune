import { ChevronRightIcon } from 'lucide-react'
import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { SongTile } from './song-tile'

export type RevisitClip = {
  id: string
  instrument: InstrumentName
  /** The clip's name: "Bridge bends" */
  clip: string
  /** "Northbound Lights · 6 days ago · best 65 %" (`library.revisit_meta`) */
  meta: string
}

type LinkRenderer = (props: React.ComponentProps<'a'> & { clip: RevisitClip }) => React.ReactElement

// "Worth a revisit" (27 §3.5, 26 §12.2 RevisitList): up to three clips not played for 5 days or
// more that have a best clean tempo, each a card row to Practice. Built with fixture data; s39
// feeds it.
export function RevisitList({
  clips,
  renderLink,
}: {
  clips: RevisitClip[]
  renderLink: LinkRenderer
}) {
  return (
    <section aria-labelledby="revisit-title" className="flex flex-col gap-3">
      <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
        <h2 id="revisit-title" className="text-lg">
          {m['library.revisit']()}
        </h2>
        <p className="text-sm text-faint-foreground">{m['library.revisit_hint']()}</p>
      </div>
      <ul className="grid list-none grid-cols-[repeat(auto-fit,minmax(min(280px,100%),1fr))] gap-3 p-0">
        {clips.map((clip) => (
          <li key={clip.id}>
            {renderLink({
              clip,
              className:
                'flex min-h-target items-center gap-3 rounded-3xl border border-border bg-card p-3.5 hover:bg-muted focus-visible:outline-offset-2',
              children: (
                <>
                  <SongTile instrument={clip.instrument} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-[650]">{clip.clip}</span>
                    <span className="block truncate text-sm text-faint-foreground">
                      {clip.meta}
                    </span>
                  </span>
                  <ChevronRightIcon aria-hidden className="size-4 text-faint-foreground" />
                </>
              ),
            })}
          </li>
        ))}
      </ul>
    </section>
  )
}
