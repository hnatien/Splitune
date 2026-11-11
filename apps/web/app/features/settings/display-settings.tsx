import { RestBetween } from '@splitune/contracts'
import { useQuery } from '@tanstack/react-query'
import type * as React from 'react'
import { useId } from 'react'
import type { z } from 'zod'
import { appearanceLabel } from '@/lib/appearance'
import {
  FOLLOW_MODES,
  MAX_SOUND_DELAY_MS,
  PLAYHEAD_STYLES,
  type PracticeDefaults,
  useDisplay,
  usePracticeDefaults,
} from '@/lib/display-store'
import { formatPercent } from '@/lib/format'
import { m } from '@/lib/i18n'
import { type MeData, meQuery } from '@/lib/session'
import { useHydrated } from '@/lib/use-hydrated'
import { Badge } from '@/ui/badge'
import { Card } from '@/ui/card'
import type { DisplayPreferences } from '@/ui/display'
import { Label } from '@/ui/label'
import { NumberField } from '@/ui/number-field'
import { SaveStatus } from '@/ui/save-status'
import { Slider } from '@/ui/slider'
import { followLabel, playheadLabel } from '../practice/display-options'
import { useUpdateMe } from './account-settings'
import { AppearanceCards } from './appearance-cards'
import {
  SectionRule,
  SegmentSetting,
  SettingRow,
  SettingSection,
  SettingsPage,
  SwitchSetting,
} from './setting-row'
import { type SaveState, useSaveState } from './use-save-state'

// Settings → Display & practice (27 §3.9, Settings-Display): Appearance, Reading, Motion, Practice
// defaults and the sound delay. Stored on this device (10 §3) and applied at once through the
// data-* attributes (26 §2); Left-handed is stored on the account, as before.
//
// `stage` (26 §2, D2) is a valid stored appearance without a card: it shows as Night Rehearsal with
// its resolved distance, and the next change to either control stores `dark` and the distance shown.

type Distance = NonNullable<DisplayPreferences['distance']>
type DistanceChoice = Distance | 'auto'

const DISTANCES: Record<DistanceChoice, () => string> = {
  auto: () => m['settings.distance_auto'](),
  desk: () => m['settings.distance_desk'](),
  stand: () => m['settings.distance_stand'](),
  floor: () => m['settings.distance_floor'](),
}

const choices = <T extends string>(labels: Record<T, () => string>) =>
  (Object.keys(labels) as T[]).map((value) => ({ value, label: labels[value]() }))

/** The distance <html> resolved to (after `stage` raised it); Music stand before hydration. */
function useResolvedDistance(): Distance {
  const hydrated = useHydrated()
  const applied = hydrated ? document.documentElement.getAttribute('data-distance') : null
  return applied === 'desk' || applied === 'floor' ? applied : 'stand'
}

export function DisplaySettings({ me }: { me: MeData }): React.ReactElement {
  return (
    <SettingsPage
      title={m['settings.display']()}
      badge={<Badge variant="success">{m['settings.device_badge']()}</Badge>}
    >
      <Appearance />
      <SectionRule />
      <Reading me={me} />
      <SectionRule />
      <Motion />
      <SectionRule />
      <PracticeDefaultsSection />
      <SoundDelay />
    </SettingsPage>
  )
}

function Appearance() {
  const display = useDisplay()
  const resolved = useResolvedDistance()
  const stored = display.appearance
  const stage = stored === 'stage'
  const save = useSaveState()
  const systemOnOff = (on: 'more'): { value: DisplayPreferences['contrast']; label: string }[] => [
    { value: 'system', label: m['settings.follow_system']() },
    { value: on, label: m['settings.on']() },
    { value: 'normal', label: m['settings.off']() },
  ]
  return (
    <SettingSection
      id="appearance"
      title={m['nav.appearance']()}
      aside={<SaveStatusSlot state={save.state} />}
    >
      <AppearanceCards
        label={m['nav.appearance']()}
        value={stored === 'stage' ? 'dark' : stored}
        options={(['dark', 'light', 'system'] as const).map((value) => ({
          value,
          label: appearanceLabel(value),
          hint:
            value === 'dark'
              ? m['appearance.dark_hint']()
              : value === 'light'
                ? m['appearance.light_hint']()
                : m['appearance.system_hint'](),
        }))}
        onChange={(appearance) =>
          save.run(() =>
            display.update(
              stage ? { appearance, distance: display.distance ?? resolved } : { appearance },
            ),
          )
        }
      />
      <SegmentSetting
        label={m['settings.increase_contrast']()}
        value={display.contrast}
        options={systemOnOff('more')}
        onChange={(contrast) => display.update({ contrast })}
      />
    </SettingSection>
  )
}

