import { createFileRoute } from '@tanstack/react-router'
import { toAccount } from '@/features/settings/account-redirect'

// Plan & billing is the Plan section now; the mock checkout and portal still return here with
// `?checkout=`, which the redirect keeps (27 §1 route map, §3.10).
export const Route = createFileRoute('/_app/settings/billing')({
  beforeLoad: ({ search }) => toAccount('plan', search),
})
