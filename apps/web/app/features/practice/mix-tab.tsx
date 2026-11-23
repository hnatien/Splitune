import { RotateCcwIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { Kbd } from '@/ui/kbd'
import { MixPresetList } from '@/ui/mix-preset-group'
import { NumberField } from '@/ui/number-field'
import { PanelSection } from '@/ui/panel'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { Status } from '@/ui/status'
import { formatDb, GAIN_RANGE, StemRow } from '@/ui/stem-row'
import { SwitchRow } from '../common/switch-row'
import { keyLabel } from './input-mapper'
import { presetName } from './mix-copy'
import { CLICK_RANGE, useMixerPrefs } from './mixer-prefs'
import { type MixPreset, presetOf, presetsFor } from './model/mixer'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { stemKind, stemName } from './stem-names'
import { VolumeFields } from './transport'

// The Mix tab (27 §3.7.4; s47 direction §8): the presets as a list of rows with a check (Your part
// loud · Minus-one · Original · Rhythm only, the last when bass and drums are stems of their own;
// none checked when the mix matches no preset); one row per stem in mixer order with your part
// first and named ("Band" for the mix-minus when the stems aren't the whole song). While a stem is
// soloed every other row says "Not heard" and dims its name and readout, so solo reads by more
// than its filled S. Then Helpers (the click and its level, Hear the chords), the master volume
// (this device), Reset mix and "Use as default for {part}". A limiter keeps the master at or below
// 0 dBFS whatever the mix (12 §7). Before the stems it says what it waits for; once they have been
// removed it says so. The tablet drawer and the phone's "All stems" show the same body.

function gloss(preset: MixPreset, part: string): string {
  switch (preset) {
    case 'part-loud':
      return m['practice.preset_gloss_part_loud']({ part })
    case 'minus-one':
      return m['practice.preset_gloss_minus_one']()
    case 'rhythm':
      return m['practice.preset_gloss_rhythm']()
    default:
      return m['practice.preset_gloss_original']()
  }
}

const LABELS = () => ({
  mute: m['mixer.mute'](),
  solo: m['mixer.solo'](),
  volume: m['mixer.volume'](),
  decrease: m['mixer.quieter'](),
  increase: m['mixer.louder'](),
  muted: m['mixer.muted'](),
  soloed: m['mixer.soloed'](),
  notHeard: m['mixer.not_heard'](),
})

/** Before the stems, or after they were removed: what the mixer waits for, as a glyph and words. */
export function MixUnavailable() {
  const { data } = usePractice()
  return data.stemsExpired ? (
    <Status kind="expired" className="whitespace-normal [&>span:last-child]:whitespace-normal">
      {m['practice.stems_expired']()}
    </Status>
  ) : (
    <Status kind="queued" className="[&>span:last-child]:whitespace-normal">
      {m['practice.mix_wait']()}
    </Status>
  )
}

export function MixTab(_: { orientation?: 'horizontal' | 'vertical' }) {
  const { channels, mix, setMix, applyPreset, resetMix, saveDefaultMix, data, layers } =
    usePractice()
  const part = instrumentLabel(data.instrument).toLowerCase()
  if (!layers.stems) {
    return (
      <div data-slot="mix-tab" className="flex flex-col gap-4">
        <MixUnavailable />
        <Helpers />
        <MasterVolume />
      </div>
    )
  }
  const labels = LABELS()
  const soloing = channels.some((channel) => mix[channel.stemId]?.solo)
  return (
    <div data-slot="mix-tab" className="flex flex-col [&>section:first-child]:pt-0">
      <PanelSection>
        <MixPresetList
          label={m['mixer.presets']()}
          value={presetOf(channels, mix)}
          onValueChange={applyPreset}
          options={presetsFor(channels).map((preset) => ({
            value: preset,
            label: presetName(preset),
            gloss: gloss(preset, part),
          }))}
        />
      </PanelSection>
      <PanelSection
        title={m['mixer.stems']()}
        action={
          <span className="flex items-center gap-1.5 text-caption text-muted-foreground pointer-coarse:hidden">
            <Kbd aria-hidden>{keyLabel('m')}</Kbd>
            {m['shortcuts.mute_part']()}
          </span>
        }
        className="gap-1"
      >
        {channels.map((channel) => {
          const state = mix[channel.stemId] ?? { gain_db: 0, muted: false, solo: false }
          const set = (patch: Partial<typeof state>) =>
            setMix({ ...mix, [channel.stemId]: { ...state, ...patch } })
          return (
            <StemRow
              key={channel.stemId}
              stem={stemKind(channel)}
              name={stemName(channel)}
              yourPart={channel.role === 'part' ? m['mixer.your_part']() : undefined}
              rough={
                channel.rough
                  ? { label: m['mixer.rough'](), reason: m['practice.rough_stem']() }
                  : undefined
              }
              muted={state.muted}
              soloed={state.solo}
              notHeard={soloing && !state.solo}
              gainDb={state.gain_db}
              onMutedChange={(muted) => set({ muted })}
              onSoloedChange={(solo) => set({ solo })}
              onGainChange={(gain_db) =>
                set({ gain_db: Math.min(GAIN_RANGE.max, Math.max(GAIN_RANGE.min, gain_db)) })
              }
              labels={labels}
            />
          )
        })}
      </PanelSection>
      <Helpers />
      <MasterVolume />
      <PanelSection>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetMix}>
            <RotateCcwIcon aria-hidden />
            {m['mixer.reset']()}
          </Button>
          <Button variant="quiet" onClick={saveDefaultMix}>
            {m['mixer.use_default']({ part })}
          </Button>
        </div>
      </PanelSection>
    </div>
  )
}

