import { Instrument, Level } from '@splitune/contracts'
import { createFileRoute } from '@tanstack/react-router'
import { useEffect } from 'react'
import { z } from 'zod'
import { guestStore } from '@/features/onboarding/guest-store'
import { OnboardingPage } from '@/features/onboarding/onboarding-page'
import { m } from '@/lib/i18n'

// Onboarding (27 §3.3, 13 §1): SSR shell; the example song's practice screen is client-only.
// The step and the answers are search params, so Back and reload keep them.
const Search = z.object({
  step: z.enum(['instrument', 'level', 'screen', 'song']).optional().catch(undefined),
  instrument: Instrument.optional().catch(undefined),
  level: Level.optional().catch(undefined),
})

export const Route = createFileRoute('/_focus/start/')({
  validateSearch: Search,
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['start.title']() }) }] }),
  component: Start,
})

function Start() {
  const { me } = Route.useRouteContext()
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const { instrument = null, level = null } = search
  // The answers, and when this visitor first arrived (time to first loop, 16 §2), for the claim.
  useEffect(() => {
    if (me) return
    void guestStore.all('profile').then(([profile]) =>
      guestStore.put('profile', {
        id: 'me',
        instrument,
        level,
        landedAt: profile?.landedAt ?? Date.now(),
      }),
    )
  }, [me, instrument, level])
  return (
    <OnboardingPage
      search={search}
      signedIn={Boolean(me)}
      go={(next) => void navigate({ search: next })}
    />
  )
}
