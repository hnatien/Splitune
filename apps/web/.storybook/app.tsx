import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import type * as React from 'react'
import { useState } from 'react'

// Feature stories render screens the way the app does: inside a router (links, search params)
// with a Query cache seeded from fixtures, so nothing reaches the network. A query left unseeded
// fails against Storybook's own server, which is how the error states are shown.
export function AppStory({
  children,
  path = '/',
  seed,
}: {
  children: React.ReactNode
  path?: string
  seed?: (client: QueryClient) => void
}) {
  const [client] = useState(() => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
    })
    seed?.(queryClient)
    return queryClient
  })
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: () => <>{children}</> }),
      history: createMemoryHistory({ initialEntries: [path] }),
      context: { queryClient: client },
    }),
  )
  return (
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  )
}
