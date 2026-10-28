import { createFileRoute } from '@tanstack/react-router'
import { lazy, Suspense } from 'react'
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
  level: z
    .enum(['chords_only', 'simplified', 'as_transcribed', 'roots', 'full', 'core_groove'])
    .optional()
    .catch(undefined),
  // Onboarding's steps 4–5 over an example song (27 §3.3).
  guide: z.boolean().optional().catch(undefined),
})

// Visitors only: the onboarding guide loads on demand, outside the route's JS budget (12 §10).
const OnboardingGuide = lazy(() =>
  import('@/features/onboarding/guide').then((module) => ({ default: module.OnboardingGuide })),
)

export const Route = createFileRoute('/_focus/songs/$songId/practice')({
  ssr: false,
  validateSearch: Search,
  // A signed-out visitor may practise an example song, kept on the device until they sign in
  // (13 §1); every other song needs an account.
  beforeLoad: async ({ context, location, params }) => {
    let guest = false
    if (!context.me) {
      const { enterAsGuest } = await import('@/features/onboarding/guest-entry')
      guest = await enterAsGuest(context.queryClient, params.songId)
      if (!guest) requireSignIn(context.me, location.href)
    }
    requireAudioEngine()
    return { guest }
  },
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['practice.title']() }) }] }),
  pendingComponent: PracticeLoading,
  component: Practice,
})

function Practice() {
  const { songId } = Route.useParams()
  const { guide, ...search } = Route.useSearch()
  const { guest } = Route.useRouteContext()
  return (
    <PracticePage songId={songId} search={search} guest={guest}>
      {guest && guide && (
        <Suspense fallback={null}>
          <OnboardingGuide />
        </Suspense>
      )}
    </PracticePage>
  )
}
