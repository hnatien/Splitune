import { createFileRoute, Link } from '@tanstack/react-router'
import { GuitarIcon } from 'lucide-react'
import { FocusShell } from '@/features/shell/focus-shell'
import { m } from '@/lib/i18n'
import { buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'

// Onboarding (27 §3.3) is step 13; until then /start points to importing a song.
export const Route = createFileRoute('/_focus/start')({
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['start.title']() }) }] }),
  component: Start,
})

function Start() {
  const { me } = Route.useRouteContext()
  return (
    <FocusShell exit={!me}>
      <EmptyState
        icon={<GuitarIcon aria-hidden />}
        title={m['start.title']()}
        description={m['start.coming']()}
        action={
          me ? (
            <Link to="/import" className={buttonVariants({ variant: 'primary' })}>
              {m['library.import_song']()}
            </Link>
          ) : (
            <Link to="/auth/sign-in" className={buttonVariants({ variant: 'primary' })}>
              {m['nav.sign_in']()}
            </Link>
          )
        }
      />
    </FocusShell>
  )
}
