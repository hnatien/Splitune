import type { Instrument } from '@splitune/contracts'
import type { z } from 'zod'
import { m } from '@/lib/i18n'

export type InstrumentName = z.infer<typeof Instrument>

export const INSTRUMENTS: InstrumentName[] = ['guitar', 'bass', 'piano', 'drums', 'vocals', 'other']

export function instrumentLabel(instrument: InstrumentName): string {
  switch (instrument) {
    case 'guitar':
      return m['instrument.guitar']()
    case 'bass':
      return m['instrument.bass']()
    case 'piano':
      return m['instrument.piano']()
    case 'drums':
      return m['instrument.drums']()
    case 'vocals':
      return m['instrument.vocals']()
    default:
      return m['instrument.other']()
  }
}
