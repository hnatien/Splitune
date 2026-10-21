import { QueryClient } from '@tanstack/react-query'
import { createRouter } from '@tanstack/react-router'
import { setupRouterSsrQueryIntegration } from '@tanstack/react-router-ssr-query'
import { createIsomorphicFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { routeTree } from './routeTree.gen'
import { NONCE_HEADER } from './server/headers.ts'

export type RouterContext = { queryClient: QueryClient }

// The CSP nonce app/server.ts generated for this document (none in the browser).
const documentNonce = createIsomorphicFn()
  .server(() => getRequestHeader(NONCE_HEADER))
  .client(() => undefined)

export function getRouter() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
  })
  const nonce = documentNonce()
  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreload: 'intent',
    ...(nonce ? { ssr: { nonce } } : {}),
  })
  setupRouterSsrQueryIntegration({ router, queryClient })
  return router
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
