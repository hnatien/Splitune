import { createFileRoute, redirect } from '@tanstack/react-router'

// `/settings` opens Account (27 §1 route map).
export const Route = createFileRoute('/_app/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/account', replace: true })
  },
})
