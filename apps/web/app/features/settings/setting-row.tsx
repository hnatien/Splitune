import type * as React from 'react'
import { m } from '@/lib/i18n'
import { SaveStatus } from '@/ui/save-status'

// One setting: its control and the inline save status beside it.
export function SettingRow({
  children,
  state,
  description,
}: {
  children: React.ReactNode
  state: 'idle' | 'saving' | 'saved' | 'error'
  description?: string
}) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-5 last:border-b-0">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        {children}
        <SaveStatus
          state={state}
          savingLabel={m['settings.saving']()}
          savedLabel={m['settings.saved']()}
          errorLabel={m['settings.save_failed']()}
          className="pb-2.5"
        />
      </div>
      {description && <p className="text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
