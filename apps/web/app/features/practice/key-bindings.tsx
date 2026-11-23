import { RotateCcwIcon } from 'lucide-react'
import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { Button } from '@/ui/button'
import { PedalIcon } from '@/ui/icons'
import { Kbd, KbdGroup } from '@/ui/kbd'
import { actionLabel, keyLabel } from './input-mapper'
import { useKeys } from './keys-store'
import { ACTIONS, keysFor, LOOP_BARS, SPEED_KEYS } from './model/keymap'

// The binding list of 12 §8 (Settings → Keyboard & pedal and the `?` overlay; s47 direction §7):
// one hairline row per action with its name, its key caps (wrapping, never clipped at 375 px) and
// a quiet "Learn" that takes the next key or pedal press for it; the row being learned has the
// ink edge and says "Press it now". Escape cancels. The digit keys for loops and speeds close the
// list; they are fixed, not learnable.

const ROW = 'border-b border-border align-middle'

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
          <tr className="border-b border-border text-label-sm text-muted-foreground">
            <th scope="col" className="py-2 pr-3 font-medium">
              {m['shortcuts.action']()}
            </th>
            <th scope="col" className="py-2 pr-3 font-medium">
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
          {ACTIONS.map((action) => {
            const now = learning === action
            return (
              <tr key={action} className={ROW} data-learning={now || undefined}>
                <th scope="row" className="py-1.5 pr-3 text-body-sm font-normal">
                  {actionLabel(action)}
                </th>
                <td className="py-1.5 pr-3">
                  <KbdGroup className="flex-wrap">
                    {keysFor(action, learned).map((key) => (
                      <Kbd key={key}>{keyLabel(key)}</Kbd>
                    ))}
                  </KbdGroup>
                </td>
                {learnable && (
                  <td className="py-1 text-right">
                    <Button
                      variant={now ? 'selected' : 'quiet'}
                      size="sm"
                      aria-pressed={now}
                      aria-label={
                        now
                          ? m['shortcuts.press_for']({ action: actionLabel(action) })
                          : m['shortcuts.learn_for']({ action: actionLabel(action) })
                      }
                      onClick={() => startLearning(action)}
                    >
                      <PedalIcon aria-hidden />
                      <span className="max-sm:sr-only">
                        {now ? m['shortcuts.press_pedal']() : m['shortcuts.learn_short']()}
                      </span>
                    </Button>
                  </td>
                )}
              </tr>
            )
          })}
          {/* The digit keys: fixed, not learnable, and off with single keys like every character. */}
          <tr className={ROW}>
            <th scope="row" className="py-2 pr-3 text-body-sm font-normal">
              {m['shortcuts.loop_bars']()}
            </th>
            <td className="py-2 pr-3" colSpan={learnable ? 2 : 1}>
              <KbdGroup className="flex-wrap">
                {LOOP_BARS.map((bars) => (
                  <Kbd key={bars}>{bars}</Kbd>
                ))}
              </KbdGroup>
            </td>
          </tr>
          <tr className={ROW}>
            <th scope="row" className="py-2 pr-3 text-body-sm font-normal">
              {m['shortcuts.speed_keys']()}
            </th>
            <td className="py-2 pr-3" colSpan={learnable ? 2 : 1}>
              <KbdGroup className="flex-wrap">
                {Object.keys(SPEED_KEYS).map((key) => (
                  <Kbd key={key}>{keyLabel(key)}</Kbd>
                ))}
              </KbdGroup>
            </td>
          </tr>
        </tbody>
      </table>
      <p aria-live="polite" className="text-body-sm text-muted-foreground">
        {learning ? m['shortcuts.learning']({ action: actionLabel(learning) }) : ''}
      </p>
      {learnable && (
        <Button variant="quiet" className="self-start" onClick={reset}>
          <RotateCcwIcon aria-hidden />
          {m['shortcuts.reset']()}
        </Button>
      )}
    </div>
  )
}
