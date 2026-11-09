import type { Level, UpdateMeInput } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type { z } from 'zod'
import { client } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, instrumentLabel } from '@/lib/instruments'
import { type MeData, meQuery } from '@/lib/session'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { BillingSettings } from '../billing/billing-settings'
import { useSignOut } from '../shell/use-sign-out'
import { type DeleteStep, PrivacySettings } from './privacy-settings'
import {
  SectionRule,
  SegmentSetting,
  SettingRow,
  SettingSection,
  SettingsPage,
} from './setting-row'
import { useSaveState } from './use-save-state'

// Settings → Account (27 §3.9, Settings-Account): Profile, Plan, Privacy, then Sign out. The old
// Profile, Plan & billing and Privacy URLs land on the section anchors (#profile, #plan, #privacy).

type Patch = z.infer<typeof UpdateMeInput>

export function useUpdateMe() {
  const queryClient = useQueryClient()
  return async (patch: Patch) => {
    queryClient.setQueryData(meQuery.queryKey, await client.me.update(patch))
  }
}

const LEVELS: z.infer<typeof Level>[] = ['just_started', 'few_songs', 'returning']

function levelLabel(level: z.infer<typeof Level>) {
  if (level === 'few_songs') return m['settings.level_few_songs']()
  if (level === 'returning') return m['settings.level_returning']()
  return m['settings.level_just_started']()
}

export function AccountSettings({
  me,
  checkout,
  deleteDialog,
}: {
  me: MeData
  checkout?: 'success' | 'cancelled' | undefined
  /** Opens "Delete my account" at this step (Google re-authentication returns to confirm). */
  deleteDialog?: DeleteStep | undefined
}) {
  const signOut = useSignOut()
  return (
    <SettingsPage title={m['settings.account']()}>
      <Profile me={me} />
      <SectionRule />
      <BillingSettings me={me} checkout={checkout} />
      <SectionRule />
      <PrivacySettings me={me} deleteDialog={deleteDialog} />
      <SectionRule />
      <Button variant="ghost" className="self-start" onClick={signOut}>
        <LogOutIcon aria-hidden />
        {m['nav.sign_out']()}
      </Button>
    </SettingsPage>
  )
}

function Profile({ me }: { me: MeData }) {
  const current = useQuery({ ...meQuery, initialData: me }).data ?? me
  const update = useUpdateMe()
  const name = useSaveState()
  const [displayName, setDisplayName] = useState(current.display_name ?? '')
  const nameId = useId()
  const usernameId = useId()
  return (
    <SettingSection id="profile" title={m['settings.profile']()}>
      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(16.25rem,100%),1fr))] gap-3.5">
        <SettingRow label={m['settings.name']()} htmlFor={nameId} state={name.state}>
          <Input
            id={nameId}
            value={displayName}
            maxLength={100}
            autoComplete="name"
            onChange={(event) => setDisplayName(event.target.value)}
            onBlur={() => {
              const value = displayName.trim()
              if (value === (current.display_name ?? '')) return
              void name.run(() => update({ display_name: value || null }))
            }}
          />
        </SettingRow>
        {current.username && (
          <SettingRow label={m['auth.username_label']()} htmlFor={usernameId} state="idle">
            <Input
              id={usernameId}
              value={current.username}
              readOnly
              className="text-muted-foreground"
            />
          </SettingRow>
        )}
      </div>
      <SegmentSetting
        label={m['settings.instrument']()}
        value={current.primary_instrument ?? 'guitar'}
        options={INSTRUMENTS.map((value) => ({ value, label: instrumentLabel(value) }))}
        onChange={(value) => update({ primary_instrument: value })}
      />
      <SegmentSetting
        label={m['settings.level']()}
        value={current.level ?? 'just_started'}
        options={LEVELS.map((value) => ({ value, label: levelLabel(value) }))}
        onChange={(value) => update({ level: value })}
      />
    </SettingSection>
  )
}
