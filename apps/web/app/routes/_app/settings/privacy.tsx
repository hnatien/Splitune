import { createFileRoute } from '@tanstack/react-router'
import { PrivacySettings } from '@/features/settings/privacy-settings'

// Privacy (27 §3.9); `?confirm=delete` is where the re-authentication link for account deletion
// returns, with the confirmation open.
export const Route = createFileRoute('/_app/settings/privacy')({ component: Privacy })

function Privacy() {
  const { me } = Route.useRouteContext()
  const { confirm }: { confirm?: unknown } = Route.useSearch()
  return <PrivacySettings me={me} deleteDialog={confirm === 'delete' ? 'confirm' : undefined} />
}
