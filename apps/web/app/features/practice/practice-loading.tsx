import { Link } from '@tanstack/react-router'
import { RotateCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button, buttonVariants } from '@/ui/button'
import { Skeleton } from '@/ui/skeleton'
import { InlineError } from '@/ui/status-message'
import { FocusShell } from '../shell/focus-shell'

/** The waiting text appears only when loading takes longer than this (27 §4). */
const SLOW_MS = 1000

// Practice loading state (27 §4, 26 §13): the practice screen's own regions as skeletons, so
// nothing moves when the song arrives. Under the top bar the song map, then the paper with three
// systems of staff lines and the key row, then the transport at the bottom edge: one 80 px row
// with Play in the left cluster from 640 px, a status row over two rows of controls on a phone.
// `slowText` ("Loading your song…") shows in the paper after 1 s. Its own module (route pending
// components are not code-split); the page passes the text, so the route's entry chunk doesn't
// carry the message.
export function PracticeLoading({ slowText }: { slowText?: string }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), SLOW_MS)
    return () => clearTimeout(timer)
  }, [])
  return (
    <FocusShell fill>
      <div data-slot="loading-map" className="shrink-0 border-b border-border px-4 pt-2.5 pb-1.5">
        <Skeleton className="h-8 rounded-media sm:h-17.5" />
      </div>
      <div
        aria-busy="true"
        data-slot="loading-paper"
        className="relative flex min-h-0 flex-1 flex-col gap-12 overflow-hidden bg-paper px-4 pt-10 text-ink sm:px-8"
      >
        {[0, 1, 2].map((system) => (
          <div key={system} aria-hidden className="flex flex-col gap-4">
            {[0, 1, 2, 3, 4, 5].map((line) => (
              <span key={line} className="h-px bg-border" />
            ))}
          </div>
        ))}
        <p
          role="status"
          className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-read-label"
        >
          {slow ? slowText : null}
        </p>
      </div>
      <div aria-hidden className="h-9 shrink-0 bg-paper" />
      <div
        aria-hidden
        data-slot="loading-transport"
        className="flex shrink-0 flex-col border-t border-border pb-[env(safe-area-inset-bottom)] sm:h-20 sm:flex-row sm:items-center sm:gap-2 sm:px-4"
      >
        <div className="flex min-h-14 items-center border-b border-border px-3 sm:hidden">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="flex items-center justify-between gap-1 px-2 py-2 sm:contents">
          <Skeleton className="size-target-practice rounded-full" />
          <Skeleton className="size-target-practice rounded-full" />
          <Skeleton className="size-target-play rounded-full" />
          <Skeleton className="size-target-practice rounded-full" />
          <Skeleton className="size-target-practice rounded-full max-sm:hidden" />
        </div>
        <div className="flex-1 max-sm:hidden" />
        <Skeleton className="h-target-practice w-40 rounded-full max-sm:hidden" />
      </div>
    </FocusShell>
  )
}

// The song couldn't be loaded (27 §5.4): what happened in the reason's own words, that it is
// often the connection and may work on a second try, and what to do: Try again, or back to the
// library. Inside the focus shell, so its Back stays where it always is.
export function PracticeError({
  title,
  description,
  onRetry,
  retrying = false,
  guest = false,
  retryLabel,
  backLabel,
}: {
  title: string
  description?: string | undefined
  /** Absent when trying again can't help (the song is gone). */
  onRetry?: (() => void) | undefined
  retrying?: boolean
  guest?: boolean
  retryLabel: string
  backLabel: string
}) {
  return (
    <FocusShell exit={guest}>
      <div data-slot="practice-error" className="mx-auto w-full max-w-reading px-4 py-10">
        <InlineError
          title={title}
          description={description}
          actions={
            <>
              {onRetry && (
                <Button variant="outline" loading={retrying} onClick={onRetry}>
                  <RotateCwIcon aria-hidden />
                  {retryLabel}
                </Button>
              )}
              <Link to={guest ? '/' : '/library'} className={buttonVariants({ variant: 'quiet' })}>
                {backLabel}
              </Link>
            </>
          }
        />
      </div>
    </FocusShell>
  )
}
