import type * as React from 'react'
import { cn } from '@/lib/utils'

// Wordmark and mark (doc 26 §11): a 28 px --primary disc crossed by a 2.4 px --primary-foreground
// wave (the mockups' header mark), and "splitune" in lowercase. The PWA icons and favicon in
// public/ still draw the earlier mark until s45 redraws them.

export const MARK_PATHS = {
  disc: { cx: 14, cy: 14, r: 13 },
  wave: 'M3 14c3.2-4.6 5.8 4.6 11 0s7.8 4.6 11 0',
} as const

type MarkProps = React.ComponentProps<'svg'> & {
  /** `mono` draws the disc's outline and the wave in the current text colour (one-colour contexts). */
  tone?: 'colour' | 'mono'
}

function BrandMark({ tone = 'colour', className, ...props }: MarkProps) {
  const mono = tone === 'mono'
  return (
    <svg
      viewBox="0 0 28 28"
      fill="none"
      strokeWidth={2.4}
      strokeLinecap="round"
      aria-hidden
      className={cn('size-7 shrink-0', className)}
      {...props}
    >
      <circle
        {...MARK_PATHS.disc}
        r={mono ? MARK_PATHS.disc.r - 1 : MARK_PATHS.disc.r}
        strokeWidth={mono ? 2 : 0}
        className={mono ? 'stroke-current' : 'fill-primary'}
      />
      <path d={MARK_PATHS.wave} className={mono ? 'stroke-current' : 'stroke-primary-foreground'} />
    </svg>
  )
}

/** "splitune" in Instrument Sans 700, −0.02em, with the mark. The name is real text, so it is the label. */
function Wordmark({
  tone = 'colour',
  className,
  ...props
}: React.ComponentProps<'span'> & { tone?: MarkProps['tone'] }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-2.5 font-sans text-lead leading-none font-bold tracking-[-0.02em] text-foreground',
        className,
      )}
      {...props}
    >
      <BrandMark tone={tone} />
      splitune
    </span>
  )
}

export { BrandMark, Wordmark }
