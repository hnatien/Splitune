import { CircleXIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CheckDrawIcon } from '@/ui/icons/check-draw'
import { Spinner } from '@/ui/spinner'

// Per-field save feedback (27 §3.9: no global save button): "Saving…" → "Saved" next to the field,
// announced politely, the tick drawing itself; a failure stays visible with its reason.

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
      className={cn('inline-flex min-h-6 items-center gap-1.5 text-sm [&_svg]:size-4', className)}
    >
      {state === 'saving' && (
        <>
          <Spinner aria-hidden />
          <span className="text-muted-foreground">{savingLabel}</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <CheckDrawIcon aria-hidden className="text-success" />
          <span className="text-success">{savedLabel}</span>
        </>
      )}
      {state === 'error' && errorLabel && (
        <>
          <CircleXIcon aria-hidden className="text-destructive" />
          <span className="text-destructive">{errorLabel}</span>
        </>
      )}
    </span>
  )
}

export { SaveStatus }
