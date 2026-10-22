import { useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { hasGuestProgress } from './marker'

/**
 * Claims a visitor's progress at the first signed-in page of the app shell (13 §1: "merged into
 * the account on first sign-in"); /start/saved, where onboarding's sign-in lands, claims it too.
 */
export function useClaimOnSignIn() {
  const queryClient = useQueryClient()
  useEffect(() => {
    if (!hasGuestProgress()) return
    void import('./claim').then((claim) =>
      // Not claimed (offline, API away): it stays on the device and the next page retries.
      claim.claimGuestProgress(queryClient).catch(() => undefined),
    )
  }, [queryClient])
}
