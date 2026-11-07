import { Link } from '@tanstack/react-router'
import { ArrowRightIcon } from 'lucide-react'
import type * as React from 'react'
import { useId, useState } from 'react'
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

/**
 * Username and password, then a full load of `next` signed in (every cached query starts over).
 * `idPrefix` keeps the ids unique when two forms could share a page.
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
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [problems, setProblems] = useState<Problems>({})
  const [failure, setFailure] = useState<string | undefined>()
  const [sending, setSending] = useState(false)
  const errorId = useId()
  const usernameId = `${idPrefix}-username`
  const passwordId = `${idPrefix}-password`
  const signUp = mode === 'sign-up'

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    const name = username.trim()
    const found = check(mode, name, password)
    setProblems(found)
    if (found.username || found.password) return
    setSending(true)
    setFailure(undefined)
    const problem = await authenticate(mode, name, password)
    if (problem) {
      setSending(false)
      setFailure(problem)
      return
    }
    window.location.assign(next)
  }

  return (
    <form noValidate onSubmit={submit} className="flex flex-col gap-4">
      <Field data-invalid={problems.username ? true : undefined}>
        <FieldLabel htmlFor={usernameId}>{m['auth.username_label']()}</FieldLabel>
        <Input
          id={usernameId}
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={USERNAME_MAX}
          value={username}
          aria-invalid={problems.username ? true : undefined}
          aria-describedby={problems.username ? `${errorId}-username` : undefined}
          onChange={(event) => {
            setUsername(event.target.value)
            setProblems((p) => ({ ...p, username: undefined }))
          }}
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
          id={passwordId}
          type="password"
          autoComplete={signUp ? 'new-password' : 'current-password'}
          maxLength={PASSWORD_MAX}
          value={password}
          aria-invalid={problems.password ? true : undefined}
          aria-describedby={problems.password ? `${errorId}-password` : undefined}
          onChange={(event) => {
            setPassword(event.target.value)
            setProblems((p) => ({ ...p, password: undefined }))
          }}
        />
        {signUp && !problems.password && (
          <FieldDescription>{m['auth.password_hint']()}</FieldDescription>
        )}
        {problems.password && (
          <FieldError id={`${errorId}-password`}>{problems.password}</FieldError>
        )}
      </Field>
      {failure && <InlineError title={failure} />}
      <Button type="submit" variant="primary" size="practice-2" loading={sending}>
        {signUp ? m['auth.submit_sign_up']() : m['auth.submit_sign_in']()}
        <ArrowRightIcon aria-hidden />
      </Button>
    </form>
  )
}

/** The sign-in or sign-up page: heading, the form, Google when configured, and the other mode. */
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
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl text-balance">
          {signUp ? m['auth.sign_up_title']() : m['auth.sign_in_title']()}
        </h1>
        <p className="text-base text-muted-foreground">
          {signUp ? m['auth.sign_up_lead']() : m['auth.sign_in_lead']()}
        </p>
      </div>
      <CredentialsForm mode={mode} next={next} />
      <p className="text-sm text-muted-foreground">
        {signUp ? m['auth.have_account']() : m['auth.new_here']()}{' '}
        <Link
          to={signUp ? '/auth/sign-in' : '/auth/sign-up'}
          search={{ next }}
          className="text-primary underline underline-offset-4"
        >
          {signUp ? m['auth.sign_in_title']() : m['auth.sign_up_title']()}
        </Link>
      </p>
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
