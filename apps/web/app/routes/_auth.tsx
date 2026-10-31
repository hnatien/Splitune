import { createFileRoute, Outlet } from '@tanstack/react-router'
import { AuthShell } from '@/features/auth/auth-shell'

export const Route = createFileRoute('/_auth')({
  component: () => (
    <AuthShell>
      <Outlet />
    </AuthShell>
  ),
})