function SaveStatusSlot({ state }: { state: SaveState }) {
  return (
    <SaveStatus
      state={state}
      savingLabel={m['settings.saving']()}
      savedLabel={m['settings.saved']()}
      errorLabel={m['settings.save_failed']()}
    />
  )
}

function Reading({ me }: { me: MeData }) {
  const display = useDisplay()
  const resolved = useResolvedDistance()
  const defaults = usePracticeDefaults()
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  const updateMe = useUpdateMe()
  const stage = display.appearance === 'stage'
  // A stored `stage` shows the distance it resolved to; Automatic stays Automatic otherwise.
  const distance: DistanceChoice = stage
    ? (display.distance ?? resolved)
    : (display.distance ?? 'auto')
  return (
    <SettingSection id="reading" title={m['settings.reading']()}>
      <SegmentSetting
        label={m['settings.distance']()}
        value={distance}
        options={choices(DISTANCES)}
        onChange={(value) =>
          display.update({
            distance: value === 'auto' ? undefined : value,
            ...(stage ? { appearance: 'dark' as const } : {}),
          })
        }
      />
      <ReadingSize />
      <SwitchSetting
        label={m['settings.hyperlegible']()}
        hint={m['settings.hyperlegible_hint']()}
        checked={display.readingFont === 'hyperlegible'}
        onChange={(on) => display.update({ readingFont: on ? 'hyperlegible' : 'inter' })}
      />
      <SwitchSetting
        label={m['practice.show_uncertainty']()}
        hint={m['settings.show_uncertainty_hint']()}
        checked={defaults.showUncertainty}
        onChange={(on) => defaults.update({ showUncertainty: on })}
      />
      <SwitchSetting
        label={m['settings.left_handed']()}
        hint={m['settings.left_handed_hint']()}
        checked={current.handedness === 'left'}
        onChange={(on) => updateMe({ handedness: on ? 'left' : 'right' })}
      />
    </SettingSection>
  )
}

// Reading size (26 §6.3): 80–140 % in 10 % steps, with a live sample at the reading sizes.
function ReadingSize() {
  const calibration = useDisplay((s) => s.calibration)
  const update = useDisplay((s) => s.update)
  const save = useSaveState()
  const id = useId()
  const hintId = useId()
  const size = formatPercent(calibration * 100)
  return (
    <Card className="flex-row flex-wrap items-center gap-x-6 gap-y-4 p-4">
      <div className="flex min-w-0 grow basis-65 flex-col gap-2">
        <div className="flex items-center gap-2.5">
          <Label id={id} className="flex-1">
            {m['settings.calibration']()}
          </Label>
          <SaveStatusSlot state={save.state} />
          <span className="font-mono text-sm text-muted-foreground tabular-nums">{size}</span>
        </div>
        <Slider
          aria-labelledby={id}
          aria-describedby={hintId}
          thumbLabels={[m['settings.calibration']()]}
          min={0.8}
          max={1.4}
          step={0.1}
          largeStep={0.2}
          value={calibration}
          onValueChange={(value) => save.run(() => update({ calibration: Number(value) }))}
        />
        <span id={hintId} className="text-sm text-faint-foreground">
          {m['settings.calibration_hint']()}
        </span>
      </div>
      <div
        data-density="practice"
        role="img"
        aria-label={m['settings.sample_label']({ size })}
        className="flex items-center gap-5 text-foreground"
      >
        <span aria-hidden className="text-read-chord-sheet font-semibold">
          {m['settings.sample_chord']()}
        </span>
        <span
          aria-hidden
          className="font-reading text-read-tab font-semibold tracking-widest tabular-nums"
        >
          {m['settings.sample_tab']()}
        </span>
      </div>
    </Card>
  )
}

function Motion() {
  const display = useDisplay()
  const layout = usePracticeDefaults((s) => s.notationLayout)
  const playhead = usePracticeDefaults((s) => s.playhead)
  const updateDefaults = usePracticeDefaults((s) => s.update)
  return (
    <SettingSection id="motion" title={m['settings.motion']()}>
      <SegmentSetting
        label={m['settings.follow']()}
        value={layout}
        options={FOLLOW_MODES.map((value) => ({ value, label: followLabel(value) }))}
        onChange={(notationLayout) => updateDefaults({ notationLayout })}
      />
      <SegmentSetting
        label={m['practice.playhead']()}
        value={playhead}
        options={PLAYHEAD_STYLES.map((value) => ({ value, label: playheadLabel(value) }))}
        onChange={(style) => updateDefaults({ playhead: style })}
      />
      <SegmentSetting
        label={m['settings.reduced_motion']()}
        hint={m['settings.reduced_motion_hint']()}
        value={display.motion}
        options={[
          { value: 'system', label: m['settings.follow_system']() },
          { value: 'reduce', label: m['settings.on']() },
          { value: 'full', label: m['settings.off']() },
        ]}
        onChange={(motion) => display.update({ motion })}
      />
    </SettingSection>
  )
}

