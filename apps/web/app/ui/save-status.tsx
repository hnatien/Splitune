import { CircleXIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CircleCheckDrawIcon } from '@/ui/icons/check-draw'
import { Spinner } from '@/ui/spinner'

// Per-field save feedback (27 §3.9: no global save button): "Saving…" → "Saved on this device"
// next to the field, announced politely. Each state is a glyph and words like Status (26 §12.2), no
// badge: a spinner, a circled tick that draws itself in --success, a crossed circle in
// --destructive. A failure stays visible with its reason. The slot keeps its height between states.

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
        'inline-flex min-h-5.5 items-center gap-1.5 text-label-sm text-muted-foreground [&_svg]:size-4 [&_.lucide]:stroke-[1.8]',
        className,
      )}
    >
      {state === 'saving' && (
        <>
          <Spinner aria-hidden />
          <span>{savingLabel}</span>
        </>
      )}
      {state === 'saved' && (
        <>
          <CircleCheckDrawIcon aria-hidden className="text-success" />
          <span>{savedLabel}</span>
        </>
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
