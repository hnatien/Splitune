import type { StemKind } from '@splitune/ui-tokens'
import { RotateCcwIcon } from 'lucide-react'
import { useId } from 'react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { Label } from '@/ui/label'
import { MixPresetGroup } from '@/ui/mix-preset-group'
import { StemRow } from '@/ui/stem-row'
import { Switch } from '@/ui/switch'
import { defaultMix, presetOf } from './model/mixer'
import { usePractice } from './practice-context'

// The Mix tab (27 §3.7.4, Practice-Mix.dc.html with today's channels; every stem is s40b's): the
// presets as a 2 × 2 radio grid (Your part loud · Minus-one · Original; Rhythm only waits for
// s40b's stems), your part first with its badge and "Band" for the mix-minus, Helpers with the
// click, and Reset mix. A limiter keeps the master at unity whatever the mix (12 §7). Before the
// stems: "The mixer opens once your part is isolated." The phone drawer shows the same body.

const STEM_KIND: Record<string, StemKind> = {
  guitar: 'guitar',
  bass: 'bass',
  drums: 'drums',
  vocals: 'vocals',
  piano: 'keys',
}

const eyebrow = 'text-xs font-semibold tracking-wider text-faint-foreground uppercase'

export function MixTab({
  orientation = 'horizontal',
}: {
  orientation?: 'horizontal' | 'vertical'
}) {
  const { channels, mix, setMix, applyPreset, data, layers, player, send } = usePractice()
  const clickId = useId()
  const instrument = data.instrument
  const part = instrumentLabel(instrument)
  if (!layers.stems) {
    return <p className="text-md text-muted-foreground">{m['practice.mix_wait']()}</p>
  }
  return (
    <>
      <MixPresetGroup
        label={m['mixer.presets']()}
        value={presetOf(channels, mix)}
        onValueChange={applyPreset}
        orientation={orientation}
        options={[
          {
            value: 'part-loud',
            label: m['mixer.preset_part_loud'](),
            gloss: m['practice.preset_gloss_part_loud']({ part: part.toLowerCase() }),
          },
          {
            value: 'minus-one',
            label: m['mixer.preset_minus_one'](),
            gloss: m['practice.preset_gloss_minus_one'](),
          },
          {
            value: 'original',
            label: m['mixer.preset_original'](),
            gloss: m['practice.preset_gloss_original'](),
          },
        ]}
      />
      <hr className="border-border" />
      <div className="flex flex-col gap-0.5">
        {channels.map((channel) => {
          const state = mix[channel.stemId] ?? { gain_db: 0, muted: false, solo: false }
          const set = (patch: Partial<typeof state>) =>
            setMix({ ...mix, [channel.stemId]: { ...state, ...patch } })
          const yours = channel.role === 'part'
          return (
            <StemRow
              key={channel.stemId}
              stem={yours ? (STEM_KIND[instrument] ?? 'other') : 'mix'}
              name={yours ? part : m['mixer.backing']()}
              yourPart={yours ? m['mixer.your_part']() : undefined}
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
              onGainChange={(gain_db) => set({ gain_db })}
              labels={{
                mute: m['mixer.mute'](),
                solo: m['mixer.solo'](),
                volume: m['mixer.volume'](),
                decrease: m['mixer.quieter'](),
                increase: m['mixer.louder'](),
                muted: m['mixer.muted'](),
              }}
            />
          )
        })}
      </div>
      <hr className="border-border" />
      <section className="flex flex-col gap-2">
        <h3 className={eyebrow}>{m['mixer.helpers']()}</h3>
        <div className="flex min-h-target-practice-2 items-center gap-3">
          <Label htmlFor={clickId} className="flex-1 text-md font-semibold">
            {m['practice.metronome']()}
          </Label>
          <Switch
            id={clickId}
            checked={player.metronome && layers.beats}
            disabled={!layers.beats}
            onCheckedChange={(on) => send({ type: 'SET_METRONOME', on })}
          />
        </div>
      </section>
      <div className="flex-1" />
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        onClick={() => setMix(defaultMix(channels))}
      >
        <RotateCcwIcon aria-hidden />
        {m['mixer.reset']()}
      </Button>
    </>
  )
}
