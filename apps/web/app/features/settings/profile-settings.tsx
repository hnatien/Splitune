import type { Handedness, Level, UpdateMeInput } from '@splitune/contracts'
import { useQueryClient } from '@tanstack/react-query'
import { useId, useState } from 'react'
import type { z } from 'zod'
import { client } from '@/lib/api'
import { m } from '@/lib/i18n'
import { INSTRUMENTS, instrumentLabel } from '@/lib/instruments'
import { type MeData, meQuery } from '@/lib/session'
import { Input } from '@/ui/input'
import { Label } from '@/ui/label'
import { OptionSelect } from '../common/option-select'
import { SettingRow } from './setting-row'
import { useSaveState } from './use-save-state'

// Profile (27 §3.9): name, main instrument, level, handedness; each field saves on its own.

type Patch = z.infer<typeof UpdateMeInput>

function useMeField() {
  const queryClient = useQueryClient()
  const save = useSaveState()
  const update = (patch: Patch) =>
    save.run(async () => {
      const me = await client.me.update(patch)
      queryClient.setQueryData(meQuery.queryKey, me)
    })
  return { state: save.state, update }
}

const LEVELS: z.infer<typeof Level>[] = ['just_started', 'few_songs', 'returning']
const HANDS: z.infer<typeof Handedness>[] = ['right', 'left']

function levelLabel(level: z.infer<typeof Level>) {
  if (level === 'few_songs') return m['settings.level_few_songs']()
  if (level === 'returning') return m['settings.level_returning']()
  return m['settings.level_just_started']()
}

export function ProfileSettings({ me }: { me: MeData }) {
  const name = useMeField()
  const instrument = useMeField()
  const level = useMeField()
  const hand = useMeField()
  const [displayName, setDisplayName] = useState(me.display_name ?? '')
  const nameId = useId()

  return (
    <section className="flex flex-col">
      <h2 className="text-xl">{m['settings.profile']()}</h2>
      <SettingRow state={name.state}>
        <div className="flex min-w-64 flex-1 flex-col gap-1.5">
          <Label htmlFor={nameId}>{m['settings.name']()}</Label>
          <Input
            id={nameId}
            value={displayName}
            maxLength={100}
            autoComplete="name"
            onChange={(event) => setDisplayName(event.target.value)}
            onBlur={() => {
              const value = displayName.trim()
              if (value === (me.display_name ?? '')) return
              void name.update({ display_name: value || null })
            }}
          />
        </div>
      </SettingRow>
      <SettingRow state={instrument.state}>
        <OptionSelect
          label={m['settings.instrument']()}
          value={me.primary_instrument ?? 'guitar'}
          options={INSTRUMENTS.map((value) => ({ value, label: instrumentLabel(value) }))}
          onChange={(value) => instrument.update({ primary_instrument: value })}
          className="w-56"
        />
      </SettingRow>
      <SettingRow state={level.state}>
        <OptionSelect
          label={m['settings.level']()}
          value={me.level ?? 'just_started'}
          options={LEVELS.map((value) => ({ value, label: levelLabel(value) }))}
          onChange={(value) => level.update({ level: value })}
          className="w-72"
        />
      </SettingRow>
      <SettingRow state={hand.state} description={m['settings.handedness_hint']()}>
        <OptionSelect
          label={m['settings.handedness']()}
          value={me.handedness}
          options={HANDS.map((value) => ({
            value,
            label: value === 'left' ? m['settings.left_handed']() : m['settings.right_handed'](),
          }))}
          onChange={(value) => hand.update({ handedness: value })}
          className="w-56"
        />
      </SettingRow>
    </section>
  )
}
