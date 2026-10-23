import { useEffect } from 'react'
import { m } from '@/lib/i18n'
import { useKeys } from './keys-store'
import { type Action, actionFor, ignoredTarget } from './model/keymap'
import { toggleMutePart } from './model/mixer'
import { noteInput } from './model/practice-sync'
import { usePractice } from './practice-context'
import { showHud, usePracticeUi } from './practice-store'

// InputMapper (12 §8): keyboard and page-turner pedals drive every practice action. Handled keys
// never scroll the page (preventDefault), focus stays where it is, and each action is confirmed
// by the PedalHud. Learned keys come from Settings → Keyboard & pedal or the shortcuts overlay.

const PEDAL_KEYS = new Set(['PageUp', 'PageDown'])

export function useInputMapper({ desktop }: { desktop: boolean }) {
  const practice = usePractice()
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const keys = useKeys.getState()
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
        if (ignoredTarget({ ...event, metaKey: false, ctrlKey: false, key: 'z' })) return
        event.preventDefault()
        if (event.shiftKey) practice.redo()
        else practice.undo()
        return
      }
      if (ignoredTarget(event)) return
      if (event.key === '?' && desktop) {
        event.preventDefault()
        usePracticeUi.setState({ shortcutsOpen: true })
        return
      }
      if (event.key.toLowerCase() === 'e' && practice.grid) {
        event.preventDefault()
        const bar = practice.grid.positionAt(practice.audio.position()).bar
        usePracticeUi.setState({ editor: { kind: 'bar', bar } })
        return
      }
      const action = actionFor(event.key, keys.learned)
      if (!action) return
      event.preventDefault()
      const learnedKey = Object.values(keys.learned).includes(event.key)
      noteInput(PEDAL_KEYS.has(event.key) || learnedKey ? 'pedal' : 'keyboard')
      run(action)
    }

    const run = (action: Action) => {
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
          practice.setSpeed(player.speedPct - 5)
          return
        case 'faster':
          practice.setSpeed(player.speedPct + 5)
          return
        case 'clean':
        case 'notYet':
          if (player.loop) practice.markPass(action === 'clean' ? 'clean' : 'not_yet')
          else showHud(m['practice.loop_off']())
          return
        case 'toggleLoop':
          if (!player.loop) {
            usePracticeUi.setState({ loopHint: true })
            showHud(m['practice.loop_off']())
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
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [practice, desktop])
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
  }
}
