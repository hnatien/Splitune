import type * as React from 'react'
import { useId } from 'react'
import { appearanceLabel } from '@/lib/appearance'
import {
  APPEARANCE_CHOICES,
  FOLLOW_MODES,
  PLAYHEAD_STYLES,
  useDisplay,
  usePracticeDefaults,
} from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { Kbd } from '@/ui/kbd'
import { Label } from '@/ui/label'
import { PopoverContent, PopoverTitle } from '@/ui/popover-content'
import { Slider } from '@/ui/slider'
import { Switch } from '@/ui/switch'
import { OptionSegments } from '../common/option-segments'
import { followLabel, playheadLabel } from './display-options'

// The Display and reading popover's body (Aa, 27 §3.7.4), in three hairline-divided groups:
// Appearance; Reading (where the screen is, the reading size, the Hyperlegible font); and the
// notation (unsure marks, with their key U, how the notation follows the music, the playhead and
// reduced motion). The same controls as Settings → Display & practice, per device and applied at
// once, so the music behind the popover shows each change (26 §2). Every choice is a row of
// pills with the ink edge on the chosen one. A stored `stage` shows Dark and the distance it
// resolved to; the store turns it into `dark` on the next change to either (26 §2).

function SwitchRow({
  label,
  checked,
  onChange,
  shortcut,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
  shortcut?: string
}) {
  const id = useId()
  return (
    <div className="flex min-h-target-practice items-center gap-3">
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onChange}
        {...(shortcut ? { 'aria-keyshortcuts': shortcut } : {})}
      />
      <Label htmlFor={id} className="flex-1">
        {label}
      </Label>
      {shortcut && (
        <Kbd aria-hidden className="pointer-coarse:hidden">
          {shortcut}
        </Kbd>
      )}
    </div>
  )
}

function Group({ title, children }: { title?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 border-t border-border pt-4 first:border-t-0 first:pt-0">
      {title && <h3 className="text-label-sm text-muted-foreground">{title}</h3>}
      {children}
    </section>
  )
}

/** The distance <html> resolved to, which a stored `stage` shows. */
function resolvedDistance(): 'desk' | 'stand' | 'floor' {
  const applied = document.documentElement.getAttribute('data-distance')
  return applied === 'desk' || applied === 'floor' ? applied : 'stand'
}

export function DisplayPanel() {
  const display = useDisplay()
  const practice = usePracticeDefaults()
  const calibrationId = useId()
  const stage = display.appearance === 'stage'
  return (
    <PopoverContent
      align="end"
      aria-label={m['nav.display_reading']()}
      className="max-h-[80dvh] w-[min(26rem,calc(100vw-2rem))] gap-4 overflow-y-auto"
    >
      <PopoverTitle>{m['nav.display_reading']()}</PopoverTitle>
      <Group>
        <OptionSegments
          label={m['nav.appearance']()}
          value={stage ? 'dark' : display.appearance}
          options={APPEARANCE_CHOICES.map((value) => ({ value, label: appearanceLabel(value) }))}
          onChange={(appearance) => display.update({ appearance })}
        />
      </Group>
      <Group title={m['settings.reading']()}>
        <OptionSegments
          label={m['settings.distance']()}
          value={stage ? (display.distance ?? resolvedDistance()) : (display.distance ?? 'auto')}
          options={[
            { value: 'auto', label: m['settings.distance_auto']() },
            { value: 'desk', label: m['settings.distance_desk']() },
            { value: 'stand', label: m['settings.distance_stand']() },
            { value: 'floor', label: m['settings.distance_floor']() },
          ]}
          onChange={(distance) =>
            display.update({ distance: distance === 'auto' ? undefined : distance })
          }
        />
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <Label id={calibrationId}>{m['settings.calibration']()}</Label>
            <span className="text-label-sm tabular-nums">
              {formatPercent(display.calibration * 100)}
            </span>
          </div>
          <Slider
            aria-labelledby={calibrationId}
            thumbLabels={[m['settings.calibration']()]}
            min={0.8}
            max={1.4}
            step={0.1}
            largeStep={0.2}
            value={display.calibration}
            onValueChange={(value) => display.update({ calibration: Number(value) })}
          />
        </div>
        <SwitchRow
          label={m['settings.hyperlegible']()}
          checked={display.readingFont === 'hyperlegible'}
          onChange={(on) => display.update({ readingFont: on ? 'hyperlegible' : 'inter' })}
        />
      </Group>
      <Group title={m['practice.display_notation']()}>
        <SwitchRow
          label={m['practice.show_uncertainty']()}
          checked={practice.showUncertainty}
          onChange={(on) => practice.update({ showUncertainty: on })}
          shortcut="U"
        />
        <OptionSegments
          label={m['practice.follow']()}
          value={practice.notationLayout}
          options={FOLLOW_MODES.map((value) => ({ value, label: followLabel(value) }))}
          onChange={(notationLayout) => practice.update({ notationLayout })}
        />
        <OptionSegments
          label={m['practice.playhead']()}
          value={practice.playhead}
          options={PLAYHEAD_STYLES.map((value) => ({ value, label: playheadLabel(value) }))}
          onChange={(playhead) => practice.update({ playhead })}
        />
        <OptionSegments
          label={m['settings.reduced_motion']()}
          value={display.motion}
          options={[
            { value: 'system', label: m['settings.follow_system']() },
            { value: 'reduce', label: m['settings.on']() },
            { value: 'full', label: m['settings.off']() },
          ]}
          onChange={(motion) => display.update({ motion })}
        />
      </Group>
    </PopoverContent>
  )
}
