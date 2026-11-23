import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { cva, type VariantProps } from 'class-variance-authority'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'
import { Spinner } from '@/ui/spinner'

// Doc 26 §12.1. Every button is a pill. Each size paints its face (`--face` tall) and pads the
// border box out to the target with a transparent border (§8: 44 browse, 48 practice density); the
// edge is an inset ring on the face and focus sits 2 px off the face. One `primary` per view: the
// ink itself. `outline` is the everyday button, `quiet` the one that recedes into the chrome, and
// `selected` an "on" state drawn as the 1.5 px ink edge (never a grey fill). Disabled keeps a
// ≥ 3:1 edge and faint text on no fill, never an opacity fade.
const buttonStyles = cva(
  "group/button relative inline-flex shrink-0 items-center justify-center gap-2 rounded-full border-(length:--pad) border-transparent bg-clip-padding font-medium whitespace-nowrap inset-ring transition-[color,background-color,box-shadow,transform] duration-(--duration-fast) ease-standard select-none [--pad:calc((max(var(--control-size),var(--face))-var(--face))/2)] focus-visible:outline-offset-[calc(2px-var(--pad))] active:not-aria-[haspopup]:scale-[0.97] disabled:pointer-events-none disabled:not-data-loading:bg-transparent disabled:not-data-loading:text-faint-foreground disabled:not-data-loading:inset-ring-edge aria-disabled:pointer-events-none aria-disabled:not-data-loading:bg-transparent aria-disabled:not-data-loading:text-faint-foreground aria-disabled:not-data-loading:inset-ring-edge aria-invalid:inset-ring-destructive [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-5 [&_.lucide]:stroke-[1.8]",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground inset-ring-transparent hover:bg-primary-hover aria-expanded:bg-primary-hover',
        outline:
          'text-foreground inset-ring-border-strong hover:bg-hover hover:inset-ring-edge aria-expanded:bg-hover aria-expanded:inset-ring-edge',
        quiet:
          'text-muted-foreground inset-ring-transparent hover:bg-hover hover:text-foreground aria-expanded:bg-hover aria-expanded:text-foreground',
        selected: 'text-foreground inset-ring-[1.5px] inset-ring-selected hover:bg-hover',
        destructive: 'text-destructive inset-ring-destructive hover:bg-destructive-surface',
        destructiveSolid:
          'bg-destructive text-destructive-foreground inset-ring-transparent hover:brightness-106',
        link: 'text-foreground underline underline-offset-4 inset-ring-transparent hover:decoration-2 disabled:inset-ring-transparent',
      },
      size: {
        sm: 'min-h-[max(var(--control-size),var(--face))] px-3.5 text-label-sm [--face:2.25rem] [&_svg:not([class*=size-])]:size-4',
        md: 'min-h-[max(var(--control-size),var(--face))] px-4.5 text-label [--face:2.5rem]',
        lg: 'min-h-[max(var(--control-size),var(--face))] px-6 text-title [--face:3rem]',
        xl: 'min-h-14 px-7 text-title [--face:3.5rem]',
        practice:
          'min-h-target-practice px-5 text-label [--face:3rem] [&_svg:not([class*=size-])]:size-5',
        play: 'min-h-target-play px-7 text-title [--face:4rem] [&_svg:not([class*=size-])]:size-6',
        'icon-sm':
          'size-[max(var(--control-size),var(--face))] [--face:2.25rem] [&_svg:not([class*=size-])]:size-4',
        icon: 'size-[max(var(--control-size),var(--face))] [--face:2.5rem]',
        'icon-practice': 'size-target-practice [--face:3rem] [&_svg:not([class*=size-])]:size-5',
        'icon-play': 'size-target-play [--face:4rem] [&_svg:not([class*=size-])]:size-7',
      },
      block: { true: 'w-full' },
    },
    defaultVariants: {
      variant: 'outline',
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
    /** Blocks presses, keeps the label and shows a spinner beside it after 300 ms. */
    loading?: boolean
    /** The key that does the same thing, shown as a key cap after the label (26 §12.1). */
    shortcut?: string
    /** Added to the accessible name while disabled ("Unavailable", 26 §12.3). */
    unavailableLabel?: string
  }

function Button({
  className,
  variant,
  size,
  block,
  loading = false,
  shortcut,
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
      data-variant={variant ?? 'outline'}
      aria-keyshortcuts={shortcut}
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
      {showSpinner && <Spinner aria-hidden />}
      {children}
      {shortcut && (
        <Kbd
          aria-hidden
          className="pointer-coarse:hidden group-data-[variant=primary]/button:border-primary-foreground group-data-[variant=primary]/button:text-primary-foreground"
        >
          {shortcut}
        </Kbd>
      )}
      {props.disabled && !loading && unavailableLabel && (
        <span className="sr-only">, {unavailableLabel}</span>
      )}
    </ButtonPrimitive>
  )
}

export { Button, buttonVariants }
