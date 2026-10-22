import { createFileRoute } from '@tanstack/react-router'
import { SavedPage } from '@/features/onboarding/saved-page'
import { m } from '@/lib/i18n'
import { requireSignIn } from '@/lib/require-sign-in'

// Where "Save your progress?" lands after the magic link (27 §3.3): claims the visitor's progress.
export const Route = createFileRoute('/_focus/start/saved')({
  ssr: false,
  beforeLoad: ({ context, location }) => requireSignIn(context.me, location.href),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['start.saved_title']() }) }] }),
  component: SavedPage,
})
