import { RestBetween } from '@splitune/contracts'
import type * as React from 'react'
import { useId } from 'react'
import type { z } from 'zod'
import { appearanceLabel } from '@/lib/appearance'
import { type PracticeDefaults, useDisplay, usePracticeDefaults } from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import type { DisplayPreferences } from '@/ui/display'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { Slider } from '@/ui/slider'
import { Switch } from '@/ui/switch'
import { OptionSelect } from '../common/option-select'
import { SettingRow } from './setting-row'
import { useSaveState } from './use-save-state'

// Display & practice (27 §3.9): the Display popover's controls plus practice defaults. Stored on
// this device only (10 §3), applied immediately through the data-* attributes (26 §2).

type Choice<T extends string> = { value: T; label: string }

function useDeviceSetting() {
  const save = useSaveState()
  return { state: save.state, apply: (change: () => void) => save.run(change) }
}

function Row<T extends string>({
  label,
  value,
  options,
  onChange,
  description,
}: {
  label: string
  value: T
  options: Choice<T>[]
  onChange: (value: T) => void
  description?: string
}) {
  const setting = useDeviceSetting()
  return (
    <SettingRow state={setting.state} {...(description ? { description } : {})}>
      <OptionSelect
        label={label}
        value={value}
        options={options}
        onChange={(next) => setting.apply(() => onChange(next))}
        className="w-64"
      />
    </SettingRow>
  )
}

function SwitchRow({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: (on: boolean) => void
}) {
  const setting = useDeviceSetting()
  const id = useId()
  return (
    <SettingRow state={setting.state}>
      <div className="flex min-h-control items-center gap-3">
        <Switch
          id={id}
          checked={checked}
          onCheckedChange={(on) => setting.apply(() => onChange(on))}
        />
        <Label htmlFor={id}>{label}</Label>
      </div>
    </SettingRow>
  )
}

const DISTANCE = { auto: 'auto', desk: 'desk', stand: 'stand', floor: 'floor' } as const

function Calibration() {
  const calibration = useDisplay((s) => s.calibration)
  const update = useDisplay((s) => s.update)
  const setting = useDeviceSetting()
  const id = useId()
  return (
    <SettingRow state={setting.state} description={m['settings.calibration_hint']()}>
      <div className="flex w-full max-w-md flex-col gap-3">
        <Label id={id}>{m['settings.calibration']()}</Label>
        <Slider
          aria-labelledby={id}
          thumbLabels={[m['settings.calibration']()]}
          min={0.8}
          max={1.4}
          step={0.1}
          largeStep={0.2}
          value={calibration}
          onValueChange={(value) => setting.apply(() => update({ calibration: Number(value) }))}
        />
        <p
          data-density="practice"
          className="font-reading text-read-tab font-semibold tabular-nums text-foreground"
        >
          {m['settings.calibration_sample']({ size: formatPercent(calibration * 100) })}
        </p>
      </div>
    </SettingRow>
  )
}

function PracticeDefaultsSection() {
  const defaults = usePracticeDefaults()
  const speed = useDeviceSetting()
  const speedId = useId()
  const set = (patch: Partial<PracticeDefaults>) => defaults.update(patch)
  const rests: Record<z.infer<typeof RestBetween>, string> = {
    none: m['settings.rest_none'](),
    beat: m['settings.rest_beat'](),
    bar: m['settings.rest_bar'](),
  }
  return (
    <>
      <h2 className="mt-8 text-xl">{m['settings.practice_defaults']()}</h2>
      <SettingRow state={speed.state}>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor={speedId}>{m['settings.default_speed']()}</Label>
          <NumberField
            id={speedId}
            min={25}
            max={100}
            step={5}
            unit="%"
            value={defaults.speedPct}
            decrementLabel={m['settings.speed_decrease']()}
            incrementLabel={m['settings.speed_increase']()}
            onValueChange={(value) => value !== null && speed.apply(() => set({ speedPct: value }))}
          />
        </div>
      </SettingRow>
      <Row
        label={m['settings.count_in']()}
        value={String(defaults.countInBars)}
        options={['0', '1', '2'].map((value) => ({
          value,
          label:
            value === '0'
              ? m['settings.count_in_off']()
              : value === '1'
                ? m['settings.count_in_one_bar']()
                : m['settings.count_in_bars']({ bars: value }),
        }))}
        onChange={(value) => set({ countInBars: Number(value) })}
      />
      <Row
        label={m['settings.rest']()}
        value={defaults.restBetween}
        options={RestBetween.options.map((value) => ({ value, label: rests[value] }))}
        onChange={(value) => set({ restBetween: value })}
      />
    </>
  )
}

export function DisplaySettings(): React.ReactElement {
  const display = useDisplay()
  const update = display.update
  const systemOnOff = (key: 'contrast' | 'motion', on: string): Choice<string>[] => [
    { value: 'system', label: m['settings.follow_system']() },
    { value: on, label: m['settings.on']() },
    { value: key === 'contrast' ? 'normal' : 'full', label: m['settings.off']() },
  ]
  return (
    <section className="flex flex-col">
      <h2 className="text-xl">{m['settings.display']()}</h2>
      <Row
        label={m['nav.appearance']()}
        value={display.appearance}
        options={(['system', 'light', 'dark', 'stage'] as const).map((value) => ({
          value,
          label: appearanceLabel(value),
        }))}
        onChange={(appearance) => update({ appearance })}
      />
      <Row
        label={m['settings.score']()}
        value={display.score}
        options={[
          { value: 'paper', label: m['settings.score_paper']() },
          { value: 'match', label: m['settings.score_match']() },
        ]}
        onChange={(score) => update({ score })}
        description={m['settings.score_hint']()}
      />
      <Row
        label={m['settings.distance']()}
        value={display.distance ?? DISTANCE.auto}
        options={[
          { value: 'auto', label: m['settings.distance_auto']() },
          { value: 'desk', label: m['settings.distance_desk']() },
          { value: 'stand', label: m['settings.distance_stand']() },
          { value: 'floor', label: m['settings.distance_floor']() },
        ]}
        onChange={(value) =>
          update({
            distance: value === 'auto' ? undefined : (value as DisplayPreferences['distance']),
          })
        }
      />
      <Calibration />
      <SwitchRow
        label={m['settings.hyperlegible']()}
        checked={display.readingFont === 'hyperlegible'}
        onChange={(on) => update({ readingFont: on ? 'hyperlegible' : 'inter' })}
      />
      <Row
        label={m['settings.reduced_motion']()}
        value={display.motion}
        options={systemOnOff('motion', 'reduce')}
        onChange={(motion) => update({ motion: motion as DisplayPreferences['motion'] })}
      />
      <Row
        label={m['settings.increase_contrast']()}
        value={display.contrast}
        options={systemOnOff('contrast', 'more')}
        onChange={(contrast) => update({ contrast: contrast as DisplayPreferences['contrast'] })}
      />
      <PracticeDefaultsSection />
    </section>
  )
}
