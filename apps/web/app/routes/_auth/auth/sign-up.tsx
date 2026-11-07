import { createFileRoute, redirect } from '@tanstack/react-router'
import { z } from 'zod'
import { AuthScreen } from '@/features/auth/sign-in'
import { m } from '@/lib/i18n'
import { safeNext } from '@/lib/next-path'
import { getAuthOptions } from '@/server/auth-options'

export const Route = createFileRoute('/_auth/auth/sign-up')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.me) throw redirect({ href: safeNext(search.next) })
  },
  loader: () => getAuthOptions(),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['auth.sign_up_title']() }) }] }),
  component: SignUp,
})

function SignUp() {
  const { next } = Route.useSearch()
  const { google } = Route.useLoaderData()
  return <AuthScreen mode="sign-up" next={safeNext(next)} google={google} />
}
