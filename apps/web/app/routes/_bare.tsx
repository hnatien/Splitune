import { createFileRoute, Outlet } from '@tanstack/react-router'
import { BareShell } from '@/features/shell/bare-shell'

export const Route = createFileRoute('/_bare')({
  component: () => (
    <BareShell>
      <Outlet />
    </BareShell>
  ),
})
