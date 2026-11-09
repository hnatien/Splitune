import { CircleXIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Badge } from '@/ui/badge'
import { CheckDrawIcon } from '@/ui/icons/check-draw'
import { Spinner } from '@/ui/spinner'

// Per-field save feedback (27 §3.9: no global save button): "Saving…" → "Saved on this device"
// next to the field, announced politely. Saved is the success badge (26 §12.2) with the tick
// drawing itself; a failure stays visible with its reason and icon.

type SaveStatusProps = {
  state: 'idle' | 'saving' | 'saved' | 'error'
  savingLabel: string
  savedLabel: string
  errorLabel?: string | undefined
  className?: string
}

function SaveStatus({ state, savingLabel, savedLabel, errorLabel, className }: SaveStatusProps) {
  return (
    <span
      data-slot="save-status"
      role="status"
      className={cn(
        'inline-flex min-h-5.5 items-center gap-1.5 text-sm [&_svg]:size-3.5',
        className,
      )}
    >
      {state === 'saving' && (
        <>
          <Spinner aria-hidden className="size-3.5" />
          <span className="text-muted-foreground">{savingLabel}</span>
        </>
      )}
      {state === 'saved' && (
        <Badge variant="success">
          <CheckDrawIcon aria-hidden />
          {savedLabel}
        </Badge>
      )}
      {state === 'error' && errorLabel && (
        <>
          <CircleXIcon aria-hidden strokeWidth={1.8} className="text-destructive" />
          <span className="text-destructive">{errorLabel}</span>
        </>
      )}
    </span>
  )
}

export { SaveStatus }
