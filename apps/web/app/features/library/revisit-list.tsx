import type * as React from 'react'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { ListGroup, ListRow } from '@/ui/list-row'
import { INSTRUMENT_ICON } from './instrument-icon'

export type RevisitClip = {
  id: string
  instrument: InstrumentName
  /** The clip's name: "Bridge bends" */
  clip: string
  /** "Northbound Lights · 6 days ago · best 65 %" (`library.revisit_meta`) */
  meta: string
}

// "Worth a revisit" (27 §3.5): up to three clips not played for 5 days or more that have a best
// clean tempo, as hairline rows that open Practice on that clip (`renderLink` gives the link
// element; the row draws its content), with what a cold pass shows under them. Fed by the progress
// data (s39, library-progress.tsx).
export function RevisitList({
  clips,
  renderLink,
}: {
  clips: RevisitClip[]
  renderLink: (clip: RevisitClip) => React.ReactElement
}) {
  return (
    <div className="flex flex-col gap-2">
      <ListGroup aria-label={m['library.revisit']()} title={m['library.revisit']()}>
        {clips.map((clip) => {
          const Icon = INSTRUMENT_ICON[clip.instrument]
          return (
            <ListRow
              key={clip.id}
              render={renderLink(clip)}
              media={<Icon aria-hidden className="size-5" strokeWidth={1.8} />}
              title={clip.clip}
              meta={clip.meta}
            />
          )
        })}
      </ListGroup>
      <p className="text-caption text-muted-foreground">{m['library.revisit_hint']()}</p>
    </div>
  )
}
