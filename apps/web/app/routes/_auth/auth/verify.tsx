import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { LinkLanding } from '@/features/auth/link-landing'
import { m } from '@/lib/i18n'
import { safeNext } from '@/lib/next-path'

// Magic-link landing (27 §3.4). Better Auth verifies the link at /v1/auth/magic-link/verify and
// sends the browser here: signed in → straight on to `next`; otherwise with ?error=. Better Auth
// reports expired, already used and unknown links alike as INVALID_TOKEN, so they share the
// "expired" copy; a link the visitor already used while still signed in just continues.
export const Route = createFileRoute('/_auth/auth/verify')({
  validateSearch: z.object({ next: z.string().optional(), error: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.me) throw redirect({ href: safeNext(search.next) })
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['auth.sign_in_title']() }) }] }),
  component: Verify,
})

function Verify() {
  const { error } = Route.useSearch()
  return <LinkLanding error={error} />
}
