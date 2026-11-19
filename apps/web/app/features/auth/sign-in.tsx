import { Link } from '@tanstack/react-router'
import type * as React from 'react'
import { useId, useRef, useState } from 'react'
import { z } from 'zod'
import { authClient, PASSWORD_MIN, USERNAME_MAX, USERNAME_MIN } from '@/lib/auth-client'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Field, FieldDescription, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'

// Sign in and create an account (27 §3.4, 25 personal mode): a username and a password, nothing
// to confirm by email. The same form serves the auth pages and "Save your progress?".

export type AuthMode = 'sign-in' | 'sign-up'

// Better Auth's username plugin: letters, digits, dots and underscores (apps/api/src/auth.ts).
const Username = z
  .string()
  .min(USERNAME_MIN)
  .max(USERNAME_MAX)
  .regex(/^[a-zA-Z0-9_.]+$/)

const PASSWORD_MAX = 128

/** Signs in, or creates the account and signs in; the problem's copy, if any. */
export async function authenticate(
  mode: AuthMode,
  username: string,
  password: string,
): Promise<string | undefined> {
  // Sign-up goes through $fetch: the server derives the account's email from the username.
  const { error } =
    mode === 'sign-in'
      ? await authClient.signIn.username({ username, password })
      : await authClient.$fetch('/sign-up/email', {
          method: 'POST',
          body: { username, password, name: '' },
        })
  if (!error) return undefined
  if (error.status === 429) return m['error.rate_limited']({ seconds: '60' })
  const { code } = error as { code?: unknown }
  if (code === 'INVALID_USERNAME_OR_PASSWORD') return m['auth.wrong_credentials']()
  if (code === 'USERNAME_IS_ALREADY_TAKEN') return m['auth.username_taken']()
  return m['system.error']()
}

// The credential fields are 52 px tall, a step above the 44 px browse control: the form is the page.
const FIELD = 'min-h-13'

interface Problems {
  username?: string | undefined
  password?: string | undefined
}

function check(mode: AuthMode, username: string, password: string): Problems {
  if (mode === 'sign-in') {
    return {
      username: username ? undefined : m['auth.username_missing'](),
      password: password ? undefined : m['auth.password_missing'](),
    }
  }
  return {
    username: Username.safeParse(username).success ? undefined : m['auth.username_invalid'](),
    password: password.length >= PASSWORD_MIN ? undefined : m['auth.password_invalid'](),
  }
}

/** Which field a server answer belongs under (27 §3.4: errors under the field, with an icon). */
function fieldFor(problem: string): keyof Problems | undefined {
  if (problem === m['auth.wrong_credentials']()) return 'password'
  if (problem === m['auth.username_taken']()) return 'username'
  return undefined
}

/**
 * Username and password, then a full load of `next` signed in (every cached query starts over).
 * `idPrefix` keeps the ids unique when two forms could share a page. The fields are uncontrolled
 * and read on submit: text typed before hydration stays in the field and is what gets sent (a
 * controlled field would be reset to its empty state on the first render after hydration).
 */
