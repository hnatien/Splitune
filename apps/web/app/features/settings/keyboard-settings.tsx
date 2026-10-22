import { useId, useState } from 'react'
import { m } from '@/lib/i18n'
import { actionLabel, keyLabel } from '../practice/input-mapper'
import { KeyBindings } from '../practice/key-bindings'
import { useKeys } from '../practice/keys-store'
import { actionFor } from '../practice/model/keymap'

// Settings → Keyboard & pedal (27 §3.9): the binding table with "Learn this pedal" per row, a test
// area that names the action a key or pedal triggers, and reset.
export function KeyboardSettings() {
  return (
    <section className="flex flex-col gap-4">
      <h2 className="text-xl">{m['settings.keyboard']()}</h2>
      <p className="text-base text-muted-foreground">{m['shortcuts.settings_intro']()}</p>
      <KeyBindings />
      <KeyTestArea />
    </section>
  )
}

function KeyTestArea() {
  const learned = useKeys((s) => s.learned)
  const [last, setLast] = useState<string | null>(null)
  const resultId = useId()
  return (
    <button
      type="button"
      aria-describedby={resultId}
      onKeyDown={(event) => {
        if (event.key === 'Tab') return
        event.preventDefault()
        const action = actionFor(event.key, learned)
        setLast(
          action
            ? m['shortcuts.test_result']({ key: keyLabel(event.key), action: actionLabel(action) })
            : m['shortcuts.test_none']({ key: keyLabel(event.key) }),
        )
      }}
      className="flex min-h-24 flex-col items-start justify-center gap-1 rounded-xl border border-dashed border-input bg-card p-4 text-left"
    >
      <span className="text-base font-medium">{m['shortcuts.test_area']()}</span>
      <span id={resultId} aria-live="polite" className="text-sm text-muted-foreground">
        {last ?? m['shortcuts.test_hint']()}
      </span>
    </button>
  )
}
