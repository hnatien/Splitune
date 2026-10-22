import { CSPProvider } from '@base-ui/react/csp-provider'
import { BACKGROUND_HEX } from '@splitune/ui-tokens'
import { useQueryClient } from '@tanstack/react-query'
import {
  createRootRouteWithContext,
  HeadContent,
  Outlet,
  Scripts,
  useRouter,
  useRouterState,
} from '@tanstack/react-router'
import type * as React from 'react'
import { useEffect } from 'react'
import { DisplaySync } from '@/features/system/display-sync'
import { ErrorPage, NotFoundPage } from '@/features/system/error-page'
import { usePwa } from '@/lib/app-state'
import { m } from '@/lib/i18n'
import { meQuery } from '@/lib/session'
import { DISPLAY_SCRIPT } from '@/ui/display'
import { Toaster } from '@/ui/toast'
import { TooltipProvider } from '@/ui/tooltip'
import type { RouterContext } from '../router'
import appCss from '../styles.css?url'

const ZOD_CONFIG_SCRIPT = 'globalThis.__zod_globalConfig={jitless:true}'

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => ({
    me: await context.queryClient.ensureQueryData(meQuery),
  }),
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { name: 'description', content: m['home.subhead']() },
      // The browser chrome follows the page background (26 §2); Stage and an explicit appearance
      // choice are page-level and not known before the first paint, so this follows the system.
      {
        name: 'theme-color',
        media: '(prefers-color-scheme: light)',
        content: BACKGROUND_HEX.light,
      },
      { name: 'theme-color', media: '(prefers-color-scheme: dark)', content: BACKGROUND_HEX.dark },
      { name: 'apple-mobile-web-app-title', content: 'Splitune' },
      { title: m['meta.title']() },
    ],
    links: [
      { rel: 'icon', href: '/favicon.svg', type: 'image/svg+xml' },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/apple-touch-icon.png' },
      {
        rel: 'preload',
        href: '/fonts/InterVariable.woff2',
        as: 'font',
        type: 'font/woff2',
        crossOrigin: 'anonymous',
      },
      { rel: 'stylesheet', href: appCss },
    ],
    // Before the stylesheet paints: the stored appearance applies with no flash (26 §2). Before any
    // module loads: Zod parses without its `new Function` probe, which the CSP (no 'unsafe-eval',
    // 17 §5) blocks and Firefox reports; Zod reads this global when its core module initialises.
    scripts: [{ children: DISPLAY_SCRIPT }, { children: ZOD_CONFIG_SCRIPT }],
  }),
  shellComponent: RootDocument,
  component: Root,
  notFoundComponent: NotFoundPage,
  errorComponent: ({ error }) => <ErrorPage error={error} />,
})

function Root() {
  const { me } = Route.useRouteContext()
  const queryClient = useQueryClient()
  // Base UI's pre-hydration scripts (Slider) carry the document's CSP nonce (17 §5).
  const nonce = useRouter().options.ssr?.nonce
  // Uploads a previous page left unfinished continue once signed in; loaded on demand so the
  // uploader stays out of pages that never upload.
  // The service worker registers after the first render, outside the route budgets (10 §9).
  useEffect(() => {
    void import('@/lib/pwa').then((pwa) => pwa.registerServiceWorker())
  }, [])
  // Pages reached in the app (not loaded from the server) are kept for offline use too.
  const href = useRouterState({ select: (state) => state.location.href })
  useEffect(() => usePwa.getState().cachePage(href), [href])
  useEffect(() => {
    if (!me) return
    void import('@/features/import/upload-manager').then((uploads) => {
      uploads.connectUploads(queryClient)
      return uploads.resumePendingUploads()
    })
  }, [me, queryClient])
  return (
    <CSPProvider nonce={nonce}>
      <TooltipProvider>
        <Toaster closeLabel={m['system.close']()}>
          <DisplaySync />
          <Outlet />
        </Toaster>
      </TooltipProvider>
    </CSPProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-background font-sans text-foreground antialiased">
        {children}
        <Scripts />
      </body>
    </html>
  )
}
