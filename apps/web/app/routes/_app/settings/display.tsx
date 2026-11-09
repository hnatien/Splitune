import { createFileRoute } from '@tanstack/react-router'
import { DisplaySettings } from '@/features/settings/display-settings'

// Display & practice (27 §3.9); Left-handed is stored on the account, so it needs `me`.
export const Route = createFileRoute('/_app/settings/display')({ component: Display })

function Display() {
  const { me } = Route.useRouteContext()
  return <DisplaySettings me={me} />
}
