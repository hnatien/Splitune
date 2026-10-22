import { Link } from '@tanstack/react-router'
import { UserRoundXIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// After "Delete my account" (15 §4): every session has ended and the node worker is removing the
// account's files and rows.
export function AccountDeleted() {
  return (
    <EmptyState
      icon={<UserRoundXIcon aria-hidden />}
      title={m['privacy.deleted_title']()}
      description={m['privacy.deleted_body']()}
      action={
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          {m['privacy.go_home']()}
        </Link>
      }
    />
  )
}
