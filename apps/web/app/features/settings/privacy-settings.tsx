import { createTanstackQueryUtils } from '@orpc/tanstack-query'
import { privacyContract } from '@splitune/contracts'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DownloadIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { client, clientFor, errorData } from '@/lib/api'
import { MAGIC_LINK_MINUTES } from '@/lib/auth-client'
import { formatDateTime } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { useOnline } from '@/lib/use-online'
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
import { Label } from '@/ui/label'
import { InlineError } from '@/ui/status-message'
import { Switch } from '@/ui/switch'
import { WorkerStatus } from '@/ui/worker-status'
import { sendLink } from '../auth/sign-in'
import { workerStatusQuery } from '../library/queries'
import { SettingRow } from './setting-row'
import { useSaveState } from './use-save-state'

// Settings → Privacy (27 §3.9, 15 §4): the training opt-in (stored only; nothing trains on it
// yet), "Download my data" (the node worker prepares a file kept for 24 h) and "Delete my account"
// (27 §5.6 `delete.account_confirm`; a sign-in within 10 minutes is required, so a stale session
// gets a magic link that returns here with the dialog open).

// Its own client (contracts `privacyContract`): only this page carries the privacy schemas.
const privacyClient = clientFor(privacyContract)
const privacyOrpc = createTanstackQueryUtils(privacyClient)

export const exportStateQuery = (pending: boolean) =>
  privacyOrpc.me.exportState.queryOptions({ refetchInterval: pending ? 5_000 : false })

// 403 details.reason from requireRecentAuth (apps/api auth.ts).
const reauthRequired = (error: unknown) =>
  (errorData(error) as { reason?: unknown }).reason === 'reauth_required'

// The path the re-authentication link returns to.
export const CONFIRM_DELETE_PATH = '/settings/privacy?confirm=delete'

export type DeleteStep = 'confirm' | 'reauth' | 'sent'

export function PrivacySettings({
  me,
  deleteDialog,
}: {
  me: MeData
  /** Opens "Delete my account" at this step (the re-authentication link returns to confirm). */
  deleteDialog?: DeleteStep | undefined
}) {
  const online = useOnline()
  return (
    <section className="flex flex-col">
      <h2 className="text-xl">{m['settings.privacy']()}</h2>
      {!online && <InlineError tone="info" title={m['privacy.offline']()} className="mt-4" />}
      <TrainingOptIn me={me} disabled={!online} />
      <DataExport disabled={!online} />
      <DeleteAccount me={me} disabled={!online} initial={deleteDialog} />
    </section>
  )
}

function TrainingOptIn({ me, disabled }: { me: MeData; disabled: boolean }) {
  const queryClient = useQueryClient()
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  const save = useSaveState()
  const id = useId()
  return (
    <SettingRow state={save.state} description={m['privacy.training_hint']()}>
      <div className="flex min-h-control items-center gap-3">
        <Switch
          id={id}
          checked={current.training_opt_in}
          disabled={disabled}
          onCheckedChange={(on) =>
            save.run(async () => {
              queryClient.setQueryData(
                meQuery.queryKey,
                await client.me.update({ training_opt_in: on }),
              )
            })
          }
        />
        <Label htmlFor={id}>{m['privacy.training_label']()}</Label>
      </div>
    </SettingRow>
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
      variant={status === 'ready' ? 'outline' : 'primary'}
      loading={request.isPending}
      disabled={disabled}
      onClick={() => request.mutate()}
    >
      {status === 'ready' || status === 'failed'
        ? m['privacy.export_again']()
        : m['privacy.export_start']()}
    </Button>
  )
  return (
    <div className="flex flex-col gap-3 border-b border-border py-5">
      <h3 className="text-lg">{m['privacy.export_title']()}</h3>
      <p className="text-base text-muted-foreground">{m['privacy.export_body']()}</p>
      {state.isError && !state.data ? (
        <InlineError
          title={m['privacy.export_unavailable']()}
          actions={
            <Button variant="outline" onClick={() => state.refetch()}>
              {m['common.try_again']()}
            </Button>
          }
        />
      ) : status === 'pending' ? (
        <>
          <p role="status" className="text-base">
            {m['privacy.export_pending']()}
          </p>
          {worker.data && !worker.data.runners.node.online && (
            <WorkerStatus online={false} text={m['privacy.export_offline']()} />
          )}
        </>
      ) : status === 'ready' && state.data?.url ? (
        <>
          <p role="status" className="text-base">
            {m['privacy.export_ready']({
              date: formatDateTime(new Date(state.data.expires_at ?? Date.now())),
            })}
          </p>
          <div className="flex flex-wrap gap-3">
            <a href={state.data.url} download className={buttonVariants({ variant: 'primary' })}>
              <DownloadIcon aria-hidden />
              {m['privacy.export_download']()}
            </a>
            {start}
          </div>
        </>
      ) : (
        <>
          {(status === 'failed' || request.isError) && (
            <InlineError title={m['privacy.export_failed']()} />
          )}
          {status !== undefined && <div>{start}</div>}
        </>
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
  const [linkFailure, setLinkFailure] = useState<string | undefined>()
  const remove = useMutation({
    mutationFn: () => privacyClient.me.delete(),
    // The sessions are gone: a full load leaves every cached query behind.
    onSuccess: () => window.location.assign('/account-deleted'),
    onError: (error) => {
      if (reauthRequired(error)) setStep('reauth')
    },
  })
  const sendReauth = useMutation({
    mutationFn: async () => {
      const problem = await sendLink(me.email, CONFIRM_DELETE_PATH)
      if (problem) throw new Error(problem)
    },
    onSuccess: () => setStep('sent'),
    onError: (error) => setLinkFailure(error.message),
  })
  const close = (next: boolean) => {
    setOpen(next)
    if (!next) {
      setStep('confirm')
      setLinkFailure(undefined)
      remove.reset()
    }
  }
  return (
    <div className="flex flex-col gap-3 py-5">
      <h3 className="text-lg">{m['privacy.delete_title']()}</h3>
      <p className="text-base text-muted-foreground">{m['privacy.delete_body']()}</p>
      <div>
        <Button variant="destructive" disabled={disabled} onClick={() => setOpen(true)}>
          {m['privacy.delete_action']()}
        </Button>
      </div>
      <AlertDialog open={open} onOpenChange={close}>
        <AlertDialogContent>
          {step === 'confirm' ? (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{m['privacy.delete_title']()}</AlertDialogTitle>
                <AlertDialogDescription>{m['delete.account_confirm']()}</AlertDialogDescription>
              </AlertDialogHeader>
              {remove.isError && !reauthRequired(remove.error) && (
                <InlineError title={m['privacy.delete_failed']()} />
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
                <Button
                  variant="destructive"
                  loading={remove.isPending}
                  onClick={() => remove.mutate()}
                >
                  {m['privacy.delete_action']()}
                </Button>
              </AlertDialogFooter>
            </>
          ) : (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>{m['privacy.reauth_title']()}</AlertDialogTitle>
                <AlertDialogDescription>
                  {step === 'sent'
                    ? m['auth.link_sent']({ email: me.email, minutes: String(MAGIC_LINK_MINUTES) })
                    : m['privacy.reauth_body']({ email: me.email })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              {linkFailure && <InlineError title={linkFailure} />}
              <AlertDialogFooter>
                <AlertDialogCancel>{m['common.cancel']()}</AlertDialogCancel>
                {step === 'reauth' && (
                  <Button
                    variant="primary"
                    loading={sendReauth.isPending}
                    onClick={() => sendReauth.mutate()}
                  >
                    {m['privacy.reauth_send']()}
                  </Button>
                )}
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
