import { m } from '@/lib/i18n'
import { instrumentLabel } from '@/lib/instruments'
import { cn } from '@/lib/utils'
import { Button } from '@/ui/button'
import { PanelSection } from '@/ui/panel'
import { Slider } from '@/ui/slider'
import { GAIN_RANGE, STEM_FILL, STEM_RULE, StemToggle } from '@/ui/stem-row'
import { Toggle } from '@/ui/toggle'
import { SwitchRow } from '../common/switch-row'
import { presetName } from './mix-copy'
import { MixUnavailable } from './mix-tab'
import {
  bandLevel,
  type Mix,
  type MixChannel,
  presetOf,
  presetsFor,
  withBandLevel,
  withBandMuted,
} from './model/mixer'
import { usePractice } from './practice-context'
import { stemKind } from './stem-names'

// The phone mini-mixer (27 §3.7.2; s47 direction §6): the Tools sheet's Mix opens on it. The
// presets as pills (the one in play has the ink edge), then two rows, "{part} · your part" and
// "Band" (every other stem as one fader that keeps their balance), each a stepped fader (a tap on
// the track sets it, 3 dB steps) with M and S as 48 px letter toggles; a row that isn't heard
// while the other is soloed says so and dims. The click is one switch away, and "All {n} stems"
// opens the full Mix tab.

const STEP_DB = 3

/** Solos the part alone (`part`) or the band alone (`band`), or neither (`null`). */
function withSolo(channels: readonly MixChannel[], mix: Mix, who: 'part' | 'band' | null): Mix {
  const next: Mix = { ...mix }
  for (const channel of channels) {
    const state = mix[channel.stemId]
    if (!state) continue
    const isPart = channel.role === 'part'
    next[channel.stemId] = { ...state, solo: who === 'part' ? isPart : who === 'band' && !isPart }
  }
  return next
}

function Row({
  rule,
  fill,
  name,
  gainDb,
  muted,
  soloed,
  notHeard,
  onGain,
  onMuted,
  onSoloed,
}: {
  rule: string
  fill: string
  name: string
  gainDb: number
  muted: boolean
  soloed: boolean
  notHeard: boolean
  onGain: (db: number) => void
  onMuted: (muted: boolean) => void
  onSoloed: (soloed: boolean) => void
}) {
  const quiet = (muted || notHeard) && !soloed
  const state = soloed
    ? m['mixer.soloed']()
    : muted
      ? m['mixer.muted']()
      : notHeard
        ? m['mixer.not_heard']()
        : null
  return (
    <div
      data-slot="mini-mixer-row"
      data-heard={quiet ? 'false' : 'true'}
      className="grid grid-cols-[0.25rem_minmax(0,1fr)_auto_auto] items-center gap-x-2"
    >
      <span aria-hidden className={cn('h-10 w-1 rounded-full', rule)} />
      <span className="flex min-w-0 flex-col gap-1">
        <span
          className={cn('truncate text-label', quiet ? 'text-faint-foreground' : 'text-foreground')}
        >
          {name}
          {state && <span className="text-muted-foreground"> · {state}</span>}
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
      <StemToggle pressed={muted} onPressedChange={onMuted} label={`${m['mixer.mute']()} ${name}`}>
        {m['mixer.mute_letter']()}
      </StemToggle>
      <StemToggle
        pressed={soloed}
        onPressedChange={onSoloed}
        label={`${m['mixer.solo']()} ${name}`}
      >
        {m['mixer.solo_letter']()}
      </StemToggle>
    </div>
  )
}

export function MiniMixer({ onAllStems }: { onAllStems: () => void }) {
  const { channels, mix, setMix, applyPreset, data, layers, player, send } = usePractice()
  if (!layers.stems) return <MixUnavailable />
  const part = channels.find((c) => c.role === 'part')
  const partState = part && mix[part.stemId]
  const band = bandLevel(channels, mix)
  const others = channels.filter((c) => c.role !== 'part')
  const bandSoloed = others.length > 0 && others.every((c) => mix[c.stemId]?.solo)
  const partSoloed = partState?.solo ?? false
  const preset = presetOf(channels, mix)
  const onlyBacking = channels.length === 2 ? channels.find((c) => c.role === 'backing') : undefined
  const bandKind = onlyBacking ? stemKind(onlyBacking) : 'mix'
  return (
    <div data-slot="mini-mixer" className="flex flex-col [&>section:first-child]:pt-0">
      <PanelSection>
        <fieldset className="m-0 flex flex-wrap gap-1 border-0 p-0">
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
      </PanelSection>
      <PanelSection className="gap-2">
        {part && partState && (
          <Row
            rule={STEM_RULE[stemKind(part)]}
            fill={STEM_FILL[stemKind(part)]}
            name={m['mixer.part_row']({ part: instrumentLabel(data.instrument) })}
            gainDb={partState.gain_db}
            muted={partState.muted}
            soloed={partSoloed}
            notHeard={bandSoloed}
            onGain={(gain_db) => setMix({ ...mix, [part.stemId]: { ...partState, gain_db } })}
            onMuted={(muted) => setMix({ ...mix, [part.stemId]: { ...partState, muted } })}
            onSoloed={(on) => setMix(withSolo(channels, mix, on ? 'part' : null))}
          />
        )}
        {band && (
          <Row
            rule={STEM_RULE[bandKind]}
            fill={STEM_FILL[bandKind]}
            name={m['mixer.backing']()}
            gainDb={band.gain_db}
            muted={band.muted}
            soloed={bandSoloed}
            notHeard={partSoloed}
            onGain={(gainDb) => setMix(withBandLevel(channels, mix, gainDb, GAIN_RANGE))}
            onMuted={(muted) => setMix(withBandMuted(channels, mix, muted))}
            onSoloed={(on) => setMix(withSolo(channels, mix, on ? 'band' : null))}
          />
        )}
      </PanelSection>
      <PanelSection className="gap-0">
        <SwitchRow
          label={m['mixer.click']()}
          checked={player.metronome && layers.beats}
          disabled={!layers.beats}
          onCheckedChange={(on) => send({ type: 'SET_METRONOME', on })}
        />
        <Button variant="outline" className="mt-2 self-start" onClick={onAllStems}>
          {m['mixer.all_stems']({ count: String(channels.length) })}
        </Button>
      </PanelSection>
    </div>
  )
}
