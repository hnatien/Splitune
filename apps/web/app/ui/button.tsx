import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Spinner } from '@/ui/spinner'

// Doc 26 §12.1 (`.btn`, `.ib`). Each size paints its face (`--face` tall, `--r` corners) and pads
// the border box out to the target with a transparent border (§8, V12: 44 browse, 48 practice
// density); the edge is an inset ring on the face and focus sits 2 px off the face. Disabled is a
// muted face, faint text and a ≥ 3:1 edge, never an opacity fade.
const buttonStyles = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-[calc(var(--r)+var(--pad))] border-(length:--pad) border-transparent bg-clip-padding font-semibold whitespace-nowrap inset-ring transition-[color,background-color,box-shadow,filter,transform] duration-(--duration-fast) ease-spring select-none [--pad:calc((max(var(--control-size),var(--face))-var(--face))/2)] focus-visible:outline-offset-[calc(2px-var(--pad))] active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:bg-muted disabled:text-faint-foreground disabled:inset-ring-input aria-disabled:pointer-events-none aria-disabled:bg-muted aria-disabled:text-faint-foreground aria-disabled:inset-ring-input aria-invalid:inset-ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_.lucide]:stroke-[1.8]",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground inset-ring-transparent hover:brightness-106 aria-expanded:brightness-106',
        secondary:
          'bg-muted text-foreground inset-ring-border-strong hover:bg-accent aria-expanded:bg-accent',
        quiet: 'text-foreground inset-ring-border-strong hover:bg-accent aria-expanded:bg-accent',
        outline: 'text-foreground inset-ring-border-strong hover:bg-accent aria-expanded:bg-accent',
        ghost:
          'text-muted-foreground inset-ring-transparent hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground',
        box: 'bg-card text-muted-foreground inset-ring-border-strong hover:bg-muted hover:text-foreground',
        on: 'bg-primary-soft text-primary-ink inset-ring-primary-line',
        destructive: 'text-destructive inset-ring-destructive hover:bg-destructive-surface',
        destructiveSolid:
          'bg-destructive text-destructive-foreground inset-ring-transparent hover:brightness-106',
        link: 'text-primary-ink underline underline-offset-4 inset-ring-transparent hover:decoration-2 disabled:bg-transparent disabled:inset-ring-transparent',
      },
      size: {
        sm: 'min-h-[max(var(--control-size),var(--face))] px-3 text-sm [--face:2rem] [--r:var(--radius-md)] [&_svg:not([class*=size-])]:size-4',
        md: 'min-h-[max(var(--control-size),var(--face))] px-4 text-md [--face:2.5rem] [--r:var(--radius-lg)]',
        lg: 'min-h-[max(var(--control-size),var(--face))] px-5.5 text-lg [--face:3rem] [--r:var(--radius-xl)]',
        xl: 'min-h-14 px-6.5 text-lg [--face:3.5rem] [--r:var(--radius-xl)]',
        'practice-2':
          'min-h-target-practice-2 px-5 text-md [--face:3rem] [--r:var(--radius-xl)] [&_svg:not([class*=size-])]:size-6',
        practice:
          'min-h-target-practice px-6 text-lg [--face:4rem] [--r:var(--radius-2xl)] [&_svg:not([class*=size-])]:size-6',
        'icon-sm':
          'size-[max(var(--control-size),var(--face))] [--face:2rem] [--r:var(--radius-md)] [&_svg:not([class*=size-])]:size-4',
        icon: 'size-[max(var(--control-size),var(--face))] [--face:2.5rem] [--r:var(--radius-lg)]',
        'icon-practice-2':
          'size-13 [--face:3.25rem] [--r:var(--radius-2xl)] [&_svg:not([class*=size-])]:size-6',
        'icon-practice':
          'size-target-practice [--face:4rem] [--r:var(--radius-2xl)] [&_svg:not([class*=size-])]:size-6',
      },
      block: { true: 'w-full' },
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
    /** Added to the accessible name while disabled ("Unavailable", 26 §12.3). */
    unavailableLabel?: string
  }

function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  unavailableLabel,
  children,
  ...props
}: ButtonProps) {
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
      className={cn(
        buttonVariants({ variant, size, block }),
        loading && 'pointer-events-none',
        className,
      )}
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
        {props.disabled && !loading && unavailableLabel && (
          <span className="sr-only">, {unavailableLabel}</span>
        )}
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
