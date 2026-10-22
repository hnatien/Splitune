import { usePwa } from './app-state'

// The PWA's page side (10 §6), loaded after the first render: registers /sw.js (production builds
// only; Vite's dev server has none), notices a new version waiting to take over (27 §3.11 "A new
// version is ready"; the banner waits while audio plays), and asks for persistent storage once the
// app is installed, so cached songs aren't evicted under storage pressure.

let waiting: ServiceWorker | null = null
let reloadOnTakeOver = false

export function registerServiceWorker() {
  if (import.meta.env.DEV || !('serviceWorker' in navigator)) return
  const offer = (worker: ServiceWorker | null) => {
    // The very first install takes over silently; only a replacement needs the reload.
    if (!worker || !navigator.serviceWorker.controller) return
    waiting = worker
    usePwa.setState({ updateReady: true })
  }
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((registration) => {
      offer(registration.waiting)
      registration.addEventListener('updatefound', () => {
        const installing = registration.installing
        installing?.addEventListener('statechange', () => {
          if (installing.state === 'installed') offer(installing)
        })
      })
    })
    .catch(() => {
      // No service worker (private mode, blocked): the app works online as before.
    })
  // The first version takes over without a reload (clientsClaim): the page it found is kept too.
  const keepCurrentPage = () => usePwa.getState().cachePage(window.location.href)
  if (navigator.serviceWorker.controller) keepCurrentPage()
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloadOnTakeOver) window.location.reload()
    else keepCurrentPage()
  })
  window.addEventListener('appinstalled', () => void persistStorage())
  if (isStandalone()) void persistStorage()
}

// The pages worth opening offline (10 §6): onboarding, the library and a song's practice screen.
const OFFLINE_PAGES = /^\/(?:start|library|songs\/[^/]+\/practice)(?:[/?]|$)/
const cached = new Set<string>()

usePwa.setState({
  cachePage: (href) => {
    const controller = navigator.serviceWorker?.controller
    const path = new URL(href, window.location.origin).pathname
    if (!controller || cached.has(href) || !OFFLINE_PAGES.test(path)) return
    cached.add(href)
    controller.postMessage({ type: 'CACHE_PAGE', url: href })
  },
  // Lets the waiting version take over; the page reloads once it has.
  applyUpdate: () => {
    if (!waiting) return
    reloadOnTakeOver = true
    waiting.postMessage({ type: 'SKIP_WAITING' })
  },
})

function isStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

async function persistStorage() {
  if (!navigator.storage?.persist || (await navigator.storage.persisted())) return
  await navigator.storage.persist()
}
