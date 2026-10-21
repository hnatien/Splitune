import { createFileRoute } from '@tanstack/react-router'
import { ShieldIcon } from 'lucide-react'
import { SettingsPlaceholder } from '@/features/settings/placeholder'
import { m } from '@/lib/i18n'

// Placeholder until step 15 fills this section (27 §3.9).
export const Route = createFileRoute('/_app/settings/privacy')({
  component: () => (
    <SettingsPlaceholder
      title={m['settings.privacy']()}
      body={m['settings.coming_privacy']()}
      icon={<ShieldIcon aria-hidden />}
    />
  ),
})
