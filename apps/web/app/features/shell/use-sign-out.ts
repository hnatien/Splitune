import { useQueryClient } from '@tanstack/react-query'
import { useRouter } from '@tanstack/react-router'
import { authClient } from '@/lib/auth-client'

/** Signs out from the account menu or ⌘K and leaves to Home with nothing of the account cached. */
export function useSignOut() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return async () => {
    await authClient.signOut()
    queryClient.clear()
    await router.navigate({ to: '/' })
    await router.invalidate()
  }
}
