import type { Level, UpdateMeInput } from '@splitune/contracts'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { LogOutIcon } from 'lucide-react'
import { useId, useState } from 'react'
import type { z } from 'zod'
import { client } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, type InstrumentName, instrumentLabel } from '@/lib/instruments'
import { type MeData, meQuery } from '@/lib/session'
import { Button } from '@/ui/button'
import { Input } from '@/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select'
import { useSignOut } from '../shell/use-sign-out'
import { type DeleteStep, PrivacySettings } from './privacy-settings'
import {
  SegmentSetting,
  SettingRow,
  SettingRows,
  SettingSection,
  SettingsPage,
} from './setting-row'
import { useSaveState } from './use-save-state'

// Settings → Account (27 §3.9, Settings-Account): Profile, Privacy, then Sign out. The old Profile
// and Privacy URLs land on the section anchors (#profile, #privacy); Plan is its own section. The
// main instrument is a menu (six pills would wrap on a phone); the level is three pills.

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
  deleteDialog,
}: {
  me: MeData
  /** Opens "Delete my account" at this step (Google re-authentication returns to confirm). */
  deleteDialog?: DeleteStep | undefined
}) {
  const signOut = useSignOut()
  return (
    <SettingsPage title={m['settings.account']()}>
      <Profile me={me} />
      <PrivacySettings me={me} deleteDialog={deleteDialog} />
      <Button className="self-start" onClick={signOut}>
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
  const instrument = useSaveState()
  const [displayName, setDisplayName] = useState(current.display_name ?? '')
  const nameId = useId()
  const instrumentId = useId()
  return (
    <SettingSection id="profile" title={m['settings.profile']()}>
      <SettingRows>
        <SettingRow
          label={m['settings.name']()}
          hint={m['settings.name_hint']()}
          htmlFor={nameId}
          state={name.state}
        >
          <Input
            id={nameId}
            className="sm:w-72"
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
        {/* Read-only, so plain text beside its label rather than a field that looks editable. */}
        {current.username && (
          <SettingRow
            label={m['auth.username_label']()}
            hint={m['settings.username_hint']()}
            state="idle"
          >
            <span data-slot="username" className="text-body text-foreground sm:w-72">
              {current.username}
            </span>
          </SettingRow>
        )}
        <SettingRow
          label={m['settings.instrument']()}
          htmlFor={instrumentId}
          state={instrument.state}
        >
          <Select
            value={current.primary_instrument ?? 'guitar'}
            onValueChange={(value) =>
              void instrument.run(() => update({ primary_instrument: value as InstrumentName }))
            }
          >
            <SelectTrigger id={instrumentId} className="w-full sm:w-72">
              <SelectValue>{(value: InstrumentName) => instrumentLabel(value)}</SelectValue>
            </SelectTrigger>
            <SelectContent aria-label={m['settings.instrument']()}>
              {INSTRUMENTS.map((value) => (
                <SelectItem key={value} value={value}>
                  {instrumentLabel(value)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </SettingRow>
        <SegmentSetting
          label={m['settings.level']()}
          value={current.level ?? 'just_started'}
          options={LEVELS.map((value) => ({ value, label: levelLabel(value) }))}
          onChange={(value) => update({ level: value })}
        />
      </SettingRows>
    </SettingSection>
  )
}
