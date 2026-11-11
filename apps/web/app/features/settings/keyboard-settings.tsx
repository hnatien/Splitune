import { KeyboardIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { Card } from '@/ui/card'
import { PedalIcon } from '@/ui/icons'
import { Kbd, KbdGroup } from '@/ui/kbd'
import { actionLabel, keyLabel } from '../practice/input-mapper'
import { useKeys } from '../practice/keys-store'
import { ACTIONS, DEFAULT_KEYS, keyOf, resolveKey } from '../practice/model/keymap'
import { SettingSection, SettingsPage, SwitchSetting } from './setting-row'

// Settings → Keyboard & pedal (27 §3.9, Settings-Pedal's Keys part, 12 §8): the intro, the pedal
// setup card (its wizard is s43's), the Single-key shortcuts switch (WCAG 2.1.4; s35's keys store),
// the Keys table (Action · Keys · Pedal · learn, in 12 §8 order), a test area that names the action
// a key or pedal triggers, and Reset to the defaults.

export function KeyboardSettings() {
  return (
    <SettingsPage title={m['settings.keyboard']()} intro={m['shortcuts.settings_intro']()}>
      <Card className="flex-row items-center gap-4 border-primary-line p-6">
        <PedalIcon aria-hidden className="size-8 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-1">
          <h2 className="text-xl">{m['settings.pedal_setup']()}</h2>
          <p className="text-sm text-muted-foreground">{m['shortcuts.description']()}</p>
        </div>
      </Card>
      <SettingSection id="keys" title={m['shortcuts.keys']()}>
        <SingleKeys />
        <KeysTable />
      </SettingSection>
      <KeyTestArea />
    </SettingsPage>
  )
}

// Off, character keys are inert on the practice screen; Ctrl/⌘ shortcuts, the keys pedals send
// and learned keys keep working (12 §8).
function SingleKeys() {
  const singleKeys = useKeys((s) => s.singleKeys)
  const setSingleKeys = useKeys((s) => s.setSingleKeys)
  return (
    <SwitchSetting
      label={m['shortcuts.single_keys']()}
      hint={m['shortcuts.single_keys_hint']()}
      checked={singleKeys}
      onChange={setSingleKeys}
    />
  )
}

function KeysTable() {
  const { learned, learning, startLearning, bind, cancel } = useKeys()
  // While learning, the next key anywhere is the pedal's (captured before anything else acts).
  useEffect(() => {
    if (!learning) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Tab' || event.key === 'Shift') return
      event.preventDefault()
      event.stopImmediatePropagation()
      if (event.key === 'Escape') cancel()
      else bind(event.key)
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [learning, bind, cancel])
  return (
    <>
      <Card className="overflow-x-auto px-4 py-1">
        <table className="w-full border-collapse text-left">
          <thead>
            <tr className="border-b border-border text-sm text-muted-foreground">
              <th scope="col" className="py-2 pr-3 font-semibold">
                {m['shortcuts.action']()}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {m['shortcuts.keys']()}
              </th>
              <th scope="col" className="py-2 pr-3 font-semibold">
                {m['shortcuts.pedal']()}
              </th>
              <th scope="col" className="py-2">
                <span className="sr-only">{m['shortcuts.learn']()}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ACTIONS.map((action) => {
              const pedal = learned[action]
              return (
                <tr key={action} className="border-b border-border last:border-b-0">
                  <th scope="row" className="py-1 pr-3 text-md font-semibold">
                    {actionLabel(action)}
                  </th>
                  <td className="py-1 pr-3">
                    <KbdGroup>
                      {DEFAULT_KEYS[action].map((key) => (
                        <Kbd key={key}>{keyLabel(key)}</Kbd>
                      ))}
                    </KbdGroup>
                  </td>
                  <td className="py-1 pr-3">{pedal && <Kbd>{keyLabel(pedal)}</Kbd>}</td>
                  <td className="py-1 text-right">
                    <Button
                      size="sm"
                      variant={learning === action ? 'on' : 'ghost'}
                      aria-pressed={learning === action}
                      aria-label={
                        learning === action
                          ? m['shortcuts.press_for']({ action: actionLabel(action) })
                          : m['shortcuts.learn_for']({ action: actionLabel(action) })
                      }
                      onClick={() => startLearning(action)}
                    >
                      {learning === action ? m['shortcuts.press_pedal']() : m['shortcuts.learn']()}
                    </Button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </Card>
      <p aria-live="polite" className="text-sm text-muted-foreground empty:hidden">
        {learning ? m['shortcuts.learning']({ action: actionLabel(learning) }) : ''}
      </p>
    </>
  )
}

function KeyTestArea() {
  const learned = useKeys((s) => s.learned)
  const singleKeys = useKeys((s) => s.singleKeys)
  const reset = useKeys((s) => s.reset)
  const [last, setLast] = useState<string | null>(null)
  const resultId = useId()
  return (
    <section className="flex flex-wrap items-center gap-4 rounded-4xl border-2 border-dashed border-border-strong bg-card p-5">
      <button
        type="button"
        aria-describedby={resultId}
        onKeyDown={(event) => {
          if (event.key === 'Tab') return
          event.preventDefault()
          // What the practice screen would do with it (12 §8): ↑/↓ ask for the pedal setup.
          const result = resolveKey(event, learned, singleKeys)
          const key = keyLabel(keyOf(event))
          setLast(
            result.kind === 'action'
              ? m['shortcuts.test_result']({ key, action: actionLabel(result.action) })
              : result.kind === 'pedal-hint'
                ? m['shortcuts.test_result']({ key, action: m['practice.pedal_detected']() })
                : m['shortcuts.test_none']({ key }),
          )
        }}
        className="flex min-h-target min-w-0 grow basis-75 items-center gap-4 rounded-2xl text-left"
      >
        <KeyboardIcon
          aria-hidden
          strokeWidth={1.8}
          className="size-6 shrink-0 text-faint-foreground"
        />
        <span className="flex flex-col gap-0.5">
          <span className="text-lg">{m['shortcuts.test_area']()}</span>
          <span id={resultId} aria-live="polite" className="text-sm text-muted-foreground">
            {last ?? m['shortcuts.test_hint']()}
          </span>
        </span>
      </button>
      <Button onClick={reset}>
        <RotateCcwIcon aria-hidden />
        {m['shortcuts.reset']()}
      </Button>
    </section>
  )
}
