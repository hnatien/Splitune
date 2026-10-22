import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { PedalIcon } from '@/ui/icons'
import { Kbd, KbdGroup } from '@/ui/kbd'
import { actionLabel, keyLabel } from './input-mapper'
import { useKeys } from './keys-store'
import { ACTIONS, keysFor } from './model/keymap'

// The binding table of 12 §8 with "Learn this pedal" per row (Settings → Keyboard & pedal and the
// `?` overlay): press the button, then the pedal; Escape cancels.

export function KeyBindings({ learnable = true }: { learnable?: boolean }) {
  const { learned, learning, startLearning, reset, bind, cancel } = useKeys()
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
    <div className="flex flex-col gap-4">
      <table className="w-full border-collapse text-left">
        <thead>
          <tr className="border-b border-border text-sm text-muted-foreground">
            <th scope="col" className="py-2 pr-4 font-medium">
              {m['shortcuts.action']()}
            </th>
            <th scope="col" className="py-2 pr-4 font-medium">
              {m['shortcuts.keys']()}
            </th>
            {learnable && (
              <th scope="col" className="py-2 font-medium">
                <span className="sr-only">{m['shortcuts.learn']()}</span>
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {ACTIONS.map((action) => (
            <tr key={action} className="border-b border-border">
              <th scope="row" className="py-2 pr-4 text-base font-normal">
                {actionLabel(action)}
              </th>
              <td className="py-2 pr-4">
                <KbdGroup>
                  {keysFor(action, learned).map((key) => (
                    <Kbd key={key}>{keyLabel(key)}</Kbd>
                  ))}
                </KbdGroup>
              </td>
              {learnable && (
                <td className="py-2">
                  <Button
                    size="sm"
                    variant={learning === action ? 'primary' : 'outline'}
                    aria-pressed={learning === action}
                    aria-label={
                      learning === action
                        ? m['shortcuts.press_for']({ action: actionLabel(action) })
                        : m['shortcuts.learn_for']({ action: actionLabel(action) })
                    }
                    onClick={() => startLearning(action)}
                  >
                    <PedalIcon aria-hidden />
                    {learning === action ? m['shortcuts.press_pedal']() : m['shortcuts.learn']()}
                  </Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {learning ? m['shortcuts.learning']({ action: actionLabel(learning) }) : ''}
      </p>
      {learnable && (
        <Button variant="ghost" className="self-start" onClick={reset}>
          <RotateCcwIcon aria-hidden />
          {m['shortcuts.reset']()}
        </Button>
      )}
    </div>
  )
}
