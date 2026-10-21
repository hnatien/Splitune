import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §8, §12.2: practice-size icon button with its label below at Stand/Floor distance (the
// label is also the accessible name, WCAG 2.5.3) and a tooltip with the shortcut. Pass `pressed`
// to make it a toggle (loop, metronome); `active` marks a running loop without toggling.

const base =
  'group/transport relative inline-flex shrink-0 flex-col items-center justify-center gap-1 rounded-xl border font-medium transition-colors select-none disabled:pointer-events-none disabled:border-input disabled:bg-muted disabled:text-muted-foreground [&_svg]:pointer-events-none [&_svg]:shrink-0'

const sizes = {
  practice: "min-h-target-practice min-w-target-practice px-3 [&_svg:not([class*='size-'])]:size-8",
  'practice-2':
    "min-h-target-practice-2 min-w-target-practice-2 px-2 [&_svg:not([class*='size-'])]:size-6",
}

const tones = {
  primary: 'border-transparent bg-primary text-primary-foreground hover:bg-primary/90',
  neutral:
    'border-border bg-card text-foreground hover:bg-muted data-pressed:border-primary data-pressed:bg-accent data-pressed:text-primary data-[active]:border-primary data-[active]:bg-accent data-[active]:text-primary',
}

type TransportButtonProps = {
  icon: React.ReactNode
  /** Verb naming the action ("Play", "Restart loop"); visible below the icon at Stand/Floor. */
  label: string
  shortcut?: string | string[] | undefined
  size?: keyof typeof sizes
  tone?: keyof typeof tones
  /** Toggle state; omit for a plain action button. */
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  /** A loop is running (shown with the toggle's pressed styling). */
  active?: boolean
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
}

function TransportButton({
  icon,
  label,
  shortcut,
  size = 'practice',
  tone = 'neutral',
  pressed,
  onPressedChange,
  active = false,
  disabled = false,
  onClick,
  className,
}: TransportButtonProps) {
  const content = (
    <>
      {icon}
      <span
        aria-hidden
        className="hidden text-read-label leading-none in-data-[distance=floor]:block in-data-[distance=stand]:block"
      >
        {label}
      </span>
    </>
  )
  const classes = cn(base, sizes[size], tones[tone], className)
  const control =
    pressed === undefined ? (
      <ButtonPrimitive
        data-slot="transport-button"
        data-active={active || undefined}
        aria-label={label}
        disabled={disabled}
        onClick={onClick}
        className={classes}
      >
        {content}
      </ButtonPrimitive>
    ) : (
      <TogglePrimitive
        data-slot="transport-button"
        aria-label={label}
        pressed={pressed}
        disabled={disabled}
        onPressedChange={(next) => onPressedChange?.(next)}
        className={classes}
      >
        {content}
      </TogglePrimitive>
    )
  return (
    <WithTooltip label={label} shortcut={shortcut}>
      {control}
    </WithTooltip>
  )
}

export { TransportButton }
