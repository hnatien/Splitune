import { Link } from '@tanstack/react-router'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { SystemCard, SystemText } from './system-card'

// After "Delete my account" (15 §4): every session has ended and the node worker is removing the
// account's files and rows. The system-page card (27 §3.11).
export function AccountDeleted() {
  return (
    <SystemCard
      title={m['privacy.deleted_title']()}
      actions={
        <Link to="/" className={buttonVariants({ variant: 'primary' })}>
          {m['privacy.go_home']()}
        </Link>
      }
    >
      <SystemText>{m['privacy.deleted_body']()}</SystemText>
    </SystemCard>
  )
}
