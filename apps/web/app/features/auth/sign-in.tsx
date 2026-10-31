import { Link, useNavigate } from '@tanstack/react-router'
import { ArrowRightIcon, MailCheckIcon } from 'lucide-react'
import type * as React from 'react'
import { useEffect, useId, useState } from 'react'
import { z } from 'zod'
import { authClient, MAGIC_LINK_MINUTES } from '@/lib/auth-client'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { Field, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'

// Sign in or create an account (27 §3.4): one form for both; then "Check your email". The address
// stays in component state, never in the URL.
const RESEND_AFTER_S = 30

const Email = z.email()

/** Emails a magic link that signs in and continues at `next`; the problem's copy, if any. */
export async function sendLink(email: string, next: string): Promise<string | undefined> {
  const { error } = await authClient.signIn.magicLink({
    email,
    callbackURL: `/auth/verify?next=${encodeURIComponent(next)}`,
    errorCallbackURL: '/auth/verify',
  })
  if (!error) return undefined
  return error.status === 429 ? m['error.rate_limited']({ seconds: '60' }) : m['system.error']()
}

export function EmailForm({
  next,
  google,
  onSent,
}: {
  next: string
  google: boolean
  onSent: (email: string) => void
}) {
  const [email, setEmail] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [failure, setFailure] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const errorId = useId()

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const value = email.trim()
    if (!Email.safeParse(value).success) {
      setInvalid(true)
      return
    }
    setSending(true)
    setFailure(undefined)
    const problem = await sendLink(value, next)
    setSending(false)
    if (problem) setFailure(problem)
    else onSent(value)
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl text-balance">{m['auth.sign_in_title']()}</h1>
        <p className="text-base text-muted-foreground">{m['auth.sign_in_lead']()}</p>
      </div>
      <form noValidate onSubmit={submit} className="flex flex-col gap-4">
        <Field data-invalid={invalid || undefined}>
          <FieldLabel htmlFor="email">{m['auth.email_label']()}</FieldLabel>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            placeholder={m['auth.email_placeholder']()}
            value={email}
            aria-invalid={invalid || undefined}
            aria-describedby={invalid ? errorId : undefined}
            onChange={(event) => {
              setEmail(event.target.value)
              setInvalid(false)
            }}
          />
          {invalid && <FieldError id={errorId}>{m['auth.email_invalid']()}</FieldError>}
        </Field>
        {failure && <InlineError title={failure} />}
        <Button type="submit" variant="primary" size="practice-2" loading={sending}>
          {m['auth.email_me_link']()}
          <ArrowRightIcon aria-hidden />
        </Button>
      </form>
      {google && (
        <div className="flex flex-col gap-4">
          <p className="flex items-center gap-3 text-sm text-muted-foreground">
            <span aria-hidden className="h-px flex-1 bg-border" />
            {m['auth.or']()}
            <span aria-hidden className="h-px flex-1 bg-border" />
          </p>
          <Button
            variant="outline"
            size="practice-2"
            onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}
          >
            {m['auth.google']()}
          </Button>
        </div>
      )}
      <p className="border-t border-border pt-6 text-sm text-muted-foreground">
        {m['auth.small_print']()}{' '}
        <Link
          to="/legal/$page"
          params={{ page: 'terms' }}
          className="text-primary underline underline-offset-4"
        >
          {m['legal.terms_title']()}
        </Link>{' '}
        {m['auth.and']()}{' '}
        <Link
          to="/legal/$page"
          params={{ page: 'privacy' }}
          className="text-primary underline underline-offset-4"
        >
          {m['legal.privacy_title']()}
        </Link>{' '}
        {m['auth.small_print_end']()}
      </p>
    </>
  )
}

export function CheckEmail({
  email,
  next,
  mailpitUrl,
  onDifferent,
}: {
  email: string
  next: string
  mailpitUrl: string | undefined
  onDifferent: () => void
}) {
  const [wait, setWait] = useState(RESEND_AFTER_S)
  const [status, setStatus] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  useEffect(() => {
    if (wait <= 0) return
    const timer = setTimeout(() => setWait((s) => s - 1), 1000)
    return () => clearTimeout(timer)
  }, [wait])
  const navigate = useNavigate()

  const resend = async () => {
    setSending(true)
    const problem = await sendLink(email, next)
    setSending(false)
    setStatus(problem ?? m['auth.resent']())
    if (!problem) setWait(RESEND_AFTER_S)
  }

  return (
    <>
      <div className="flex flex-col gap-4">
        <span className="inline-flex size-14 animate-pop-in items-center justify-center rounded-2xl bg-accent text-accent-foreground">
          <MailCheckIcon aria-hidden className="size-7" />
        </span>
        <h1 className="text-3xl text-balance">{m['auth.check_title']()}</h1>
        <p className="text-base text-muted-foreground">
          {m['auth.link_sent']({ email, minutes: String(MAGIC_LINK_MINUTES) })}
        </p>
      </div>
      {mailpitUrl && (
        <a
          href={mailpitUrl}
          target="_blank"
          rel="noreferrer"
          className={buttonVariants({ variant: 'outline' })}
        >
          {m['auth.open_mailpit']()}
        </a>
      )}
      <div className="flex flex-wrap gap-3">
        <Button onClick={resend} disabled={wait > 0} loading={sending}>
          {wait > 0 ? m['auth.resend_in']({ seconds: String(wait) }) : m['auth.resend']()}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            onDifferent()
            void navigate({ to: '/auth/sign-in', search: { next } })
          }}
        >
          {m['auth.use_different']()}
        </Button>
      </div>
      <p role="status" className="min-h-6 text-sm text-muted-foreground">
        {status}
      </p>
    </>
  )
}
