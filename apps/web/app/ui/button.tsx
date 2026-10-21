import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/ui/spinner'

// Doc 26 §12.1. Focus uses the global 2 px outline; disabled keeps a ≥3:1 boundary (no opacity fade).
const buttonStyles = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-lg border border-transparent bg-clip-padding font-medium whitespace-nowrap transition-colors select-none active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:border-input disabled:bg-muted disabled:text-muted-foreground aria-invalid:border-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5",
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary:
          'bg-secondary text-secondary-foreground hover:bg-accent hover:text-accent-foreground aria-expanded:bg-accent aria-expanded:text-accent-foreground',
        outline: 'border-input bg-card text-foreground hover:bg-muted aria-expanded:bg-muted',
        ghost:
          'text-foreground hover:bg-muted aria-expanded:bg-muted disabled:border-transparent disabled:bg-transparent',
        destructive: 'border-destructive bg-card text-destructive hover:bg-muted',
        link: 'text-primary underline underline-offset-4 hover:decoration-2 disabled:border-transparent disabled:bg-transparent',
      },
      size: {
        sm: 'min-h-target-sm gap-1.5 rounded-md px-3 text-sm [&_svg:not([class*=size-])]:size-4',
        md: 'min-h-control px-4 text-base',
        'practice-2': 'min-h-target-practice-2 px-5 text-base',
        practice:
          'min-h-target-practice rounded-xl px-6 text-lg [&_svg:not([class*=size-])]:size-7',
        'icon-sm': 'size-target-sm rounded-md [&_svg:not([class*=size-])]:size-4',
        icon: 'size-control',
        'icon-practice-2': 'size-target-practice-2 [&_svg:not([class*=size-])]:size-6',
        'icon-practice': 'size-target-practice rounded-xl [&_svg:not([class*=size-])]:size-7',
      },
    },
    defaultVariants: {
      variant: 'secondary',
      size: 'md',
    },
  },
)

/**
 * Button classes, merged (variants override the base, e.g. outline's border colour), for links
 * and other elements styled as buttons.
 */
function buttonVariants(...args: Parameters<typeof buttonStyles>): string {
  return cn(buttonStyles(...args))
}

/** Delay before a loading button shows its spinner, so quick actions don't flash (§13). */
export const SPINNER_DELAY_MS = 300

type ButtonProps = ButtonPrimitive.Props &
  VariantProps<typeof buttonStyles> & {
    /** Keeps the width, blocks presses and shows a spinner after 300 ms. */
    loading?: boolean
  }

function Button({ className, variant, size, loading = false, children, ...props }: ButtonProps) {
  const [showSpinner, setShowSpinner] = useState(false)
  useEffect(() => {
    if (!loading) {
      setShowSpinner(false)
      return
    }
    const timer = setTimeout(() => setShowSpinner(true), SPINNER_DELAY_MS)
    return () => clearTimeout(timer)
  }, [loading])

  return (
    <ButtonPrimitive
      data-slot="button"
      data-loading={loading || undefined}
      aria-busy={loading || undefined}
      focusableWhenDisabled={loading}
      className={cn(buttonVariants({ variant, size }), loading && 'pointer-events-none', className)}
      {...props}
      disabled={props.disabled || loading}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center gap-[inherit]',
          showSpinner && 'opacity-0',
        )}
      >
        {children}
      </span>
      {showSpinner && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner aria-hidden />
        </span>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
