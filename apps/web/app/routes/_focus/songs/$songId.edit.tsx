import { createFileRoute } from '@tanstack/react-router'
import { EditPage } from '@/features/practice/edit-page'
import { PracticeLoading } from '@/features/practice/practice-loading'
import { m } from '@/lib/i18n'
import { requireAudioEngine } from '@/lib/require-audio'
import { requireSignIn } from '@/lib/require-sign-in'

// Edit (27 §3.8): client-only (10 §1), desktop-first; touch devices go to practice.
export const Route = createFileRoute('/_focus/songs/$songId/edit')({
  ssr: false,
  beforeLoad: ({ context, location }) => {
    requireSignIn(context.me, location.href)
    requireAudioEngine()
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['edit.title']() }) }] }),
  pendingComponent: PracticeLoading,
  component: Edit,
})

function Edit() {
  const { songId } = Route.useParams()
  return <EditPage songId={songId} />
}
