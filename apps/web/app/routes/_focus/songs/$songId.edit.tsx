import { createFileRoute, Link } from '@tanstack/react-router'
import { PencilRulerIcon } from 'lucide-react'
import { FocusShell } from '@/features/shell/focus-shell'
import { m } from '@/lib/i18n'
import { requireSignIn } from '@/lib/require-sign-in'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Edit (27 §3.8): reserved route, client-only (10 §1); the desktop editor arrives with step 12.
export const Route = createFileRoute('/_focus/songs/$songId/edit')({
  ssr: false,
  beforeLoad: ({ context, location }) => requireSignIn(context.me, location.href),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['edit.title']() }) }] }),
  component: Edit,
})

function Edit() {
  const { songId } = Route.useParams()
  return (
    <FocusShell>
      <EmptyState
        icon={<PencilRulerIcon aria-hidden />}
        title={m['edit.title']()}
        description={m['edit.coming']()}
        action={
          <Link
            to="/songs/$songId/practice"
            params={{ songId }}
            className={buttonVariants({ variant: 'primary' })}
          >
            {m['edit.open_practice']()}
          </Link>
        }
      />
    </FocusShell>
  )
}
