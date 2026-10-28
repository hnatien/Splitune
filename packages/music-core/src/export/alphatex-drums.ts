import { type BeatGrid, PPQ } from '../grid/beatgrid.ts'
import { type Bar, barsToRender, barZeroTick, quote, split } from './alphatex-bars.ts'

// Drum staff alphaTex for transcribed drums (step 25), alphaTab 1.8 syntax (verified with the
// 1.8.4 importer in test/drums.test.ts):
// - one percussion track (`\instrument percussion`, `\clef neutral`) with alphaTab's standard
//   articulations (`\articulation defaults`), each hit written by the articulation whose MIDI
//   output is its GM key (ARTICULATION), so playback and the kit lines follow notes.drums;
// - two voices as on a drum staff: hands (cymbals, hi-hat, snare, toms) stems up, feet (kick,
//   pedal hi-hat) stems down;
// - a hit lasts until the voice's next onset in the bar, written as one value plus rests where
//   one value can't express it (drum notes don't tie);
// - a flam as a before-beat grace note (`{gr}`) of the same articulation.
// Bars, durations and pickups follow the tab writer (alphatex-bars.ts).

// GM percussion key → alphaTab 1.8 standard articulation sounding that key. GM 40 (electric
// snare) and 59 (ride 2) have no articulation of their own: they are written as snare and ride.
export const ARTICULATION: Readonly<Record<number, string>> = {
  35: 'KickHit',
  36: 'KickHit2',
  37: 'SnareSideStick',
  38: 'SnareHit',
  39: 'HandClapHit',
  40: 'SnareHit',
  41: 'LowFloorTomHit',
  42: 'HiHatClosed',
  43: 'VeryLowTomHit',
  44: 'PedalHiHatHit',
  45: 'LowTomHit',
  46: 'HiHatOpen',
  47: 'MidTomHit',
  48: 'HighTomHit',
  49: 'CrashHighHit',
  50: 'HighFloorTomHit',
  51: 'RideMiddle',
  52: 'ChinaHit',
  53: 'RideBell',
  55: 'SplashHit',
  57: 'CrashMediumHit',
  59: 'RideMiddle',
}

// Keys played with the feet: the second (stems-down) voice.
export const FEET: ReadonlySet<number> = new Set([35, 36, 44])

export interface DrumTexHit {
  hitId: string
  gmNote: number
  onTick: number
  flam: boolean
}

export interface DrumAlphaTexInput {
  grid: BeatGrid
  meterDenominator: number
  tempo: number
  hits: readonly DrumTexHit[]
  swingBars: readonly number[]
  title?: string
}

export interface DrumHitRef {
  hitId: string
  bar: number // alphaTab bar index (0 = first rendered bar)
  voice: number // 0 = hands, 1 = feet
  beat: number // beat index within the voice (grace beats count)
  note: number // index within the beat's notes, as written
}

export interface DrumAlphaTexResult {
  tex: string
  firstBar: number // grid bar shown as alphaTab bar 0 (-1 when there is a pickup bar)
  hitMap: DrumHitRef[]
}

const articulation = (gm: number) => ARTICULATION[gm] ?? 'SnareHit'

export function toDrumAlphaTex(input: DrumAlphaTexInput): DrumAlphaTexResult {
  const contentStart = Math.min(barZeroTick(input.grid), ...input.hits.map((h) => h.onTick))
  const contentEnd = Math.max(1, ...input.hits.map((h) => h.onTick + PPQ / 4))
  const bars = barsToRender(input.grid, contentStart, contentEnd)
  const swing = new Set(input.swingBars)
  const hitMap: DrumHitRef[] = []
  const feet = input.hits.filter((h) => FEET.has(h.gmNote))
  // The feet voice is written only when something is played with the feet.
  const voices = [input.hits.filter((h) => !FEET.has(h.gmNote)), ...(feet.length > 0 ? [feet] : [])]

  const voiceBar = (hits: readonly DrumTexHit[], bar: Bar, barNumber: number, voice: number) => {
    const inBar = hits.filter((h) => h.onTick >= bar.startTick && h.onTick < bar.endTick)
    if (inBar.length === 0 && voice > 0) return ''
    const onsets = [...new Set(inBar.map((h) => h.onTick))].sort((a, b) => a - b)
    const isSwing = swing.has(bar.bar)
    const tokens: string[] = []
    const rest = (from: number, to: number) => {
      for (const d of split(from - bar.startTick, to - from, isSwing)) {
        tokens.push(`r.${d.token}${d.props.length > 0 ? ` {${d.props.join(' ')}}` : ''}`)
      }
    }
    rest(bar.startTick, onsets[0] ?? bar.endTick)
    onsets.forEach((tick, k) => {
      const group = inBar
        .filter((h) => h.onTick === tick)
        .sort((a, b) => a.gmNote - b.gmNote || a.hitId.localeCompare(b.hitId))
      const names = (list: readonly DrumTexHit[]) => {
        const written = list.map((h) => articulation(h.gmNote))
        return written.length > 1 ? `(${written.join(' ')})` : (written[0] as string)
      }
      const flams = group.filter((h) => h.flam)
      if (flams.length > 0) tokens.push(`${names(flams)}.32 {gr}`)
      const [first, ...others] = split(
        tick - bar.startTick,
        (onsets[k + 1] ?? bar.endTick) - tick,
        isSwing,
      )
      if (first === undefined) return
      group.forEach((h, note) => {
        hitMap.push({ hitId: h.hitId, bar: barNumber, voice, beat: tokens.length, note })
      })
      tokens.push(
        `${names(group)}.${first.token}${first.props.length > 0 ? ` {${first.props.join(' ')}}` : ''}`,
      )
      for (const d of others) {
        tokens.push(`r.${d.token}${d.props.length > 0 ? ` {${d.props.join(' ')}}` : ''}`)
      }
    })
    return tokens.join(' ')
  }

  const lines: string[] = []
  if (input.title !== undefined) lines.push(`\\title ${quote(input.title)}`)
  lines.push(`\\track ${quote('Drums')}`)
  lines.push('\\instrument percussion')
  lines.push('\\clef neutral')
  lines.push('\\articulation defaults')
  voices.forEach((hits, voice) => {
    let previousLength = -1
    const texts = bars.map((bar, barNumber) => {
      const tags: string[] = []
      if (voice === 0) {
        if (bar.length !== previousLength)
          tags.push(`\\ts (${bar.length} ${input.meterDenominator})`)
        previousLength = bar.length
        if (barNumber === 0) tags.push(`\\tempo ${Math.max(1, Math.round(input.tempo))}`)
        if (bar.pickup) tags.push('\\ac')
      }
      return [...tags, voiceBar(hits, bar, barNumber, voice)].join(' ')
    })
    if (voices.length > 1) lines.push('\\voice')
    lines.push(texts.join(' |\n'))
  })
  return { tex: `${lines.join('\n')}\n`, firstBar: bars[0]?.bar ?? 0, hitMap }
}
