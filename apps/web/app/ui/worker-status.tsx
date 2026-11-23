import { ClockIcon, CpuIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, 25 §5, 27 §3.11: the machine that runs analyses can be offline; queued songs start
// automatically when it's back. A quiet --panel banner, not an error.

type WorkerStatusProps = {
  online: boolean
  /** "Processing machine offline. Your song is queued and starts automatically." */
  text: string
  className?: string
}

function WorkerStatus({ online, text, className }: WorkerStatusProps) {
  const Icon = online ? CpuIcon : ClockIcon
  return (
    <p
      data-slot="worker-status"
      data-online={online}
      role="status"
      className={cn(
        'flex items-center gap-2.5 rounded-field bg-panel px-4 py-3 text-body-sm',
        online && 'text-muted-foreground',
        className,
      )}
    >
      <Icon aria-hidden className={cn('size-5 shrink-0', !online && 'text-foreground')} />
      {text}
    </p>
  )
}

export { WorkerStatus }
