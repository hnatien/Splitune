import { Link, useRouter } from '@tanstack/react-router'
import { CheckIcon, CopyIcon, RotateCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { BareShell } from '../shell/bare-shell'
import { SystemMessage, SystemText, useSignedIn } from './system-message'

// System pages (27 §3.11): the 404 with its quiet number, and the error boundary with a copyable
// error id. The id is logged with the error so a report can be matched to it; the message itself
// is never shown. The way out fits who is reading: the library when signed in, the home page (and
// the example song) when not, so a visitor is never sent to a page that bounces them to sign in.
// The messages stand alone so a route group can show them inside its own shell (the marketing
// pages keep their navigation); the pages put them in the bare shell.

export function NotFoundMessage() {
  const signedIn = useSignedIn()
  return (
    <SystemMessage
      title={m['system.not_found']()}
      marker={
        <span aria-hidden className="text-heading text-muted-foreground tabular-nums">
          404
        </span>
      }
      actions={
        signedIn ? (
          <Link to="/library" className={buttonVariants({ variant: 'primary' })}>
            {m['system.go_library']()}
          </Link>
        ) : (
          <>
            <Link to="/" className={buttonVariants({ variant: 'primary' })}>
              {m['privacy.go_home']()}
            </Link>
            <Link to="/start" className={buttonVariants({ variant: 'quiet' })}>
              {m['home.cta_example']()}
            </Link>
          </>
        )
      }
    >
      <SystemText>{m['system.not_found_hint']()}</SystemText>
    </SystemMessage>
  )
}

export function NotFoundPage() {
  return (
    <BareShell>
      <NotFoundMessage />
    </BareShell>
  )
}

export function ErrorMessage({ error }: { error: unknown }) {
  const router = useRouter()
  const signedIn = useSignedIn()
  const [id] = useState(() => crypto.randomUUID().slice(0, 8))
  const [copied, setCopied] = useState(false)
  // The browser console is the only error sink until step 15 adds telemetry.
  useEffect(() => console.error(`screen error ${id}`, error), [id, error])
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <SystemMessage
      title={m['system.error']()}
      actions={
        <>
          <Button variant="primary" onClick={() => router.invalidate()}>
            <RotateCwIcon aria-hidden />
            {m['system.reload']()}
          </Button>
          {signedIn ? (
            <Link to="/library" className={buttonVariants({ variant: 'quiet' })}>
              {m['system.go_library']()}
            </Link>
          ) : (
            <Link to="/" className={buttonVariants({ variant: 'quiet' })}>
              {m['privacy.go_home']()}
            </Link>
          )}
        </>
      }
    >
      <SystemText>{m['system.error_body']()}</SystemText>
      <div className="flex flex-wrap items-center gap-x-2">
        <p className="text-body-sm text-muted-foreground tabular-nums">
          {m['system.error_id']({ id })}
        </p>
        <Button variant="quiet" size="sm" onClick={copy}>
          {copied ? <CheckIcon aria-hidden /> : <CopyIcon aria-hidden />}
          {copied ? m['system.error_id_copied']() : m['system.copy_error_id']()}
        </Button>
      </div>
    </SystemMessage>
  )
}

export function ErrorPage({ error }: { error: unknown }) {
  return (
    <BareShell>
      <ErrorMessage error={error} />
    </BareShell>
  )
}
