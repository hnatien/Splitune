import type { CSSProperties } from 'react'
import { m } from '@/lib/i18n'
import { Skeleton } from '@/ui/skeleton'

// Library loading state (27 §4): the Continue panel and six song cards in the final layout. Its own
// module: route pending components are not code-split, so this must not pull in the library screen.

/** Six cards in the grid's layout (filter changes keep the toolbar and show these). */
export function SongsSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label={m['library.loading']()}
      className="stagger-children grid list-none grid-cols-[repeat(auto-fill,minmax(min(280px,100%),1fr))] gap-3.5 p-0"
    >
      {['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => (
        <li
          key={key}
          className="flex animate-rise-in flex-col gap-3.5 rounded-xl border border-border p-4"
          style={{ '--i': index } as CSSProperties}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-10 shrink-0 rounded-md" />
            <div className="flex flex-1 flex-col gap-2 pt-0.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3.5 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-7 w-full" />
          <Skeleton className="h-5.5 w-2/3 rounded-full" />
        </li>
      ))}
    </ul>
  )
}

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-5 sm:gap-10">
      <div aria-hidden className="flex flex-col gap-3 rounded-xl border border-border p-6 sm:p-8">
        <Skeleton className="h-3.5 w-48" />
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="mt-3 h-12 w-48 rounded-full" />
      </div>
      <SongsSkeleton />
    </div>
  )
}
