import { useEffect, useState } from 'react'
import { Skeleton } from '@/ui/skeleton'
import { FocusShell } from '../shell/focus-shell'

/** The waiting text appears only when loading takes longer than this (27 §4). */
const SLOW_MS = 1000

// Practice loading state (27 §4): the regions that every layout has — paper, timeline, transport
// at the bottom edge — so nothing moves when the song arrives; `slowText` ("Loading your song…")
// after 1 s. Its own module (route pending components are not code-split); the page passes the
// text, so the route's entry chunk doesn't carry the message.
export function PracticeLoading({ slowText }: { slowText?: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <FocusShell fill>
      <div
        aria-busy="true"
        className="flex min-h-0 flex-1 flex-col items-center justify-center bg-paper px-4 text-ink"
      >
        <p role="status" className="text-read-label">
          {slow ? slowText : null}
        </p>
      </div>
      <div className="shrink-0 border-t border-border px-4 py-2 in-data-[appearance=stage]:hidden">
        <Skeleton className="h-26 rounded-lg" />
      </div>
      <div className="flex shrink-0 gap-3 border-t border-border px-4 pt-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
        {['restart', 'play', 'loop'].map((key) => (
          <Skeleton key={key} className="size-(--target-practice) rounded-full" />
        ))}
      </div>
    </FocusShell>
  )
}
