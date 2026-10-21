import { Instrument, LibrarySort, LibraryStatusFilter } from '@splitune/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { LibraryPage } from '@/features/library/library-page'
import { LibrarySkeleton } from '@/features/library/library-skeleton'
import { libraryQuery } from '@/features/library/queries'
import { m } from '@/lib/i18n'

// Library (27 §3.5), the app's home. data-only SSR (10 §1): the first page of songs is loaded on
// the server and handed to the client, which renders.
const Search = z.object({
  q: z.string().trim().min(1).max(200).optional().catch(undefined),
  instrument: Instrument.optional().catch(undefined),
  status: LibraryStatusFilter.optional().catch(undefined),
  sort: LibrarySort.optional().catch(undefined),
  view: z.enum(['grid', 'list']).optional().catch(undefined),
})

export const Route = createFileRoute('/_app/library')({
  ssr: 'data-only',
  validateSearch: Search,
  loaderDeps: ({ search: { q, instrument, status, sort } }) => ({ q, instrument, status, sort }),
  loader: ({ context, deps }) => context.queryClient.prefetchInfiniteQuery(libraryQuery(deps)),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['library.title']() }) }] }),
  pendingComponent: LibrarySkeleton,
  component: Library,
})

function Library() {
  const { me } = Route.useRouteContext()
  return <LibraryPage me={me} search={Route.useSearch()} />
}
