import { redirect } from '@tanstack/react-router'
import type { MeData } from '@/lib/session'

/** Sends a signed-out visitor to sign in, then back to `href`. */
export function requireSignIn(me: MeData | null, href: string): asserts me is MeData {
  if (!me) throw redirect({ to: '/auth/sign-in', search: { next: href } })
}
