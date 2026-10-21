import { createFileRoute } from '@tanstack/react-router'
import { CreditCardIcon } from 'lucide-react'
import { SettingsPlaceholder } from '@/features/settings/placeholder'
import { m } from '@/lib/i18n'

// Placeholder until step 14 fills this section (27 §3.9).
export const Route = createFileRoute('/_app/settings/billing')({
  component: () => (
    <SettingsPlaceholder
      title={m['settings.billing']()}
      body={m['settings.coming_billing']()}
      icon={<CreditCardIcon aria-hidden />}
    />
  ),
})
