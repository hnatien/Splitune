import { createFileRoute, redirect } from '@tanstack/react-router'
import { useState } from 'react'
import { z } from 'zod'
import { CheckEmail, EmailForm } from '@/features/auth/sign-in'
import { m } from '@/lib/i18n'
import { safeNext } from '@/lib/next-path'
import { getAuthOptions } from '@/server/auth-options'

export const Route = createFileRoute('/_bare/auth/sign-in')({
  validateSearch: z.object({ next: z.string().optional() }),
  beforeLoad: ({ context, search }) => {
    if (context.me) throw redirect({ href: safeNext(search.next) })
  },
  loader: () => getAuthOptions(),
  head: () => ({ meta: [{ title: m['meta.page']({ page: m['auth.sign_in_title']() }) }] }),
  component: SignIn,
})

function SignIn() {
  const { next } = Route.useSearch()
  const options = Route.useLoaderData()
  const [sentTo, setSentTo] = useState<string | undefined>()
  return sentTo ? (
    <CheckEmail
      email={sentTo}
      next={safeNext(next)}
      mailpitUrl={options.mailpitUrl}
      onDifferent={() => setSentTo(undefined)}
    />
  ) : (
    <EmailForm next={safeNext(next)} google={options.google} onSent={setSentTo} />
  )
}
