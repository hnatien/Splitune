import { createFileRoute, Link, redirect } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { z } from 'zod'
import { m } from '@/lib/i18n'
import { safeNext } from '@/lib/next-path'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Magic-link landing (27 §3.4). Better Auth verifies the link at /v1/auth/magic-link/verify and
// sends the browser here: signed in → straight on to `next`; otherwise with ?error=. Better Auth
// reports expired, already used and unknown links alike as INVALID_TOKEN, so they share the
// "expired" copy; a link the visitor already used while still signed in just continues.
export const Route = createFileRoute('/_bare/auth/verify')({
  validateSearch: z.object({ next: z.string().optional(), error: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.me) throw redirect({ href: safeNext(search.next) })
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['auth.sign_in_title']() }) }] }),
  component: Verify,
})

const EXPIRED = new Set(['INVALID_TOKEN', 'EXPIRED_TOKEN'])

function Verify() {
  const { error } = Route.useSearch()
  const expired = error === undefined || EXPIRED.has(error)
  return (
    <EmptyState
      icon={<LinkIcon aria-hidden />}
      title={m['auth.sign_in_title']()}
      description={expired ? m['auth.link_expired']() : m['auth.link_invalid']()}
      action={
        <Link to="/auth/sign-in" className={buttonVariants({ variant: 'primary' })}>
          {m['auth.send_new']()}
        </Link>
      }
    />
  )
}
