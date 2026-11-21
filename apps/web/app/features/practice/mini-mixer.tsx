import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { Slider } from '@/ui/slider'
import { GAIN_RANGE, STEM_FILL, STEM_RULE, StemToggle } from '@/ui/stem-row'
import { Toggle } from '@/ui/toggle'
import { presetName } from './mix-copy'
import { bandLevel, presetOf, presetsFor, withBandLevel, withBandMuted } from './model/mixer'
import { usePractice } from './practice-context'
import { stemKind } from './stem-names'

// The phone mini-mixer (27 §3.7.2, Phone-Tools.dc.html): preset chips, then two rows, "{part} ·
// your part" and "Band" (every other stem as one fader that keeps their balance), each a stepped
// fader (a tap on the track sets it, 3 dB steps) and an M painted 44 in its 48 box, and "All {n}
// stems" for the full Mix tab. Today's phone mix sheet opens on it; s43 places it in the Tools
// sheet.

const STEP_DB = 3

function Row({
  rule,
  fill,
  name,
  gainDb,
  muted,
  onGain,
  onMuted,
}: {
  rule: string
  fill: string
  name: string
  gainDb: number
  muted: boolean
  onGain: (db: number) => void
  onMuted: (muted: boolean) => void
}) {
  return (
    <div
      data-slot="mini-mixer-row"
      className="grid grid-cols-[0.375rem_minmax(0,1fr)_auto] items-center gap-x-2.5"
    >
      <span aria-hidden className={cn('h-6 w-1.5 rounded-full', rule)} />
      <span className="flex min-w-0 flex-col gap-1">
        <span className="truncate text-sm font-medium">
          {name}
          {muted && <span className="text-muted-foreground"> · {m['mixer.muted']()}</span>}
        </span>
        <Slider
          className={cn('min-w-0', fill)}
          value={gainDb}
          min={GAIN_RANGE.min}
          max={GAIN_RANGE.max}
          step={STEP_DB}
          largeStep={STEP_DB * 2}
          onValueChange={(next) => onGain(Array.isArray(next) ? (next[0] ?? gainDb) : next)}
          thumbLabels={[`${m['mixer.volume']()} ${name}`]}
        />
      </span>
      <StemToggle
        size="tools"
        pressed={muted}
        onPressedChange={onMuted}
        label={`${m['mixer.mute']()} ${name}`}
      >
        M
      </StemToggle>
    </div>
  )
}

export function MiniMixer({ onAllStems }: { onAllStems: () => void }) {
  const { channels, mix, setMix, applyPreset, data, layers } = usePractice()
  if (!layers.stems) {
    return <p className="text-md text-muted-foreground">{m['practice.mix_wait']()}</p>
  }
  const part = channels.find((c) => c.role === 'part')
  const partState = part && mix[part.stemId]
  const band = bandLevel(channels, mix)
  const preset = presetOf(channels, mix)
  const onlyBacking = channels.length === 2 ? channels.find((c) => c.role === 'backing') : undefined
  const bandKind = onlyBacking ? stemKind(onlyBacking) : 'mix'
  return (
    <section data-slot="mini-mixer" className="flex flex-col gap-2.5">
      <fieldset className="flex flex-wrap gap-1.5">
        <legend className="sr-only">{m['mixer.presets']()}</legend>
        {presetsFor(channels).map((value) => (
          <Toggle
            key={value}
            size="sm"
            pressed={preset === value}
            onPressedChange={() => applyPreset(value)}
          >
            {presetName(value)}
          </Toggle>
        ))}
      </fieldset>
      {part && partState && (
        <Row
          rule={STEM_RULE[stemKind(part)]}
          fill={STEM_FILL[stemKind(part)]}
          name={m['mixer.part_row']({ part: instrumentLabel(data.instrument) })}
          gainDb={partState.gain_db}
          muted={partState.muted}
          onGain={(gain_db) => setMix({ ...mix, [part.stemId]: { ...partState, gain_db } })}
          onMuted={(muted) => setMix({ ...mix, [part.stemId]: { ...partState, muted } })}
        />
      )}
      {band && (
        <Row
          rule={STEM_RULE[bandKind]}
          fill={STEM_FILL[bandKind]}
          name={m['mixer.backing']()}
          gainDb={band.gain_db}
          muted={band.muted}
          onGain={(gainDb) => setMix(withBandLevel(channels, mix, gainDb, GAIN_RANGE))}
          onMuted={(muted) => setMix(withBandMuted(channels, mix, muted))}
        />
      )}
      <Button variant="ghost" size="sm" className="self-start" onClick={onAllStems}>
        {m['mixer.all_stems']({ count: String(channels.length) })}
      </Button>
    </section>
  )
}
