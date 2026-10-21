import { m } from '@/lib/i18n'
import { Skeleton } from '@/ui/skeleton'

// Library loading state (27 §4): six cards in the grid's layout. Its own module: route pending
// components are not code-split, so this must not pull in the library screen.
export function LibrarySkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label={m['library.loading']()}
      className="grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
    >
      {['a', 'b', 'c', 'd', 'e', 'f'].map((key) => (
        <li key={key} className="flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
          <Skeleton className="h-6 w-3/4" />
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-4 w-1/2" />
        </li>
      ))}
    </ul>
  )
}
