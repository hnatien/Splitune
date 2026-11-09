import type { StemKind } from '@splitune/ui-tokens'
import { m } from '@/lib/i18n'
import type { InstrumentName } from '@/lib/instruments'
import { InstrumentTile } from '@/ui/song-card'

// The stem colour the mixer uses for the same part (26 §4.4), and its letters ("Gt").
const STEM: Record<InstrumentName, StemKind> = {
  guitar: 'guitar',
  bass: 'bass',
  piano: 'keys',
  drums: 'drums',
  vocals: 'vocals',
  other: 'other',
}

export function stemOf(instrument: InstrumentName): StemKind {
  return STEM[instrument]
}

export function tileLetters(instrument: InstrumentName): string {
  switch (instrument) {
    case 'guitar':
      return m['library.tile_guitar']()
    case 'bass':
      return m['library.tile_bass']()
    case 'piano':
      return m['library.tile_piano']()
    case 'drums':
      return m['library.tile_drums']()
    case 'vocals':
      return m['library.tile_vocals']()
    default:
      return m['library.tile_other']()
  }
}

/** A song's part as a stem tile (library cards and rows, the ⌘K results). */
export function SongTile({
  instrument,
  size = 'md',
}: {
  instrument: InstrumentName
  size?: 'sm' | 'md'
}) {
  return <InstrumentTile stem={STEM[instrument]} label={tileLetters(instrument)} size={size} />
}
