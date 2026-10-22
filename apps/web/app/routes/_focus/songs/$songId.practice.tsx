import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { PracticeLoading } from '@/features/practice/practice-loading'
import { PracticePage } from '@/features/practice/practice-page'
import { m } from '@/lib/i18n'
import { requireAudioEngine } from '@/lib/require-audio'
import { requireSignIn } from '@/lib/require-sign-in'

// Practice (12, 27 §3.7): client-only (10 §1), the progressive practice screen. Typed search params
// make setups bookmarkable (?view=tab|chords&loop=17-20&speed=70&mix=minus-one; bars 1-based).
const Search = z.object({
  view: z.enum(['tab', 'chords']).optional().catch(undefined),
  loop: z
    .string()
    .regex(/^\d+-\d+$/)
    .optional()
    .catch(undefined),
  speed: z.coerce.number().int().min(25).max(200).optional().catch(undefined),
  mix: z.enum(['your-part', 'minus-one', 'original']).optional().catch(undefined),
})

export const Route = createFileRoute('/_focus/songs/$songId/practice')({
  ssr: false,
  validateSearch: Search,
  beforeLoad: ({ context, location }) => {
    requireSignIn(context.me, location.href)
    requireAudioEngine()
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['practice.title']() }) }] }),
  pendingComponent: PracticeLoading,
  component: Practice,
})

function Practice() {
  const { songId } = Route.useParams()
  const search = Route.useSearch()
  return <PracticePage songId={songId} search={search} />
}
