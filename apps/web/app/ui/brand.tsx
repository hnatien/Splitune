import type * as React from 'react'
import { cn } from '@/lib/utils'

// Wordmark and mark (doc 26 §11): one waveform stroke that splits into two lines, indigo (the part
// you practise) and ink (the rest of the song). Static PWA/favicon files in public/ share the paths.

export const MARK_PATHS = {
  wave: 'M3 16c2.5-5.5 4.5-5.5 6.5 0s4 5.5 6.5 0',
  part: 'M16 16c3-3.75 6-6 13-6',
  rest: 'M16 16c3 3.75 6 6 13 6',
} as const

type MarkProps = React.ComponentProps<'svg'> & {
  /** `mono` draws both lines in the current text colour (one-colour contexts, forced colours). */
  tone?: 'colour' | 'mono'
}

function BrandMark({ tone = 'colour', className, ...props }: MarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      strokeWidth={2.75}
      strokeLinecap="round"
      aria-hidden
      className={cn('size-8 shrink-0', className)}
      {...props}
    >
      <path d={MARK_PATHS.wave} className="stroke-current" />
      <path d={MARK_PATHS.part} className={tone === 'mono' ? 'stroke-current' : 'stroke-primary'} />
      <path d={MARK_PATHS.rest} className="stroke-current" />
    </svg>
  )
}

/** "Splitune" in Inter 700, −0.02em, with the mark. The name is real text, so it is the label. */
function Wordmark({
  tone = 'colour',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: MarkProps['tone'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2 text-xl font-bold tracking-[-0.02em] text-foreground',
        className,
      )}
      {...props}
    >
      <BrandMark tone={tone} />
      Splitune
    </span>
  )
}

export { BrandMark, Wordmark }