export function CredentialsForm({
  mode,
  next,
  idPrefix = 'auth',
}: {
  mode: AuthMode
  next: string
  idPrefix?: string
}) {
  const usernameField = useRef<HTMLInputElement>(null)
  const passwordField = useRef<HTMLInputElement>(null)
  const [problems, setProblems] = useState<Problems>({})
  const [failure, setFailure] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const errorId = useId()
  const usernameId = `${idPrefix}-username`
  const passwordId = `${idPrefix}-password`
  const signUp = mode === 'sign-up'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = usernameField.current?.value.trim() ?? ''
    const password = passwordField.current?.value ?? ''
    const found = check(mode, name, password)
    setProblems(found)
    setFailure(undefined)
    if (found.username || found.password) return
    setSending(true)
    const problem = await authenticate(mode, name, password)
    if (problem) {
      setSending(false)
      const field = fieldFor(problem)
      if (field) setProblems({ [field]: problem })
      else setFailure(problem)
      return
    }
    window.location.assign(next)
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={problems.username ? true : undefined}>
        <FieldLabel htmlFor={usernameId}>{m['auth.username_label']()}</FieldLabel>
        <Input
          ref={usernameField}
          id={usernameId}
          className={FIELD}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          aria-invalid={problems.username ? true : undefined}
          aria-describedby={problems.username ? `${errorId}-username` : undefined}
          onChange={() => setProblems((p) => ({ ...p, username: undefined }))}
        />
        {signUp && !problems.username && (
          <FieldDescription>{m['auth.username_hint']()}</FieldDescription>
        )}
        {problems.username && (
          <FieldError id={`${errorId}-username`}>{problems.username}</FieldError>
        )}
      </Field>
      <Field data-invalid={problems.password ? true : undefined}>
        <FieldLabel htmlFor={passwordId}>{m['auth.password_label']()}</FieldLabel>
        <Input
          ref={passwordField}
          id={passwordId}
          className={FIELD}
          type="password"
          autoComplete={signUp ? 'new-password' : 'current-password'}
          maxLength={PASSWORD_MAX}
          aria-invalid={problems.password ? true : undefined}
          aria-describedby={problems.password ? `${errorId}-password` : undefined}
          onChange={() => setProblems((p) => ({ ...p, password: undefined }))}
        />
        {signUp && !problems.password && (
          <FieldDescription>{m['auth.password_hint']()}</FieldDescription>
        )}
        {problems.password && (
          <FieldError id={`${errorId}-password`}>{problems.password}</FieldError>
        )}
      </Field>
      {failure && <InlineError title={failure} />}
      <Button type="submit" variant="primary" size="lg" block loading={sending}>
        {signUp ? m['auth.submit_sign_up']() : m['auth.submit_sign_in']()}
      </Button>
    </form>
  )
}

const LINK = 'text-foreground underline underline-offset-4 hover:decoration-2'
// The terms keep the small print's colour; the underline marks them as links.
const SMALL_LINK = 'underline underline-offset-4 hover:text-foreground'

/**
 * The sign-in or sign-up page (27 §3.4): a centred heading and lead, the form, Google when
 * configured (after an "or" rule), the way to the other mode, and the terms at the foot of the page.
 */
export function AuthScreen({
  mode,
  next,
  google,
}: {
  mode: AuthMode
  next: string
  google: boolean
}) {
  const signUp = mode === 'sign-up'
  return (
    <>
      <div className="my-auto flex flex-col gap-6 py-10 sm:py-16">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="text-2xl text-balance">
            {signUp ? m['auth.sign_up_title']() : m['auth.sign_in_title']()}
          </h1>
          <p className="text-base text-muted-foreground">
            {signUp ? m['auth.sign_up_lead']() : m['auth.sign_in_lead']()}
          </p>
        </div>
        <CredentialsForm mode={mode} next={next} />
        {google && (
          <>
            <p className="flex items-center gap-3 text-sm text-faint-foreground">
              <span aria-hidden className="h-px flex-1 bg-border" />
              {m['auth.or']()}
              <span aria-hidden className="h-px flex-1 bg-border" />
            </p>
            <Button
              variant="outline"
              size="lg"
              block
              onClick={() => authClient.signIn.social({ provider: 'google', callbackURL: next })}
            >
              {m['auth.google']()}
            </Button>
          </>
        )}
        <p className="text-center text-sm text-muted-foreground">
          {signUp ? m['auth.have_account']() : m['auth.new_here']()}{' '}
          <Link to={signUp ? '/auth/sign-in' : '/auth/sign-up'} search={{ next }} className={LINK}>
            {signUp ? m['auth.sign_in_title']() : m['auth.sign_up_title']()}
          </Link>
          {signUp ? null : m['auth.no_email']()}
        </p>
      </div>
      <p className="pb-6 text-center text-sm text-faint-foreground">
        {m['auth.small_print']()}{' '}
        <Link to="/legal/$page" params={{ page: 'terms' }} className={SMALL_LINK}>
          {m['legal.terms_title']()}
        </Link>{' '}
        {m['auth.and']()}{' '}
        <Link to="/legal/$page" params={{ page: 'privacy' }} className={SMALL_LINK}>
          {m['legal.privacy_title']()}
        </Link>{' '}
        {m['auth.small_print_end']()}
      </p>
    </>
  )
}
