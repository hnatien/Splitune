import { useEffect, useState } from 'react'
import { Skeleton } from '@/ui/skeleton'
import { FocusShell } from '../shell/focus-shell'

/** The waiting text appears only when loading takes longer than this (27 §4). */
const SLOW_MS = 1000

// Practice loading state (27 §4): the regions that every layout has — paper, song overview,
// transport at the bottom edge — so nothing moves when the song arrives; `slowText` ("Loading your song…")
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
      <div className="shrink-0 px-4 pt-2 md:px-6">
        <Skeleton className="h-12 rounded-lg" />
      </div>
      <div className="flex shrink-0 items-center gap-3 border-t border-border px-4 pt-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] md:px-6">
        <Skeleton className="size-(--target-practice) rounded-xl" />
        <Skeleton className="size-18 rounded-full" />
        <Skeleton className="h-(--target-practice) w-48 rounded-2xl" />
      </div>
    </FocusShell>
  )
}
