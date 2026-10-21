import { createFileRoute, Outlet, redirect } from '@tanstack/react-router'
import { AppShell } from '@/features/shell/app-shell'

// Library, import and settings need an account; the sign-in page brings the visitor back here.
export const Route = createFileRoute('/_app')({
  beforeLoad: ({ context, location }) => {
    if (!context.me) throw redirect({ to: '/auth/sign-in', search: { next: location.href } })
    return { me: context.me }
  },
  component: Layout,
})

function Layout() {
  const { me } = Route.useRouteContext()
  return (
    <AppShell me={me}>
      <Outlet />
    </AppShell>
  )
}
