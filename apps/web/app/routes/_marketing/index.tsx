import { createFileRoute } from '@tanstack/react-router'
import { Home } from '@/features/marketing/home'

export const Route = createFileRoute('/_marketing/')({ component: Page })

function Page() {
  const { me } = Route.useRouteContext()
  return <Home signedIn={Boolean(me)} />
}
