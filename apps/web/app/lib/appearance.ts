import { m } from '@/lib/i18n'
import type { DisplayPreferences } from '@/ui/display'

/** The appearance's name (26 §2): `stage` has no name of its own and reads as Night Rehearsal. */
export function appearanceLabel(choice: DisplayPreferences['appearance']): string {
  switch (choice) {
    case 'light':
      return m['appearance.light']()
    case 'dark':
    case 'stage':
      return m['appearance.dark']()
    default:
      return m['appearance.system']()
  }
}
