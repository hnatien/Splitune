import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { privacyContract } from '@splitune/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DownloadIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { client, clientFor, errorData } from '@/lib/api'
import { authClient } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { useOnline } from '@/lib/use-online'
import { cn } from '@/lib/utils'
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/ui/alert-dialog'
import { Button, buttonVariants } from '@/ui/button'
import { Field, FieldError, FieldLabel } from '@/ui/field'
import { Input } from '@/ui/input'
import { InlineError } from '@/ui/status-message'
import { WorkerStatus } from '@/ui/worker-status'
import { authenticate } from '../auth/sign-in'
import { workerStatusQuery } from '../library/queries'
import { SettingRows, SettingSection, SwitchSetting } from './setting-row'

// Settings → Account → Privacy (27 §3.9, 15 §4, Settings-Account): the training opt-in (stored
// only; nothing trains on it yet), the "Download my data" row (the node worker prepares a file kept
// for 24 h) and the "Delete my account" row (its confirmation lists what goes; a sign-in within 10
// minutes is required, so a stale session asks for the password again, or for Google again on an
// account without one). None of these is a filled control (26 §4.5). Offline, each control says
// "Unavailable offline" in its name and the line above the rows says why.

// Its own client (contracts `privacyContract`): only this page carries the privacy schemas.
const privacyClient = clientFor(privacyContract)
const privacyOrpc = createTanstackQueryUtils(privacyClient)

export const exportStateQuery = (pending: boolean) =>
  privacyOrpc.me.exportState.queryOptions({ refetchInterval: pending ? 5_000 : false })

// 403 details.reason from requireRecentAuth (apps/api auth.ts).
const reauthRequired = (error: unknown) =>
  (errorData(error) as { reason?: unknown }).reason === 'reauth_required'

// Where Google re-authentication returns to.
export const CONFIRM_DELETE_PATH = '/settings/account?confirm=delete#privacy'

export type DeleteStep = 'confirm' | 'reauth'

export function PrivacySettings({
  me,
  deleteDialog,
}: {
  me: MeData
  /** Opens "Delete my account" at this step (Google re-authentication returns to confirm). */
  deleteDialog?: DeleteStep | undefined
}) {
  const online = useOnline()
  return (
    <SettingSection id="privacy" title={m['settings.privacy']()}>
      {!online && <InlineError tone="info" title={m['privacy.offline']()} />}
      <SettingRows>
        <TrainingOptIn me={me} disabled={!online} />
        <DataExport disabled={!online} />
        <DeleteAccount me={me} disabled={!online} initial={deleteDialog} />
      </SettingRows>
    </SettingSection>
  )
}

function TrainingOptIn({ me, disabled }: { me: MeData; disabled: boolean }) {
  const queryClient = useQueryClient()
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  return (
    <SwitchSetting
      label={m['privacy.training_label']()}
      hint={m['privacy.training_hint']()}
      checked={current.training_opt_in}
      disabled={disabled}
      onChange={async (on) =>
        queryClient.setQueryData(meQuery.queryKey, await client.me.update({ training_opt_in: on }))
      }
    />
  )
}

function DataExport({ disabled }: { disabled: boolean }) {
  const queryClient = useQueryClient()
  const [pending, setPending] = useState(false)
  const state = useQuery(exportStateQuery(pending))
  const status = state.data?.status
  useEffect(() => setPending(status === 'pending'), [status])
  const worker = useQuery({ ...workerStatusQuery, enabled: status === 'pending' })
  const request = useMutation({
    mutationFn: () => privacyClient.me.export(),
    onSuccess: (next) => queryClient.setQueryData(exportStateQuery(false).queryKey, next),
  })
  const start = (
    <Button
      variant={status === 'ready' ? 'quiet' : 'outline'}
      loading={request.isPending}
      disabled={disabled}
      unavailableLabel={m['settings.unavailable_offline']()}
      onClick={() => request.mutate()}
    >
      {status === 'ready' || status === 'failed'
        ? m['privacy.export_again']()
        : m['privacy.export_start']()}
    </Button>
  )
  const ready = status === 'ready' && state.data?.url ? state.data : undefined
  // A failed file says so with the way to try again inside the message, not before it.
  const failed = status === 'failed' || request.isError
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <DownloadIcon
        aria-hidden
        strokeWidth={1.8}
        className={cn('size-5 shrink-0', ready ? 'text-success' : 'text-muted-foreground')}
      />
      <div className="flex min-w-0 grow basis-75 flex-col gap-0.5">
        <h3 className="text-label">{m['privacy.export_title']()}</h3>
        <p role="status" className="text-body-sm text-muted-foreground">
          {status === 'pending'
            ? m['privacy.export_pending']()
            : ready
              ? m['privacy.export_ready']({
                  date: formatDateTime(new Date(ready.expires_at ?? Date.now())),
                })
              : m['privacy.export_body']()}
        </p>
      </div>
      {ready?.url && (
        <a href={ready.url} download className={buttonVariants({ variant: 'outline' })}>
          <DownloadIcon aria-hidden />
          {m['privacy.export_download']()}
        </a>
      )}
      {!(state.isError && !state.data) &&
        status !== undefined &&
        status !== 'pending' &&
        !failed &&
        start}
      {state.isError && !state.data && (
        <InlineError
          className="basis-full"
          title={m['privacy.export_unavailable']()}
          actions={
            <Button variant="outline" onClick={() => state.refetch()}>
              {m['common.try_again']()}
            </Button>
          }
        />
      )}
      {status === 'pending' && worker.data && !worker.data.runners.node.online && (
        <WorkerStatus online={false} text={m['privacy.export_offline']()} className="basis-full" />
      )}
      {failed && (
        <InlineError className="basis-full" title={m['privacy.export_failed']()} actions={start} />
      )}
    </div>
  )
}

