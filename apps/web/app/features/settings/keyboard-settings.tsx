import { useRouterState } from '@tanstack/react-router'
import { KeyboardIcon, RotateCcwIcon } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { PedalIcon } from '@/ui/icons'
import { Kbd, KbdGroup } from '@/ui/kbd'
import { ListGroup, ListRow } from '@/ui/list-row'
import { actionLabel, keyLabel } from '../practice/input-mapper'
import { useKeys } from '../practice/keys-store'
import {
  ACTIONS,
  DEFAULT_KEYS,
  keyOf,
  LOOP_BARS,
  resolveKey,
  SPEED_KEYS,
} from '../practice/model/keymap'
import { SettingRows, SettingSection, SettingsPage, SwitchSetting } from './setting-row'

// Settings → Keyboard & pedal (27 §3.9, Settings-Pedal's Keys part, 12 §8): the intro, the pedal
// line, the test area first (a learner setting up a pedal tries it straight away), the
// Single-key shortcuts switch (WCAG 2.1.4; s35's keys store), then every action as a hairline row
// (its keys and its learned pedal under the name, "Learn this pedal" beside it; the prompt shows
// in the row being learned, so it stays next to the control at any width), the fixed keys that
// can't be learned (as the practice shortcuts list names them) and Reset. Reached from a practice
// "Set it up" link (`/settings/keyboard#pedal`), the left pedal's Learn button takes focus.

/** The hash a "Set it up" link carries to land on the left pedal's Learn button. */
export const PEDAL_HASH = 'pedal'

export function KeyboardSettings() {
  const hash = useRouterState({ select: (state) => state.location.hash })
  useEffect(() => {
    if (hash === PEDAL_HASH) document.getElementById(PEDAL_HASH)?.focus()
  }, [hash])
  return (
    <SettingsPage title={m['settings.keyboard']()} intro={m['shortcuts.settings_intro']()}>
      <div className="flex items-start gap-3">
        <PedalIcon aria-hidden className="mt-0.5 size-5 shrink-0 text-muted-foreground" />
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="text-label">{m['settings.pedal_setup']()}</p>
          <p className="text-body-sm text-muted-foreground">{m['shortcuts.description']()}</p>
        </div>
      </div>
      <KeyTestArea />
      <SettingSection id="keys" title={m['shortcuts.keys']()}>
        <SettingRows>
          <SingleKeys />
        </SettingRows>
        <KeysList />
      </SettingSection>
      <MoreKeys />
      <ResetKeys />
    </SettingsPage>
  )
}

// The keys with no action of their own to learn a pedal for: the digit loops and speeds, the fine
// speed step, the shortcuts list and the palette, with the practice shortcuts list's names.
function MoreKeys() {
  const rows = [
    { label: m['shortcuts.loop_bars'](), keys: LOOP_BARS.map(String) },
    { label: m['shortcuts.speed_keys'](), keys: Object.keys(SPEED_KEYS).map(keyLabel) },
    { label: m['shortcuts.fine_speed'](), keys: ['Shift+,', 'Shift+.'].map(keyLabel) },
    { label: m['practice.shortcuts'](), keys: ['?'] },
    { label: m['shortcuts.palette'](), keys: [m['nav.palette_key_mac'](), m['nav.palette_key']()] },
    {
      label: m['shortcuts.undo'](),
      keys: [m['shortcuts.key_undo_mac'](), m['shortcuts.key_undo']()],
    },
  ]
  return (
    <SettingSection
      id="more-keys"
      title={m['shortcuts.more_keys']()}
      description={m['shortcuts.more_keys_hint']()}
    >
      <ListGroup>
        {rows.map((row) => (
          <ListRow
            key={row.label}
            className="hover:bg-transparent"
            title={<span className="whitespace-normal">{row.label}</span>}
            meta={
              <KbdGroup className="flex-wrap">
                {row.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </KbdGroup>
            }
          />
        ))}
      </ListGroup>
    </SettingSection>
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

function KeysList() {
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
      <ListGroup>
        {ACTIONS.map((action) => {
          const pedal = learned[action]
          const now = learning === action
          return (
            <ListRow
              key={action}
              data-action={action}
              current={now}
              // Names and the prompt wrap rather than cut off, at any width (WCAG 1.4.10).
              title={<span className="whitespace-normal">{actionLabel(action)}</span>}
              meta={
                now ? (
                  <span className="block whitespace-normal text-foreground">
                    {m['shortcuts.learning']({ action: actionLabel(action) })}
                  </span>
                ) : (
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <KbdGroup>
                      {DEFAULT_KEYS[action].map((key) => (
                        <Kbd key={key}>{keyLabel(key)}</Kbd>
                      ))}
                    </KbdGroup>
                    {pedal && (
                      <span className="inline-flex items-center gap-1.5">
                        {m['shortcuts.pedal']()}
                        <Kbd>{keyLabel(pedal)}</Kbd>
                      </span>
                    )}
                  </span>
                )
              }
              aside={
                <Button
                  {...(action === 'pedalLeft' ? { id: PEDAL_HASH } : {})}
                  size="sm"
                  variant={now ? 'selected' : 'quiet'}
                  aria-pressed={now}
                  aria-label={
                    now
                      ? m['shortcuts.press_for']({ action: actionLabel(action) })
                      : m['shortcuts.learn_for']({ action: actionLabel(action) })
                  }
                  onClick={() => startLearning(action)}
                >
                  {now ? m['shortcuts.press_pedal']() : m['shortcuts.learn']()}
                </Button>
              }
            />
          )
        })}
      </ListGroup>
      <p aria-live="polite" className="sr-only">
        {learning ? m['shortcuts.learning']({ action: actionLabel(learning) }) : ''}
      </p>
    </>
  )
}

/** A field to press keys into: it names the action each key or pedal would trigger. */
function KeyTestArea() {
  const learned = useKeys((s) => s.learned)
  const singleKeys = useKeys((s) => s.singleKeys)
  const [last, setLast] = useState<string | null>(null)
  const resultId = useId()
  return (
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
      className="flex min-h-16 w-full items-center gap-3 rounded-field border border-dashed border-edge px-4 py-3 text-left transition-colors duration-(--duration-fast) hover:bg-hover focus-visible:border-solid focus-visible:border-foreground"
    >
      <KeyboardIcon
        aria-hidden
        strokeWidth={1.8}
        className="size-5 shrink-0 text-muted-foreground"
      />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className="text-label">{m['shortcuts.test_area']()}</span>
        <span id={resultId} aria-live="polite" className="text-body-sm text-muted-foreground">
          {last ?? m['shortcuts.test_hint']()}
        </span>
      </span>
    </button>
  )
}

function ResetKeys() {
  const reset = useKeys((s) => s.reset)
  return (
    <Button className="self-start" onClick={reset}>
      <RotateCcwIcon aria-hidden />
      {m['shortcuts.reset']()}
    </Button>
  )
}
