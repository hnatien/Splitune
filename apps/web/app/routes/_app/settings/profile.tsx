import { createFileRoute } from '@tanstack/react-router'
import { toAccount } from '@/features/settings/account-redirect'

// Profile moved into Account (27 §1 route map).
export const Route = createFileRoute('/_app/settings/profile')({
  beforeLoad: ({ search }) => toAccount('profile', search),
})