function DeleteAccount({
  me,
  disabled,
  initial,
}: {
  me: MeData
  disabled: boolean
  initial: DeleteStep | undefined
}) {
  const [open, setOpen] = useState(initial !== undefined)
  const [step, setStep] = useState<DeleteStep>(initial ?? 'confirm')
  const [password, setPassword] = useState('')
  const [missing, setMissing] = useState(false)
  const [reauthFailure, setReauthFailure] = useState<string | undefined>()
  const passwordId = useId()
  const remove = useMutation({
    mutationFn: () => privacyClient.me.delete(),
    // The sessions are gone: a full load leaves every cached query behind.
    onSuccess: () => window.location.assign('/account-deleted'),
    onError: (error) => {
      if (reauthRequired(error)) setStep('reauth')
    },
  })
  // Signing in again starts a fresh session, which the delete then accepts.
  const reauth = useMutation({
    mutationFn: async () => {
      if (!me.username) throw new Error(m['system.error']())
      const problem = await authenticate('sign-in', me.username, password)
      if (problem) throw new Error(problem)
    },
    onSuccess: () => {
      setReauthFailure(undefined)
      remove.mutate()
    },
    onError: (error) => setReauthFailure(error.message),
  })
  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setStep('confirm')
      setPassword('')
      setMissing(false)
      setReauthFailure(undefined)
      remove.reset()
    }
  }
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="flex min-w-0 grow basis-75 flex-col gap-0.5">
        <h3 className="text-label">{m['privacy.delete_title']()}</h3>
        <p className="text-body-sm text-muted-foreground">{m['privacy.delete_body']()}</p>
      </div>
      <Button
        variant="destructive"
        disabled={disabled}
        unavailableLabel={m['settings.unavailable_offline']()}
        onClick={() => setOpen(true)}
      >
        {m['privacy.delete_action']()}
      </Button>
      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent>
          {step === 'confirm' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{m['privacy.delete_title']()}</AlertDialogTitle>
                <AlertDialogDescription>{m['privacy.delete_body']()}</AlertDialogDescription>
              </AlertDialogHeader>
              {remove.isError && !reauthRequired(remove.error) && (
                <InlineError title={m['privacy.delete_failed']()} />
              )}
              {/* Cancel stays on top when the buttons stack on a phone. */}
              <AlertDialogFooter className="max-sm:flex-col">
                <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
                <Button
                  variant="destructiveSolid"
                  loading={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {m['privacy.delete_action']()}
                </Button>
              </AlertDialogFooter>
            </>
          ) : me.username ? (
            <form
              noValidate
              className="flex flex-col gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                if (password) {
                  reauth.mutate()
                  return
                }
                setMissing(true)
                document.getElementById(passwordId)?.focus()
              }}
            >
              <AlertDialogHeader>
                <AlertDialogTitle>{m['privacy.reauth_title']()}</AlertDialogTitle>
                <AlertDialogDescription>{m['privacy.reauth_body']()}</AlertDialogDescription>
              </AlertDialogHeader>
              <Field data-invalid={missing || undefined}>
                <FieldLabel htmlFor={passwordId}>{m['auth.password_label']()}</FieldLabel>
                <Input
                  id={passwordId}
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  aria-invalid={missing || undefined}
                  aria-describedby={missing ? `${passwordId}-missing` : undefined}
                  onChange={(event) => {
                    setPassword(event.target.value)
                    setMissing(false)
                  }}
                />
                {missing && (
                  <FieldError id={`${passwordId}-missing`}>
                    {m['auth.password_missing']()}
                  </FieldError>
                )}
              </Field>
              {reauthFailure && <InlineError title={reauthFailure} />}
              {remove.isError && !reauthRequired(remove.error) && (
                <InlineError title={m['privacy.delete_failed']()} />
              )}
              {/* Cancel stays on top when the buttons stack on a phone. */}
              <AlertDialogFooter className="max-sm:flex-col">
                <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
                <Button
                  type="submit"
                  variant="destructiveSolid"
                  loading={reauth.isPending || remove.isPending}
                >
                  {m['privacy.reauth_send']()}
                </Button>
              </AlertDialogFooter>
            </form>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{m['privacy.reauth_title']()}</AlertDialogTitle>
                <AlertDialogDescription>{m['privacy.reauth_body_google']()}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
                <Button
                  variant="primary"
                  onClick={() =>
                    authClient.signIn.social({
                      provider: 'google',
                      callbackURL: CONFIRM_DELETE_PATH,
                    })
                  }
                >
                  {m['auth.google']()}
                </Button>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
