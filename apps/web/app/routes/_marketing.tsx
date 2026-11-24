import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MarketingShell } from '@/features/shell/marketing-shell'
import { ErrorMessage } from '@/features/system/error-page'
import { useSignedIn } from '@/features/system/system-message'

// The marketing pages (27 §1). A page that fails keeps the marketing shell: the error replaces this
// layout, so it brings the shell with it and the visitor keeps the navigation (27 §3.11).
export const Route = createFileRoute('/_marketing')({
  component: Layout,
  errorComponent: ({ error }) => <LayoutError error={error} />,
})

function Layout() {
  const { me } = Route.useRouteContext()
  return (
    <MarketingShell signedIn={Boolean(me)}>
      <Outlet />
    </MarketingShell>
  )
}

function LayoutError({ error }: { error: unknown }) {
  return (
    <MarketingShell signedIn={useSignedIn()}>
      <div className="mx-auto w-full max-w-bare px-4">
        <ErrorMessage error={error} />
      </div>
    </MarketingShell>
  )
}
