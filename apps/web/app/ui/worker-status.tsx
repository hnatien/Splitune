import { CloudOffIcon, CpuIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Doc 25 §5, 27 §5.6 `analysis.queued_offline`: the Mac that runs analyses can be offline; queued
// songs start automatically when it's back. Shown on the song and the stage list, not as an error.

type WorkerStatusProps = {
  online: boolean
  /** "Processing machine offline — your song is queued and will start automatically." */
  text: string
  className?: string
}

function WorkerStatus({ online, text, className }: WorkerStatusProps) {
  const Icon = online ? CpuIcon : CloudOffIcon
  return (
    <p
      data-slot="worker-status"
      data-online={online}
      role="status"
      className={cn(
        'inline-flex w-fit items-center gap-2 rounded-lg border px-3 py-2 text-sm',
        online ? 'border-border text-muted-foreground' : 'border-warning bg-muted text-foreground',
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-5 shrink-0', online ? '' : 'text-warning')} />
      {text}
    </p>
  )
}

export { WorkerStatus }
