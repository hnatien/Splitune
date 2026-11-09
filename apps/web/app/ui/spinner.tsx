import { cn } from '@/lib/utils'

/**
 * `.spin` (doc 26 §12.1): a --primary-soft ring with a --signal arc, 16 px (12 in badges). Static
 * under reduced motion; decorative, so the control that owns it announces the busy state.
 */
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
  return (
    <svg
      data-slot="spinner"
      aria-hidden
      viewBox="0 0 16 16"
      fill="none"
      strokeWidth={2}
      className={cn('size-4 shrink-0 animate-spin motion-reduce:animate-none', className)}
      {...props}
    >
      <circle cx="8" cy="8" r="7" className="stroke-primary-soft" />
      <path d="M8 1a7 7 0 0 1 7 7" className="stroke-signal" />
    </svg>
  )
}

export { Spinner }
