import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { useKeys } from './keys-store'
import { type Action, ignoredTarget, keyOf, resolveKey } from './model/keymap'
import { toggleMutePart } from './model/mixer'
import { phraseAtTime } from './model/phrases'
import { noteInput } from './model/practice-sync'
import { usePractice } from './practice-context'
import { pressedWith, showHud, usePracticeUi } from './practice-store'

// InputMapper (12 §8): keyboard and page-turner pedals drive every practice action. Handled keys
// never scroll the page (preventDefault), focus stays where it is, and each action is confirmed
// by the PedalHud as "{source} · {action}" within 100 ms. Learned keys come from Settings →
// Keyboard & pedal or the shortcuts overlay. ↑/↓ never change speed (model/keymap.ts), and with
// single keys off only chords, pedal keys and learned keys act (WCAG 2.1.4); ⌘K / Ctrl K is the
// shell's (palette-launcher) and works either way.

const PEDAL_KEYS = new Set(['PageUp', 'PageDown'])

export function useInputMapper({ desktop }: { desktop: boolean }) {
  const practice = usePractice()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys = useKeys.getState()
      if (keys.learning) return
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (ignoredTarget({ ...event, metaKey: false, ctrlKey: false, key: 'z' })) return
        event.preventDefault()
        if (event.shiftKey) practice.redo()
        else practice.undo()
        return
      }
      if (ignoredTarget(event)) return
      if (event.key === '?' && desktop && keys.singleKeys) {
        event.preventDefault()
        usePracticeUi.setState({ shortcutsOpen: true })
        return
      }
      const result = resolveKey(event, keys.learned, keys.singleKeys)
      if (result.kind === 'none') return
      // Handled keys never scroll the page or press the focused control (the focus sink, 12 §8).
      event.preventDefault()
      if (result.kind === 'pedal-hint') {
        showHud(m['practice.pedal_detected'](), {
          source: m['practice.hud_key']({ key: keyLabel(event.key) }),
          setUp: true,
        })
        return
      }
      const pedal = PEDAL_KEYS.has(event.key) || result.learned
      noteInput(pedal ? 'pedal' : 'keyboard')
      pressedWith(
        pedal ? m['practice.hud_pedal']() : m['practice.hud_key']({ key: keyLabel(keyOf(event)) }),
        () => run(result.action, result.fine),
      )
    }

    const run = (action: Action, fine: boolean) => {
      const { player, state } = practice
      switch (action) {
        case 'playPause': {
          const playing = state === 'playing' || state === 'countIn' || state === 'loopRest'
          practice.togglePlay()
          showHud(playing ? m['practice.pause']() : m['practice.play']())
          return
        }
        case 'restart':
          practice.restart()
          return
        case 'next':
          practice.stepBar(1)
          return
        case 'slower':
        case 'faster':
          practice.setSpeed(player.speedPct + (action === 'faster' ? 1 : -1) * (fine ? 1 : 5))
          return
        case 'clean':
        case 'notYet':
          if (player.loop) practice.markPass(action === 'clean' ? 'clean' : 'not_yet')
          else showHud(m['practice.hud_no_loop']())
          return
        case 'toggleLoop':
          // A sung song with no loop yet loops the phrase being sung.
          if (!player.loop && practice.layers.melody && practice.grid) {
            const phrases = practice.music?.melody?.phrases ?? []
            const index = phraseAtTime(practice.grid, phrases, practice.audio.position())
            if (index >= 0) {
              practice.loopPhrase(index)
              return
            }
          }
          if (!player.loop) {
            usePracticeUi.setState({ loopHint: true })
            showHud(m['practice.hud_no_loop']())
            return
          }
          practice.send({ type: 'SET_LOOP_ON', on: !player.loopOn })
          showHud(player.loopOn ? m['practice.hud_loop_off']() : m['practice.hud_loop_on']())
          return
        case 'mutePart': {
          if (practice.channels.length === 0) {
            showHud(m['practice.hud_no_stems']())
            return
          }
          const next = toggleMutePart(practice.channels, practice.mix)
          practice.setMix(next)
          const part = practice.channels.find((c) => c.role === 'part')
          showHud(
            part && next[part.stemId]?.muted
              ? m['practice.hud_part_muted']()
              : m['practice.hud_part_on'](),
          )
          return
        }
        // The Fix tab (12 §4): the bar that's playing, or the next / previous unsure bar.
        case 'nextUnsure':
        case 'previousUnsure':
        case 'fixBar': {
          const { grid, view } = practice
          if (!grid) return
          const now = grid.positionAt(practice.audio.position()).bar
          const bar =
            action === 'fixBar'
              ? now
              : unsureAfter(view?.unsureBars, now, action === 'nextUnsure' ? 1 : -1)
          if (bar === undefined) {
            showHud(m['practice.hud_no_unsure']())
            return
          }
          usePracticeUi.setState({ editor: { kind: 'bar', bar } })
          showHud(m['practice.hud_bar']({ bar: String(bar + 1) }))
          return
        }
        case 'previousPhrase':
        case 'nextPhrase':
          practice.stepPhrase(action === 'nextPhrase' ? 1 : -1)
          return
        case 'cueNote':
          practice.cueNote()
          return
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [practice, desktop])
}

/** The next (1) or previous (−1) unsure bar from `bar`, wrapping round the song. */
export function unsureAfter(
  bars: ReadonlySet<number> | undefined,
  bar: number,
  direction: 1 | -1,
): number | undefined {
  const sorted = [...(bars ?? [])].sort((a, b) => a - b)
  if (sorted.length === 0) return undefined
  return direction === 1
    ? (sorted.find((b) => b > bar) ?? sorted[0])
    : (sorted.findLast((b) => b < bar) ?? sorted.at(-1))
}

/** Visible name of a key for the shortcut tables. */
export function keyLabel(key: string): string {
  switch (key) {
    case ' ':
      return m['practice.key_space']()
    case 'ArrowLeft':
      return '←'
    case 'ArrowRight':
      return '→'
    case 'ArrowUp':
      return '↑'
    case 'ArrowDown':
      return '↓'
    case 'PageUp':
      return m['practice.key_page_up']()
    case 'PageDown':
      return m['practice.key_page_down']()
    default:
      return key.length === 1 ? key.toUpperCase() : key
  }
}

export function actionLabel(action: Action): string {
  switch (action) {
    case 'playPause':
      return m['shortcuts.play_pause']()
    case 'restart':
      return m['shortcuts.restart']()
    case 'next':
      return m['shortcuts.next']()
    case 'slower':
      return m['shortcuts.slower']()
    case 'faster':
      return m['shortcuts.faster']()
    case 'clean':
      return m['practice.felt_clean']()
    case 'notYet':
      return m['practice.not_yet']()
    case 'toggleLoop':
      return m['shortcuts.toggle_loop']()
    case 'mutePart':
      return m['shortcuts.mute_part']()
    case 'nextUnsure':
      return m['shortcuts.next_unsure']()
    case 'previousUnsure':
      return m['shortcuts.previous_unsure']()
    case 'fixBar':
      return m['shortcuts.edit_bar']()
    case 'previousPhrase':
      return m['shortcuts.previous_phrase']()
    case 'nextPhrase':
      return m['shortcuts.next_phrase']()
    case 'cueNote':
      return m['shortcuts.cue_note']()
  }
}
