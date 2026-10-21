import { createFileRoute, Outlet } from '@tanstack/react-router'
import { MarketingShell } from '@/features/shell/marketing-shell'

export const Route = createFileRoute('/_marketing')({ component: Layout })

function Layout() {
  const { me } = Route.useRouteContext()
  return (
    <MarketingShell signedIn={Boolean(me)}>
      <Outlet />
    </MarketingShell>
  )
}
