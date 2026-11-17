import { Link, useRouter } from '@tanstack/react-router'
import { CopyIcon, RotateCwIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button, buttonVariants } from '@/ui/button'
import { BareShell } from '../shell/bare-shell'
import { SystemCard, SystemText } from './system-card'

// System pages (27 §3.11): 404 with its mono number, and the error boundary with a copyable
// error id. The id is logged with the error so a report can be matched to it; the message
// itself is never shown.

export function NotFoundPage() {
  return (
    <BareShell>
      <SystemCard
        title={m['system.not_found']()}
        aside={
          <span aria-hidden className="text-lg text-faint-foreground tabular-nums">
            404
          </span>
        }
        actions={
          <Link to="/library" className={buttonVariants({ variant: 'primary' })}>
            {m['system.go_library']()}
          </Link>
        }
      >
        <SystemText>{m['system.not_found_hint']()}</SystemText>
      </SystemCard>
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
      <SystemCard
        title={m['system.error']()}
        actions={
          <>
            <Button variant="primary" onClick={() => router.invalidate()}>
              <RotateCwIcon aria-hidden />
              {m['system.reload']()}
            </Button>
            <Link to="/library" className={buttonVariants({ variant: 'ghost' })}>
              {m['system.go_library']()}
            </Link>
          </>
        }
      >
        <div className="flex flex-wrap items-center justify-center gap-x-1">
          <p className="font-mono text-sm text-faint-foreground">{m['system.error_id']({ id })}</p>
          <Button
            variant="ghost"
            size="sm"
            onClick={async () => {
              await navigator.clipboard.writeText(id).catch(() => undefined)
              setCopied(true)
            }}
          >
            <CopyIcon aria-hidden />
            {copied ? m['system.error_id_copied']() : m['system.copy_error_id']()}
          </Button>
        </div>
      </SystemCard>
    </BareShell>
  )
}
