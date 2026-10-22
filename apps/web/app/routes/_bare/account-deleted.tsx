import { createFileRoute } from '@tanstack/react-router'
import { AccountDeleted } from '@/features/system/account-deleted'
import { m } from '@/lib/i18n'

export const Route = createFileRoute('/_bare/account-deleted')({
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['privacy.deleted_title']() }) }] }),
  component: AccountDeleted,
})
