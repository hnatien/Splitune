import type { StemKind } from '@splitune/ui-tokens'
import { RotateCcwIcon } from 'lucide-react'
import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { Button } from '@/ui/button'
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from '@/ui/drawer'
import { MixPresetGroup } from '@/ui/mix-preset-group'
import { StemRow } from '@/ui/stem-row'
import { defaultMix, presetOf } from './model/mixer'
import { usePractice } from './practice-context'
import { usePracticeUi } from './practice-store'

// MixerDrawer (12 §7, 27 §3.7.4): "Your part" first, presets at the top with a line saying what the
// chosen one does, M/S/volume per stem on its own card with the rough-stem warning as text and
// icon, Reset mix. A right drawer at 320 px; a bottom sheet at 70 % height on phones. Changes are
// instant (gains before the stretch).

const STEM_KIND: Record<string, StemKind> = {
  guitar: 'guitar',
  bass: 'bass',
  drums: 'drums',
  vocals: 'vocals',
  piano: 'keys',
}

export function MixerDrawer({ phone }: { phone: boolean }) {
  const { channels, mix, setMix, applyPreset, data } = usePractice()
  const open = usePracticeUi((s) => s.mixerOpen)
  const instrument = data.instrument
  return (
    <Drawer
      open={open}
      onOpenChange={(next) => usePracticeUi.setState({ mixerOpen: next })}
      swipeDirection={phone ? 'down' : 'right'}
      modal={false}
    >
      <DrawerContent
        className={
          phone
            ? '[--drawer-height:70dvh]'
            : 'data-[swipe-axis=x]:sm:[--drawer-content-width:20rem]'
        }
      >
        <DrawerHeader>
          <DrawerTitle>{m['mixer.title']()}</DrawerTitle>
          <DrawerDescription className="sr-only">{m['mixer.description']()}</DrawerDescription>
        </DrawerHeader>
        <div className="flex flex-col gap-4 overflow-y-auto px-4 pb-6">
          <MixPresetGroup
            label={m['mixer.presets']()}
            value={presetOf(channels, mix)}
            onValueChange={applyPreset}
            options={[
              {
                value: 'part-loud',
                label: m['mixer.preset_part_loud'](),
                gloss: m['practice.preset_gloss_part_loud'](),
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
            className="flex-wrap"
          />
          <div className="flex flex-col gap-2">
            {channels.map((channel) => {
              const state = mix[channel.stemId] ?? { gain_db: 0, muted: false, solo: false }
              const set = (patch: Partial<typeof state>) =>
                setMix({ ...mix, [channel.stemId]: { ...state, ...patch } })
              const part = channel.role === 'part'
              return (
                <StemRow
                  key={channel.stemId}
                  className="sm:grid-cols-[auto_1fr]"
                  stem={part ? (STEM_KIND[instrument] ?? 'other') : 'mix'}
                  name={part ? instrumentLabel(instrument) : m['mixer.backing']()}
                  yourPart={part ? m['mixer.your_part']() : undefined}
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
                  }}
                />
              )
            })}
          </div>
          <Button
            variant="outline"
            className="self-start"
            onClick={() => setMix(defaultMix(channels))}
          >
            <RotateCcwIcon aria-hidden />
            {m['mixer.reset']()}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  )
}
