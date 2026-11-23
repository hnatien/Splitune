import type * as React from 'react'
import { useId } from 'react'
import { cn } from '@/lib/utils'
import { Label } from '@/ui/label'
import { Switch } from '@/ui/switch'

// A setting that is on or off, as a row inside a panel section (26 §12.1): the label and an
// optional line under it on the left, the switch on the right, a practice-size target. The line
// under the label describes the switch, so a screen reader hears it after the name.
export function SwitchRow({
  label,
  hint,
  checked,
  onCheckedChange,
  disabled = false,
  aside,
  className,
}: {
  label: React.ReactNode
  hint?: React.ReactNode
  checked: boolean
  onCheckedChange: (checked: boolean) => void
  disabled?: boolean
  /** Shown before the switch (a level readout, a key cap). */
  aside?: React.ReactNode
  className?: string
}) {
  const id = useId()
  const hintId = useId()
  return (
    <div
      data-slot="switch-row"
      className={cn('flex min-h-target-practice items-center gap-3', className)}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <Label htmlFor={id} className={cn('text-label', disabled && 'text-faint-foreground')}>
          {label}
        </Label>
        {hint && (
          <span id={hintId} className="text-body-sm text-muted-foreground">
            {hint}
          </span>
        )}
      </span>
      {aside}
      <Switch
        id={id}
        aria-describedby={hint ? hintId : undefined}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  )
}
