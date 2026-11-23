import type { CSSProperties } from 'react'
import { m } from '@/lib/i18n'
import { Skeleton } from '@/ui/skeleton'

// Library loading state (27 §4): the final layout in skeleton form, so nothing moves when the
// songs arrive: the page title, the Continue block (caption, title, meta, the 48 px Resume pill),
// the toolbar and hairline rows. Its own module: route pending components are not code-split, so
// this must not pull in the library screen.

/** Six hairline rows in the list's layout (filter changes keep the toolbar and show these). */
export function SongsSkeleton() {
  return (
    <ul
      aria-busy="true"
      aria-label={m['library.loading']()}
      className="stagger-children m-0 flex list-none flex-col p-0"
    >
      {['a', 'b', 'c', 'd', 'e', 'f'].map((key, index) => (
        <li
          key={key}
          className="flex min-h-14 animate-rise-in items-center gap-3 border-b border-border px-2 py-2.5"
          style={{ '--i': index } as CSSProperties}
        >
          <Skeleton className="h-6 w-36 shrink-0 rounded-media max-lg:hidden" />
          <div className="flex flex-1 flex-col gap-1.5">
            <Skeleton className="h-4 w-1/2" />
            <Skeleton className="h-3 w-1/3" />
          </div>
          <Skeleton className="h-4 w-28 max-sm:hidden" />
        </li>
      ))}
    </ul>
  )
}

export function LibrarySkeleton() {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-heading">{m['library.title']()}</h1>
      <div aria-hidden className="flex flex-col gap-2">
        <Skeleton className="h-4 w-56" />
        <Skeleton className="h-7 w-2/3 max-w-96" />
        <Skeleton className="h-4 w-1/2 max-w-80" />
        <Skeleton className="mt-3 h-12 w-48 rounded-full max-sm:w-full" />
      </div>
      <div className="flex flex-col gap-4">
        <Skeleton aria-hidden className="h-11 w-full max-w-80 rounded-field" />
        <SongsSkeleton />
      </div>
    </div>
  )
}