/** The click (with its level, a stepper behind the readout) and Hear the chords. */
export function Helpers() {
  const { layers, player, send } = usePractice()
  const clickDb = useMixerPrefs((s) => s.clickDb)
  const hearChords = usePracticeUi((s) => s.hearChords)
  const clickName = m['mixer.click']()
  const level = m['mixer.click_level']()
  return (
    <PanelSection title={m['mixer.helpers']()} className="gap-0">
      <SwitchRow
        label={clickName}
        checked={player.metronome && layers.beats}
        disabled={!layers.beats}
        onCheckedChange={(on) => send({ type: 'SET_METRONOME', on })}
        aside={
          <Popover>
            <PopoverTrigger
              aria-label={`${level}: ${formatDb(clickDb)}`}
              disabled={!layers.beats}
              className="inline-flex min-h-target-practice shrink-0 items-center justify-end rounded-full px-3 text-body-sm text-muted-foreground tabular-nums inset-ring inset-ring-transparent hover:bg-hover hover:text-foreground disabled:text-faint-foreground aria-expanded:inset-ring-[1.5px] aria-expanded:inset-ring-selected"
            >
              {formatDb(clickDb)}
            </PopoverTrigger>
            <PopoverContent side="top" aria-label={level} className="w-auto">
              <NumberField
                value={clickDb}
                min={CLICK_RANGE.min}
                max={CLICK_RANGE.max}
                step={1}
                onValueChange={(next) => next !== null && useMixerPrefs.getState().setClickDb(next)}
                unit="dB"
                inputLabel={level}
                decrementLabel={`${m['mixer.quieter']()} ${clickName}`}
                incrementLabel={`${m['mixer.louder']()} ${clickName}`}
              />
            </PopoverContent>
          </Popover>
        }
      />
      <SwitchRow
        label={m['mixer.hear_chords']()}
        hint={m['mixer.hear_chords_hint']()}
        checked={hearChords && layers.chords}
        disabled={!layers.chords}
        onCheckedChange={(on) => usePracticeUi.setState({ hearChords: on })}
      />
    </PanelSection>
  )
}

/** The master volume on this device: mute and a fader (the transport's volume, here too). */
function MasterVolume() {
  return (
    <PanelSection title={m['practice.volume']()}>
      <div className="flex items-center gap-2 [&>div]:min-w-0 [&>div]:flex-1">
        <VolumeFields />
      </div>
    </PanelSection>
  )
}
