import { ClockIcon, CpuIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

// Doc 26 §12.2, 25 §5, 27 §3.11: the machine that runs analyses can be offline; queued songs start
// automatically when it's back. A calm line, not an error and not a box: a glyph and the words,
// muted while the machine is online and in the ink (with a clock) while songs wait for it.

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
        'flex items-center gap-2 py-2 text-body-sm',
        online ? 'text-muted-foreground' : 'text-foreground',
        className,
      )}
    >
      <Icon aria-hidden strokeWidth={1.8} className="size-4 shrink-0" />
      {text}
    </p>
  )
}

export { WorkerStatus }
