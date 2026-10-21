import { m } from '@/lib/i18n'
import type { DisplayPreferences } from '@/ui/display'

export function appearanceLabel(choice: DisplayPreferences['appearance']): string {
  switch (choice) {
    case 'light':
      return m['appearance.light']()
    case 'dark':
      return m['appearance.dark']()
    case 'stage':
      return m['appearance.stage']()
    default:
      return m['appearance.system']()
  }
}
