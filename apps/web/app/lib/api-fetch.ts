// How the oRPC client reaches the API. In the browser: fetch on the same origin. During SSR the
// server entry (app/server.ts) registers an in-process route to the API, so loaders don't make a
// network hop and keep the visitor's cookie.

type Fetcher = (request: Request) => Promise<Response>

let inProcess: Fetcher | undefined

export function routeApiInProcess(fetcher: Fetcher) {
  inProcess = fetcher
}

export function apiFetch(request: Request): Promise<Response> {
  return inProcess && typeof window === 'undefined' ? inProcess(request) : fetch(request)
}
