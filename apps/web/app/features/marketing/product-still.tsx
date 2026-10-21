import { m } from '@/lib/i18n'
import { ChordChip } from '@/ui/chord-chip'
import { ConfidenceLegend } from '@/ui/confidence-legend'
import { LoopBadge } from '@/ui/loop-badge'
import { SpeedControl } from '@/ui/speed-control'
import { StemRow } from '@/ui/stem-row'

// The Home page's product still (27 §3.1): real kit components with the 8-bar Am–F–C–G example,
// paused, on paper. Inert: it is a picture of the app, described by its caption, not controls.

const noop = () => undefined

const CHORDS = [
  { label: 'Am', confidence: 'high', timing: 'past' },
  { label: 'F', confidence: 'high', timing: 'past' },
  { label: 'C', confidence: 'high', timing: 'current' },
  { label: 'G', confidence: 'low', timing: 'upcoming' },
] as const

/** The chord strip sits on paper, like the score (26 §2); the controls around it are chrome. */
export function ChordStill() {
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-lg bg-paper p-3 text-ink">
      {CHORDS.map((chord) => (
        <ChordChip
          key={chord.label}
          label={chord.label}
          confidence={chord.confidence}
          timing={chord.timing}
          showUncertainty
        />
      ))}
    </div>
  )
}

export function LoopStill() {
  return (
    <div className="flex flex-wrap items-center gap-4">
      <LoopBadge state="active">{m['home.still_loop']()}</LoopBadge>
      <SpeedControl
        value={70}
        bpm={120}
        onValueChange={noop}
        labels={{
          speed: m['home.still_speed'](),
          decrease: m['home.still_speed'](),
          increase: m['home.still_speed'](),
          presets: m['home.still_speed'](),
        }}
      />
    </div>
  )
}

export function StemStill() {
  return (
    <StemRow
      stem="guitar"
      name={m['instrument.guitar']()}
      yourPart={m['home.still_your_part']()}
      muted={false}
      soloed
      gainDb={0}
      onMutedChange={noop}
      onSoloedChange={noop}
      onGainChange={noop}
      labels={{
        mute: m['home.still_mute'](),
        solo: m['home.still_solo'](),
        volume: m['home.still_volume'](),
        decrease: m['home.still_volume'](),
        increase: m['home.still_volume'](),
      }}
    />
  )
}

export function LegendStill() {
  return (
    <ConfidenceLegend
      text={m['practice.legend']({ model: '1' })}
      labels={{
        showUncertainty: m['home.still_show_uncertainty'](),
        medium: m['home.still_medium'](),
        low: m['home.still_low'](),
      }}
      showUncertainty
      onShowUncertaintyChange={noop}
    />
  )
}

/** A still of the practice screen; `caption` is its text alternative. */
export function ProductStill({ caption }: { caption: string }) {
  return (
    <figure className="flex flex-col gap-3">
      <div
        inert
        aria-hidden
        data-density="practice"
        className="flex flex-col gap-5 rounded-xl border border-border bg-card p-5 shadow-2"
      >
        <ChordStill />
        <LoopStill />
      </div>
      <figcaption className="text-sm text-muted-foreground">{caption}</figcaption>
    </figure>
  )
}
