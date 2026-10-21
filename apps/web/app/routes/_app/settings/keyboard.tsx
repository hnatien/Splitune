import { createFileRoute } from '@tanstack/react-router'
import { KeyboardIcon } from 'lucide-react'
import { SettingsPlaceholder } from '@/features/settings/placeholder'
import { m } from '@/lib/i18n'

// Placeholder until step 12 fills this section (27 §3.9).
export const Route = createFileRoute('/_app/settings/keyboard')({
  component: () => (
    <SettingsPlaceholder
      title={m['settings.keyboard']()}
      body={m['settings.coming_keyboard']()}
      icon={<KeyboardIcon aria-hidden />}
    />
  ),
})
