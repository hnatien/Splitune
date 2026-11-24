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

/** The part's instrument drawing (26 §11): library rows, Add song's part rows, the ⌘K results. */
export const INSTRUMENT_ICON: Record<InstrumentName, LucideIcon> = {
  guitar: GuitarIcon,
  bass: BassIcon,
  piano: PianoIcon,
  drums: DrumIcon,
  vocals: MicVocalIcon,
  other: Music2Icon,
}
