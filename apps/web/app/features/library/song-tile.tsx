import type { StemKind } from '@splitune/ui-tokens'
import {
  DrumIcon,
  GuitarIcon,
  type LucideIcon,
  MicVocalIcon,
  Music2Icon,
  PianoIcon,
} from 'lucide-react'
import type { InstrumentName } from '@/lib/instruments'
import { BassIcon } from '@/ui/icons/bass'
import { InstrumentTile } from '@/ui/song-card'

// The stem colour the mixer uses for the same part (26 §4.4).
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

/** The part's instrument drawing (26 §11): stem tiles, Add song's part chips, onboarding's choice. */
export const INSTRUMENT_ICON: Record<InstrumentName, LucideIcon> = {
  guitar: GuitarIcon,
  bass: BassIcon,
  piano: PianoIcon,
  drums: DrumIcon,
  vocals: MicVocalIcon,
  other: Music2Icon,
}

/** A song's part as a stem tile (library cards and rows, the ⌘K results). */
export function SongTile({
  instrument,
  size = 'md',
}: {
  instrument: InstrumentName
  size?: 'sm' | 'md'
}) {
  return <InstrumentTile stem={STEM[instrument]} icon={INSTRUMENT_ICON[instrument]} size={size} />
}
