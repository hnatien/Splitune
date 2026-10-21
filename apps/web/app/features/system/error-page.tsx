import { Link, useRouter } from '@tanstack/react-router'
import { CopyIcon, MapPinOffIcon, RotateCwIcon, TriangleAlertIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { EmptyState } from '@/ui/empty-state'
import { BareShell } from '../shell/bare-shell'

// System pages (27 §3.11): 404 and the error boundary with a copyable error id. The id is logged
// with the error so a report can be matched to it; the message itself is never shown.

export function NotFoundPage() {
  return (
    <BareShell>
      <EmptyState
        icon={<MapPinOffIcon aria-hidden />}
        title={m['system.not_found']()}
        description={m['system.not_found_hint']()}
        action={
          <Link to="/library" className={buttonVariants({ variant: 'primary' })}>
            {m['system.go_library']()}
          </Link>
        }
      />
    </BareShell>
  )
}

export function ErrorPage({ error }: { error: unknown }) {
  const router = useRouter()
  const [id] = useState(() => crypto.randomUUID().slice(0, 8))
  const [copied, setCopied] = useState(false)
  // The browser console is the only error sink until step 15 adds telemetry.
  useEffect(() => console.error(`screen error ${id}`, error), [id, error])
  return (
    <BareShell>
      <EmptyState
        icon={<TriangleAlertIcon aria-hidden />}
        title={m['system.error']()}
        description={m['system.error_id']({ id })}
        action={
          <Button variant="primary" onClick={() => router.invalidate()}>
            <RotateCwIcon aria-hidden />
            {m['system.reload']()}
          </Button>
        }
        secondaryAction={
          <>
            <Link to="/library" className={buttonVariants({ variant: 'outline' })}>
              {m['system.go_library']()}
            </Link>
            <Button
              variant="ghost"
              onClick={async () => {
                await navigator.clipboard.writeText(id).catch(() => undefined)
                setCopied(true)
              }}
            >
              <CopyIcon aria-hidden />
              {copied ? m['system.error_id_copied']() : m['system.copy_error_id']()}
            </Button>
          </>
        }
      />
    </BareShell>
  )
}
