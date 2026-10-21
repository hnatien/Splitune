import { getRequestHeader } from '@tanstack/react-start/server'
import { getApi } from './api.ts'

// Server-side API calls during SSR (data-only loaders, the session check): the request goes to
// the in-process API with the visitor's cookie, so it is authorised exactly like a browser call.
export function forwardToApi(request: Request): Promise<Response> {
  const headers = new Headers(request.headers)
  const cookie = getRequestHeader('cookie')
  if (cookie) headers.set('cookie', cookie)
  return Promise.resolve(getApi().fetch(new Request(request, { headers })))
}
