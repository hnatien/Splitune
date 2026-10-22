import { Link } from '@tanstack/react-router'
import { LinkIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Magic-link landing (27 §3.4). Better Auth reports expired, already used and unknown links alike
// as INVALID_TOKEN, so they share the "expired" copy; other errors get the "invalid" copy.
const EXPIRED = new Set(['INVALID_TOKEN', 'EXPIRED_TOKEN'])

/** The landing's error states; `error` is Better Auth's code from the redirect. */
export function LinkLanding({ error }: { error?: string | undefined }) {
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
