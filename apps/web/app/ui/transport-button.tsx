import { Button as ButtonPrimitive } from '@base-ui/react/button'
import { Toggle as TogglePrimitive } from '@base-ui/react/toggle'
import type * as React from 'react'
import { cn } from '@/lib/utils'
import { Kbd } from '@/ui/kbd'
import { WithTooltip } from '@/ui/tooltip'

// Doc 26 §8, §12.2, s47 direction §6–§7: the practice transport's controls. Play is the one
// filled ink control on the screen, a 64 px circle; every other control is a quiet 48 px circle
// with a 1.8-stroke icon, or a pill once its label, detail or key cap shows. Each control prints
// its key cap on fine pointers (hidden on coarse pointers; the key still works) and names it in
// the tooltip. Pass `pressed` to make it a toggle (loop, count-in, metronome); `active` marks a
// running loop without toggling. On and active are the 1.5 px ink edge with ink text, never a
// fill. Disabled is faint text inside a dashed ≥ 3:1 edge with no fill (never an opacity fade,
// and never a solid ring, which would read as "on"), and
// `unavailableLabel` says why in the name and the tooltip ("Unavailable · after the beat is found").

const base =
  'group/transport relative inline-flex min-h-target-practice min-w-target-practice shrink-0 items-center justify-center gap-2 rounded-full px-3 text-label whitespace-nowrap inset-ring transition-[color,background-color,box-shadow,transform] duration-(--duration-fast) ease-standard select-none active:scale-[0.97] disabled:pointer-events-none disabled:bg-transparent disabled:text-faint-foreground disabled:inset-ring-transparent disabled:outline-1 disabled:-outline-offset-1 disabled:outline-dashed disabled:outline-edge [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_.lucide]:stroke-[1.8]'

const on =
  'data-pressed:text-foreground data-pressed:inset-ring-[1.5px] data-pressed:inset-ring-selected data-[active]:text-foreground data-[active]:inset-ring-[1.5px] data-[active]:inset-ring-selected'

const tones = {
  /** Play: the filled ink circle, 64 px; its key cap sits under the icon. */
  primary:
    "size-target-play flex-col gap-0.5 px-0 bg-primary text-primary-foreground inset-ring-transparent hover:bg-primary-hover [&_svg]:fill-current [&_svg:not([class*='size-'])]:size-7",
  /** Every other transport control: quiet, no edge at rest. */
  neutral: `text-muted-foreground inset-ring-transparent hover:bg-hover hover:text-foreground ${on} [&_svg:not([class*='size-'])]:size-5`,
  /** A control standing on its own (the speed steppers outside the transport): a hairline edge. */
  box: `text-foreground inset-ring-border-strong hover:bg-hover hover:inset-ring-edge ${on} [&_svg:not([class*='size-'])]:size-5`,
}

type TransportButtonProps = {
  icon: React.ReactNode
  /** Verb naming the action ("Play", "Restart loop"); also the accessible name. */
  label: string
  /**
   * Show the label beside the icon: from `md` (true), only from `xl` where the bar is crowded
   * ('wide'), or never (false, for the universally known transport icons). Stand and Floor
   * distances always show it unless false.
   */
  showLabel?: boolean | 'wide'
  /** A quieter second word after the label, shown with it ("1 bar", "Your part loud"). */
  detail?: string | undefined
  /** The key (or keys) that do the same; printed as key caps on fine pointers. */
  shortcut?: string | string[] | undefined
  /**
   * Kept for the screens: both sizes are the 48 px practice target now (Play is always 64).
   */
  size?: 'practice' | 'practice-2'
  tone?: keyof typeof tones
  /** Toggle state; omit for a plain action button. */
  pressed?: boolean
  onPressedChange?: (pressed: boolean) => void
  /** A loop is running (shown with the toggle's "on" edge). */
  active?: boolean
  disabled?: boolean
  /** Why it can't be used yet, added to the name and tooltip while disabled. */
  unavailableLabel?: string | undefined
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  className?: string
}

function TransportButton({
  icon,
  label,
  showLabel = true,
  detail,
  shortcut,
  tone = 'neutral',
  pressed,
  onPressedChange,
  active = false,
  disabled = false,
  unavailableLabel,
  onClick,
  className,
}: TransportButtonProps) {
  const keys = shortcut === undefined ? [] : Array.isArray(shortcut) ? shortcut : [shortcut]
  const name = disabled && unavailableLabel ? `${label}, ${unavailableLabel}` : label
  const shown = cn(
    'hidden in-data-[distance=floor]:inline in-data-[distance=stand]:inline',
    showLabel === 'wide' ? 'xl:inline' : 'md:inline',
  )
  // The name is a visually hidden span, not aria-label: the printed key cap and detail are
  // decoration beside it, so the name and what is seen never disagree (WCAG 2.5.3).
  const content = (
    <>
      <span className="sr-only">{name}</span>
      {icon}
      {showLabel && tone !== 'primary' && (
        <span aria-hidden data-slot="transport-label" className={cn(shown, 'text-read-label')}>
          {label}
          {detail && <span className="ml-1.5 font-normal text-faint-foreground">{detail}</span>}
        </span>
      )}
      {keys.map((key) => (
        <Kbd
          key={key}
          aria-hidden
          className={cn(
            'pointer-coarse:hidden',
            tone === 'primary' && 'border-primary-foreground text-primary-foreground',
          )}
        >
          {key}
        </Kbd>
      ))}
    </>
  )
  const props = {
    'data-slot': 'transport-button',
    'data-tone': tone,
    'aria-keyshortcuts': keys.length > 0 ? keys.join(' ') : undefined,
    disabled,
    className: cn(base, tones[tone], className),
  }
  const control =
    pressed === undefined ? (
      <ButtonPrimitive {...props} data-active={active || undefined} onClick={onClick}>
        {content}
      </ButtonPrimitive>
    ) : (
      <TogglePrimitive
        {...props}
        pressed={pressed}
        onPressedChange={(next) => onPressedChange?.(next)}
      >
        {content}
      </TogglePrimitive>
    )
  return (
    <WithTooltip label={name} shortcut={shortcut}>
      {control}
    </WithTooltip>
  )
}

export { TransportButton }
