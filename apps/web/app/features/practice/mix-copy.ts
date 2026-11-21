import { m } from '@/lib/i18n'
import type { MixPreset } from './model/mixer'

// A preset's name (27 §3.7.4, §5.2), for the dock's mix pill, the HUD and the preset choices.
export function presetName(preset: MixPreset): string {
  switch (preset) {
    case 'part-loud':
      return m['mixer.preset_part_loud']()
    case 'minus-one':
      return m['mixer.preset_minus_one']()
    case 'rhythm':
      return m['mixer.preset_rhythm']()
    default:
      return m['mixer.preset_original']()
  }
}
