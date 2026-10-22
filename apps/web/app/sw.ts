import type { PrecacheEntry, SerwistGlobalConfig } from 'serwist'
import {
  CacheableResponsePlugin,
  CacheFirst,
  ExpirationPlugin,
  NetworkFirst,
  Serwist,
  StaleWhileRevalidate,
} from 'serwist'

// The service worker (10 §6, Serwist): the app shell precached at build time; pages and API reads
// network-first, so the app opens and the library and examples show offline after a first visit;
// fonts, WASM and alphaTab cached on first use; example song media kept once played, keyed
// without the expiring signature, so a cached example practises offline. A new version waits
// until the page asks it to take over ("A new version is ready", never mid-practice, 27 §3.11).

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

const sameOrigin = (url: URL) => url.origin === self.location.origin
// Signed URLs and the event stream are never worth replaying; auth is never cached.
const UNCACHED_API = /^\/v1\/(?:auth\/|analyses\/[^/]+\/events$|events$)/

// Pages: network-first. Pages reached by client-side navigation never pass through here as
// navigations, so the page asks for the ones worth having offline (lib/pwa.ts, CACHE_PAGE).
const pages = new NetworkFirst({
  cacheName: 'pages',
  networkTimeoutSeconds: 4,
  plugins: [new ExpirationPlugin({ maxEntries: 32 })],
})

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST ?? [],
  precacheOptions: { cleanupOutdatedCaches: true },
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  runtimeCaching: [
    {
      matcher: ({ request, url }) => request.mode === 'navigate' && sameOrigin(url),
      handler: pages,
    },
    {
      matcher: ({ request, url }) =>
        request.method === 'GET' &&
        sameOrigin(url) &&
        url.pathname.startsWith('/v1/') &&
        !UNCACHED_API.test(url.pathname),
      handler: new NetworkFirst({
        cacheName: 'api',
        networkTimeoutSeconds: 6,
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 200, maxAgeSeconds: 30 * 86_400 }),
        ],
      }),
    },
    {
      // Hashed build files (WASM, workers, alphaTab, its Bravura font) never change under a URL.
      matcher: ({ url }) =>
        sameOrigin(url) &&
        (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/fonts/')),
      handler: new CacheFirst({
        cacheName: 'engine',
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 80, maxAgeSeconds: 365 * 86_400 }),
        ],
      }),
    },
    {
      matcher: ({ request, url }) =>
        request.method === 'GET' && !sameOrigin(url) && url.pathname.includes('/assets/examples/'),
      handler: new CacheFirst({
        cacheName: 'example-media',
        plugins: [
          new CacheableResponsePlugin({ statuses: [200] }),
          new ExpirationPlugin({ maxEntries: 120, maxAgeSeconds: 90 * 86_400 }),
          // Each build has its own prefix, so the path names the bytes; the query is a signature.
          { cacheKeyWillBeUsed: async ({ request }) => request.url.split('?')[0] ?? request.url },
        ],
      }),
    },
    {
      matcher: ({ request, url }) => sameOrigin(url) && request.destination === 'image',
      handler: new StaleWhileRevalidate({ cacheName: 'images' }),
    },
  ],
})

self.addEventListener('message', (event) => {
  const data = event.data as { type?: string; url?: unknown } | null
  if (data?.type === 'SKIP_WAITING') void self.skipWaiting()
  if (data?.type === 'CACHE_PAGE' && typeof data.url === 'string') {
    const url = new URL(data.url, self.location.origin)
    if (!sameOrigin(url)) return
    const request = new Request(url, {
      credentials: 'same-origin',
      headers: { accept: 'text/html' },
    })
    event.waitUntil(pages.handle({ request, event }).catch(() => undefined))
  }
})

serwist.addEventListeners()
