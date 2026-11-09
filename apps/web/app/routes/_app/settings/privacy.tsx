import { createFileRoute } from '@tanstack/react-router'
import { toAccount } from '@/features/settings/account-redirect'

// Privacy moved into Account; `?confirm=delete` (Google re-authentication) is kept (27 §1).
export const Route = createFileRoute('/_app/settings/privacy')({
  beforeLoad: ({ search }) => toAccount('privacy', search),
})
