import type { CSSProperties } from 'react'
import { m } from '@/lib/i18n'
import { Skeleton } from '@/ui/skeleton'

// Library loading state (27 §4): the final layout in skeleton form, so nothing moves when the
// songs arrive: the page title, Continue (the 16:9 waveform well beside the title, the meta line
// and the 48 px Resume pill), This week as its row between two hairlines, a group head and six
// tiles in the songs' grid. Its own module: route pending components are not code-split, so this
// must not pull in the library screen.

/** Six tiles in the songs' grid (filter changes keep the toolbar and show these). */
export function SongsSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      <div aria-hidden className="flex min-h-4.5 items-center">
        <Skeleton className="h-3 w-28" />
      </div>
      <ul
        aria-busy="true"
        aria-label={m['library.loading']()}
        className="stagger-children m-0 grid list-none gap-x-6 gap-y-8 p-0 sm:grid-cols-2 lg:grid-cols-3"
      >
        {['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => (
          <li
            key={key}
            className="flex animate-rise-in flex-col gap-2.5"
            style={{ '--i': index } as CSSProperties}
          >
            <Skeleton className="aspect-video w-full rounded-media" />
            <div className="flex gap-2.5">
              <Skeleton className="size-5 shrink-0 rounded-media" />
              <div className="flex flex-1 flex-col gap-1.5">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-2/5" />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-10 max-sm:gap-8">
      <h1 className="text-heading">{m['library.title']()}</h1>
      <div aria-hidden className="flex flex-col gap-8">
        <div
          data-slot="continue-skeleton"
          className="grid gap-x-10 gap-y-5 md:grid-cols-[minmax(0,14fr)_minmax(0,11fr)]"
        >
          <Skeleton className="aspect-video w-full rounded-media" />
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-9 w-2/3" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-3 h-12 w-48 rounded-full max-sm:w-full md:mt-auto" />
          </div>
        </div>
        <div
          data-slot="week-skeleton"
          className="flex flex-wrap items-center gap-x-12 gap-y-5 border-y border-border px-2 py-5"
        >
          <Skeleton className="h-3 w-20 max-sm:w-full" />
          <Skeleton className="h-11 w-40" />
          <div className="flex gap-3 sm:ml-auto">
            {['m', 't', 'w', 'h', 'f', 's', 'u'].map((day) => (
              <div key={day} className="flex w-6 flex-col items-center gap-1.5">
                <Skeleton className="h-10 w-2 rounded-full" />
                <Skeleton className="h-3 w-3" />
              </div>
            ))}
          </div>
        </div>
      </div>
      <SongsSkeleton />
    </div>
  )
}