function PracticeDefaultsSection() {
  const defaults = usePracticeDefaults()
  const speed = useSaveState()
  const speedId = useId()
  const ladder = useSaveState()
  const ladderId = useId()
  const set = (patch: Partial<PracticeDefaults>) => defaults.update(patch)
  const rests: Record<z.infer<typeof RestBetween>, string> = {
    none: m['settings.rest_none'](),
    beat: m['settings.rest_beat'](),
    bar: m['settings.rest_bar'](),
  }
  return (
    <SettingSection id="defaults" title={m['settings.practice_defaults']()}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(15rem,100%),1fr))] gap-3">
        <Card className="gap-2 p-3.5">
          <SettingRow label={m['settings.default_speed']()} htmlFor={speedId} state={speed.state}>
            <NumberField
              id={speedId}
              min={25}
              max={110}
              step={5}
              unit="%"
              value={defaults.speedPct}
              decrementLabel={m['settings.speed_decrease']()}
              incrementLabel={m['settings.speed_increase']()}
              onValueChange={(value) => value !== null && speed.run(() => set({ speedPct: value }))}
            />
          </SettingRow>
        </Card>
        <Card className="gap-2 p-3.5">
          <SettingRow
            label={m['ladder.title']()}
            hint={
              defaults.ladderCleanPasses === 1
                ? m['ladder.setting_value_one']()
                : m['ladder.setting_value']({ passes: String(defaults.ladderCleanPasses) })
            }
            htmlFor={ladderId}
            state={ladder.state}
          >
            <NumberField
              id={ladderId}
              min={1}
              max={20}
              step={1}
              value={defaults.ladderCleanPasses}
              decrementLabel={m['ladder.fewer_passes']()}
              incrementLabel={m['ladder.more_passes']()}
              onValueChange={(value) =>
                value !== null && ladder.run(() => set({ ladderCleanPasses: Math.round(value) }))
              }
            />
          </SettingRow>
          <SwitchSetting
            label={m['ladder.setting_new_loops']()}
            hint={m['ladder.setting_goal']()}
            checked={defaults.ladderNewLoops}
            onChange={(on) => set({ ladderNewLoops: on })}
          />
        </Card>
        <Card className="gap-2 p-3.5">
          <SegmentSetting
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
        </Card>
        <Card className="gap-2 p-3.5">
          <SegmentSetting
            label={m['settings.rest']()}
            value={defaults.restBetween}
            options={RestBetween.options.map((value) => ({ value, label: rests[value] }))}
            onChange={(restBetween) => set({ restBetween })}
          />
        </Card>
      </div>
    </SettingSection>
  )
}

// The display offset (11 §3, 24 §3): what the browser's reported output latency misses, mostly
// Bluetooth headphones. The cursor and beat counter follow the sound this much later. Tap-along
// measuring is s42's; until then the stepper is the whole card.
function SoundDelay() {
  const delay = usePracticeDefaults((s) => s.soundDelayMs)
  const update = usePracticeDefaults((s) => s.update)
  const save = useSaveState()
  const id = useId()
  return (
    <Card className="flex-row flex-wrap items-center gap-5 p-5">
      <SettingSection
        id="sound-delay"
        title={m['settings.sound_delay']()}
        className="grow basis-85"
      >
        <p className="text-sm text-muted-foreground">{m['settings.sound_delay_hint']()}</p>
      </SettingSection>
      <SettingRow label={m['settings.sound_delay']()} htmlFor={id} state={save.state}>
        <NumberField
          id={id}
          min={-MAX_SOUND_DELAY_MS}
          max={MAX_SOUND_DELAY_MS}
          step={10}
          unit="ms"
          value={delay}
          decrementLabel={m['settings.sound_delay_decrease']()}
          incrementLabel={m['settings.sound_delay_increase']()}
          onValueChange={(value) =>
            value !== null && save.run(() => update({ soundDelayMs: value }))
          }
        />
      </SettingRow>
    </Card>
  )
}
