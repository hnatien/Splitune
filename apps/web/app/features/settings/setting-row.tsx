import type * as React from 'react'
import { useId } from 'react'
import { m } from '@/lib/i18n'
import { cn } from '@/lib/utils'
import { SaveStatus } from '@/ui/save-status'
import { Switch } from '@/ui/switch'
import { ToggleGroup, ToggleGroupItem } from '@/ui/toggle-group'
import { type SaveState, useSaveState } from './use-save-state'

// The parts every settings section is built from (s47 direction §6, 27 §3.9): a page title and
// its one line, then groups set apart by space and one hairline, each a heading over plain rows
// divided by hairlines (`SettingRows`), the label (and its hint) on the left and the control on
// the right, wrapping under it on narrow screens. Nothing is boxed. Each field saves on its own and
// says so next to its label (no global save).

export function SettingsPage({
  title,
  intro,
  children,
}: {
  title: string
  /** One line under the title: what the page is for, or where it is stored. */
  intro?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-heading">{title}</h1>
        {intro && <p className="text-body-sm text-muted-foreground">{intro}</p>}
      </div>
      {children}
    </div>
  )
}

export function SettingSection({
  id,
  title,
  aside,
  description,
  children,
  className,
}: {
  id: string
  title: string
  aside?: React.ReactNode
  /** A line under the heading that explains the whole group. */
  description?: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn('flex scroll-mt-24 flex-col gap-2', className)}
    >
      <div className="flex flex-col gap-0.5">
        <div className="flex min-h-6 flex-wrap items-center gap-2.5">
          <h2 id={`${id}-title`} className="flex-1 text-label-sm text-muted-foreground">
            {title}
          </h2>
          {aside}
        </div>
        {description && <p className="text-body-sm text-muted-foreground">{description}</p>}
      </div>
      {children}
    </section>
  )
}

/** A group's rows, divided by hairlines: each direct child is one row. */
export function SettingRows({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col divide-y divide-border border-t border-border *:py-3',
        className,
      )}
    >
      {children}
    </div>
  )
}

/** The label column: the label, the inline save status, and the hint under them. */
function LabelColumn({
  label,
  labelId,
  htmlFor,
  hint,
  hintId,
  state,
}: {
  label: string
  labelId: string
  htmlFor?: string | undefined
  hint?: string | undefined
  hintId: string
  state: SaveState
}) {
  const text = htmlFor ? (
    <label id={labelId} htmlFor={htmlFor} className="text-label">
      {label}
    </label>
  ) : (
    <span id={labelId} className="text-label">
      {label}
    </span>
  )
  return (
    <div className="flex min-w-0 grow basis-50 flex-col gap-0.5">
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
        {text}
        <SaveStatus
          state={state}
          savingLabel={m['settings.saving']()}
          savedLabel={m['settings.saved']()}
          errorLabel={m['settings.save_failed']()}
        />
      </div>
      {hint && (
        <span id={hintId} className="text-body-sm text-muted-foreground">
          {hint}
        </span>
      )}
    </div>
  )
}

/** A choice between two to six options, every one visible (`.seg`). One is always selected. */
export function SegmentSetting<T extends string>({
  label,
  hint,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  value: T
  options: readonly { value: T; label: string }[]
  /** Saves the choice; a rejected promise shows "Couldn't save. Try again.". */
  onChange: (value: T) => unknown
  disabled?: boolean
}) {
  const save = useSaveState()
  const labelId = useId()
  const hintId = useId()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LabelColumn label={label} labelId={labelId} hint={hint} hintId={hintId} state={save.state} />
      <ToggleGroup
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        disabled={disabled}
        className="max-w-full flex-wrap"
        value={[value]}
        onValueChange={(next) => {
          const picked = next[0] as T | undefined
          if (picked && picked !== value) void save.run(() => onChange(picked))
        }}
      >
        {options.map((option) => (
          <ToggleGroupItem key={option.value} value={option.value}>
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  )
}

/** An on/off setting; the label and hint are part of the switch's target (26 §12.1). */
export function SwitchSetting({
  label,
  hint,
  checked,
  onChange,
  disabled,
}: {
  label: string
  hint?: string
  checked: boolean
  onChange: (on: boolean) => unknown
  disabled?: boolean
}) {
  const save = useSaveState()
  const id = useId()
  const labelId = useId()
  const hintId = useId()
  return (
    <div className="flex min-h-target items-center gap-3">
      <LabelColumn
        label={label}
        labelId={labelId}
        htmlFor={id}
        hint={hint}
        hintId={hintId}
        state={save.state}
      />
      <Switch
        id={id}
        aria-labelledby={labelId}
        aria-describedby={hint ? hintId : undefined}
        checked={checked}
        disabled={disabled}
        onCheckedChange={(on) => void save.run(() => onChange(on))}
      />
    </div>
  )
}

/** A row whose control the caller renders (a field, a stepper); `useSaveState` feeds `state`. */
export function SettingRow({
  label,
  hint,
  htmlFor,
  state,
  children,
}: {
  label: string
  hint?: string
  htmlFor?: string
  state: SaveState
  children: React.ReactNode
}) {
  const labelId = useId()
  const hintId = useId()
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
      <LabelColumn
        label={label}
        labelId={labelId}
        htmlFor={htmlFor}
        hint={hint}
        hintId={hintId}
        state={state}
      />
      {children}
    </div>
  )
}
