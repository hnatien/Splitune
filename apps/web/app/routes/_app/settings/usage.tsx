import { createFileRoute } from '@tanstack/react-router'
import { UsageSettings } from '@/features/settings/usage-settings'

// Usage: the analysis allowances this period and the plan they come from, with the way to Plus.
export const Route = createFileRoute('/_app/settings/usage')({
  component: Usage,
})

function Usage() {
  const { me } = Route.useRouteContext()
  return <UsageSettings me={me} />
}
