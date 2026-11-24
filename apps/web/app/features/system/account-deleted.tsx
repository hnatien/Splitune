import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { SystemMessage, SystemText } from './system-message'

// After "Delete my account" (15 §4): every session has ended and the node worker is removing the
// account's files and rows. A system page (27 §3.11): what happened, what it means, the way home.
export function AccountDeleted() {
  return (
    <SystemMessage
      title={m['privacy.deleted_title']()}
      actions={
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          {m['privacy.go_home']()}
        </Link>
      }
    >
      <SystemText>{m['privacy.deleted_body']()}</SystemText>
    </SystemMessage>
  )
}
