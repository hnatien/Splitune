import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §8, §12.2: practice icon buttons with the label below from `md` up and at Stand/Floor
// distance (the label is also the accessible name, WCAG 2.5.3) and a tooltip with the shortcut.
// The universally known transport icons (restart, play, −/+) may drop the visible label (26 §11).
// Pass `pressed` to make it a toggle (loop, metronome); `active` marks a running loop without
// toggling. Main controls are 64 painted and hit (`practice`, V11); secondary ones paint `.ib.lg`
// at 52 (`practice-2`). Every one is a circle (a pill once a label widens it). `neutral` is
// `.ib.lg`, `box` is `.ib.lg.box`, `primary` is `.play`, the filled ink circle; on and active are
// `.ib.on`: the --wash wash, a --selected edge and --foreground.

const base =
  'group/transport relative inline-flex shrink-0 flex-col items-center justify-center gap-1 rounded-full font-medium inset-ring transition-[color,background-color,box-shadow,filter,transform] duration-(--duration-fast) ease-enter select-none active:scale-[0.97] disabled:pointer-events-none disabled:bg-panel disabled:text-faint-foreground disabled:inset-ring-edge [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_.lucide]:stroke-[1.8]'

const sizes = {
  practice: "min-h-target-play min-w-target-play px-3 [&_svg:not([class*='size-'])]:size-6",
  'practice-2': "min-h-13 min-w-13 px-2 [&_svg:not([class*='size-'])]:size-5",
}

const on =
  'data-pressed:bg-wash data-pressed:text-foreground data-pressed:inset-ring-selected data-[active]:bg-wash data-[active]:text-foreground data-[active]:inset-ring-selected forced-colors:data-pressed:bg-raised forced-colors:data-[active]:bg-raised'

const tones = {
  primary:
    "bg-primary text-primary-foreground inset-ring-transparent hover:bg-primary-hover [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-7",
  neutral: `text-muted-foreground inset-ring-transparent hover:bg-panel hover:text-foreground ${on}`,
  box: `bg-raised text-muted-foreground inset-ring-border-strong hover:bg-panel hover:text-foreground ${on}`,
}

type TransportButtonProps = {
  icon: React.ReactNode
  /** Verb naming the action ("Play", "Restart loop"); visible below the icon at Stand/Floor. */
  label: string
  /**
   * Show the label below the icon: from `md` (true), only from `xl` where the bar is crowded
   * ('wide'), or never (false, for the universally known transport icons). Stand and Floor
   * distances always show it unless false.
   */
  showLabel?: boolean | 'wide'
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
  showLabel = true,
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
      {showLabel && (
        <span
          aria-hidden
          className={cn(
            'hidden text-read-label leading-none group-data-pressed/transport:font-medium group-data-[active]/transport:font-medium in-data-[distance=floor]:block in-data-[distance=stand]:block',
            showLabel === 'wide' ? 'xl:block' : 'md:block',
          )}
        >
          {label}
        </span>
      )}
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
