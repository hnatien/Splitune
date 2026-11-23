import { RotateCcwIcon } from 'lucide-react'
import { useId } from 'react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { MixPresetGroup } from '@/ui/mix-preset-group'
import { NumberField } from '@/ui/number-field'
import { Popover, PopoverTrigger } from '@/ui/popover'
import { PopoverContent } from '@/ui/popover-content'
import { formatDb, GAIN_RANGE, StemRow } from '@/ui/stem-row'
import { Switch } from '@/ui/switch'
import { presetName } from './mix-copy'
import { CLICK_RANGE, useMixerPrefs } from './mixer-prefs'
import { type MixPreset, presetOf, presetsFor } from './model/mixer'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'
import { stemKind, stemName } from './stem-names'

// The Mix tab (27 §3.7.4, Practice-Mix.dc.html): the presets as a 2 × 2 radio grid (Your part
// loud · Minus-one · Original · Rhythm only, the last when bass and drums are stems of their own),
// one row per stem in mixer order with your part first and badged ("Band" for the mix-minus when
// the stems aren't the whole song), Helpers (the click's level and switch, Hear the chords), Reset
// mix and "Use as default for {part}" (this device). A limiter keeps the master at or below
// 0 dBFS whatever the mix (12 §7). Before the stems: "The mixer opens once your part is
// isolated." The tablet and phone drawers show the same body.

const heading = 'text-body-sm font-medium text-muted-foreground'

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
})

export function MixTab({
  orientation = 'horizontal',
}: {
  orientation?: 'horizontal' | 'vertical'
}) {
  const { channels, mix, setMix, applyPreset, resetMix, saveDefaultMix, data, layers } =
    usePractice()
  const part = instrumentLabel(data.instrument).toLowerCase()
  if (!layers.stems) {
    return <p className="text-label text-muted-foreground">{m['practice.mix_wait']()}</p>
  }
  const labels = LABELS()
  return (
    <>
      <MixPresetGroup
        label={m['mixer.presets']()}
        value={presetOf(channels, mix)}
        onValueChange={applyPreset}
        orientation={orientation}
        options={presetsFor(channels).map((preset) => ({
          value: preset,
          label: presetName(preset),
          gloss: gloss(preset, part),
        }))}
      />
      <hr className="border-border" />
      <div className="flex flex-col gap-0.5">
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
      </div>
      <hr className="border-border" />
      <Helpers />
      <div className="flex-1" />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={resetMix}>
          <RotateCcwIcon aria-hidden />
          {m['mixer.reset']()}
        </Button>
        <Button variant="quiet" size="sm" onClick={saveDefaultMix}>
          {m['mixer.use_default']({ part })}
        </Button>
      </div>
    </>
  )
}

function Helpers() {
  const { layers, player, send } = usePractice()
  const clickId = useId()
  const chordsId = useId()
  const chordsHint = useId()
  const clickDb = useMixerPrefs((s) => s.clickDb)
  const hearChords = usePracticeUi((s) => s.hearChords)
  const clickName = m['mixer.click']()
  const level = m['mixer.click_level']()
  return (
    <section className="flex flex-col gap-1">
      <h3 className={heading}>{m['mixer.helpers']()}</h3>
      <div className="flex min-h-target-practice items-center gap-2">
        <Label htmlFor={clickId} className="flex-1 text-label font-medium">
          {clickName}
        </Label>
        <Popover>
          <PopoverTrigger
            aria-label={`${level}: ${formatDb(clickDb)}`}
            disabled={!layers.beats}
            className="inline-flex min-h-target-practice shrink-0 items-center justify-end rounded-field px-2 text-body-sm text-muted-foreground tabular-nums hover:bg-panel hover:text-foreground disabled:text-faint-foreground"
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
        <Switch
          id={clickId}
          checked={player.metronome && layers.beats}
          disabled={!layers.beats}
          onCheckedChange={(on) => send({ type: 'SET_METRONOME', on })}
        />
      </div>
      <div className="flex min-h-target-practice items-center gap-2">
        <span className="flex flex-1 flex-col">
          <Label htmlFor={chordsId} className="text-label font-medium">
            {m['mixer.hear_chords']()}
          </Label>
          <span id={chordsHint} className="text-body-sm text-faint-foreground">
            {m['mixer.hear_chords_hint']()}
          </span>
        </span>
        <Switch
          id={chordsId}
          aria-describedby={chordsHint}
          checked={hearChords && layers.chords}
          disabled={!layers.chords}
          onCheckedChange={(on) => usePracticeUi.setState({ hearChords: on })}
        />
      </div>
    </section>
  )
}
