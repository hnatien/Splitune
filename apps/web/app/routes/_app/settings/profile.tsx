import { createFileRoute } from '@tanstack/react-router'
import { ProfileSettings } from '@/features/settings/profile-settings'

export const Route = createFileRoute('/_app/settings/profile')({ component: Profile })

function Profile() {
  const { me } = Route.useRouteContext()
  return <ProfileSettings me={me} />
}
