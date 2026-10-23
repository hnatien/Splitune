import { FileAudioIcon } from 'lucide-react'
import { useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'

// Large file target (27 §3.6): "Drop an audio or video file, or choose a file" plus the formats
// line. The page can accept drops anywhere; it passes `dragging` so the zone shows the drop state.
// Picking with the button is the non-drag alternative (WCAG 2.5.7); a click anywhere else on the
// zone opens the picker too (a pointer shortcut, so the zone is not a second tab stop).

type DropZoneProps = {
  prompt: string
  chooseLabel: string
  hint: string
  /** Shown while a file is dragged over the page. */
  dropLabel: string
  dragging?: boolean
  accept?: string
  disabled?: boolean
  onFiles: (files: File[]) => void
  className?: string
}

function DropZone({
  prompt,
  chooseLabel,
  hint,
  dropLabel,
  dragging = false,
  accept,
  disabled = false,
  onFiles,
  className,
}: DropZoneProps) {
  const input = useRef<HTMLInputElement>(null)
  const hintId = useId()
  return (
    // biome-ignore lint/a11y/noStaticElementInteractions lint/a11y/useKeyWithClickEvents: a pointer shortcut; the "choose a file" button inside is the keyboard and assistive path
    <div
      data-slot="drop-zone"
      data-dragging={dragging || undefined}
      onClick={(event) => {
        if (disabled || dragging) return
        // The button opens the picker itself; the input's own click bubbles back up through here.
        if (event.target instanceof Element && event.target.closest('button, input')) return
        input.current?.click()
      }}
      className={cn(
        'flex min-h-56 flex-col items-center justify-center gap-4 rounded-2xl border-2 border-dashed border-input bg-surface-raised px-6 py-10 text-center transition-[scale,background-color,border-color,box-shadow] duration-(--duration-base) ease-spring data-dragging:scale-[1.01] data-dragging:border-primary data-dragging:bg-accent data-dragging:ring-2 data-dragging:ring-primary forced-colors:data-dragging:bg-card',
        !disabled && 'cursor-pointer',
        className,
      )}
    >
      <span className="grid size-16 place-items-center rounded-full bg-muted text-muted-foreground [&_svg]:size-8">
        <FileAudioIcon aria-hidden />
      </span>
      {dragging ? (
        <p className="text-lg font-medium text-accent-foreground">{dropLabel}</p>
      ) : (
        <p className="text-lg">
          {prompt}{' '}
          <Button
            variant="link"
            // Inline in the sentence, with a 44 px tall hit area for fingers (26 §8).
            className="min-h-0 px-0 align-baseline text-lg after:absolute after:inset-x-0 after:top-1/2 after:h-target after:-translate-y-1/2"
            aria-describedby={hintId}
            disabled={disabled}
            onClick={() => input.current?.click()}
          >
            {chooseLabel}
          </Button>
        </p>
      )}
      <p id={hintId} className="text-sm text-muted-foreground">
        {hint}
      </p>
      <input
        ref={input}
        type="file"
        accept={accept}
        hidden
        onChange={(event) => {
          const files = Array.from(event.currentTarget.files ?? [])
          event.currentTarget.value = ''
          if (files.length > 0) onFiles(files)
        }}
      />
    </div>
  )
}

export { DropZone }
