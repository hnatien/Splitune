import type { CSSProperties } from 'react'
import { m } from '@/lib/i18n'
import { Skeleton } from '@/ui/skeleton'

// Library loading state (27 §4): six cards in the grid's layout. Its own module: route pending
// components are not code-split, so this must not pull in the library screen.
export function LibrarySkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label={m['library.loading']()}
      className="stagger-children grid list-none gap-4 p-0 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => (
        <li
          key={key}
          className="flex animate-rise-in flex-col gap-4 rounded-2xl bg-surface-raised p-4 shadow-1"
          style={{ '--i': index } as CSSProperties}
        >
          <div className="flex items-start gap-3">
            <Skeleton className="size-12 shrink-0 rounded-xl" />
            <div className="flex flex-1 flex-col gap-2 pt-1">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="h-6 w-28 rounded-full" />
          <Skeleton className="h-4 w-2/3" />
        </li>
      ))}
    </ul>
  )
}
