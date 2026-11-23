import { useEffect } from 'react'
import { usePracticeDefaults } from '@/lib/display-store'
import { m } from '@/lib/i18n'
import { useKeys } from './keys-store'
import { type Action, ignoredTarget, keyOf, type LoopBars, resolveKey } from './model/keymap'
import { barRange } from './model/loops'
import { toggleMutePart } from './model/mixer'
import { phraseAtTime } from './model/phrases'
import { noteInput } from './model/practice-sync'
import type { ChosenView } from './model/screen'
import { usePractice } from './practice-context'
import {
  chooseView,
  fixCommand,
  openTab,
  pressedWith,
  sheetCommand,
  showHud,
  usePracticeUi,
} from './practice-store'

// InputMapper (12 §8, 27 §3.7.6): keyboard and page-turner pedals drive every practice action.
// Handled keys never scroll the page (preventDefault), focus stays where it is, and each action
// is confirmed by the PedalHud as "{source} · {action}" within 100 ms. Learned keys come from
// Settings → Keyboard & pedal or the shortcuts overlay. ↑/↓ never change speed (model/keymap.ts),
// and with single keys off only chords, pedal keys and learned keys act (WCAG 2.1.4); ⌘K / Ctrl K
// is the shell's (palette-launcher) and works either way.
//
// The pedal's two sides mean "again" (left) and "go" (right), and the moment decides what that
// is: after a looped pass they answer it (Not yet, Felt clean); in Fix they step through the
// unsure spots; otherwise left goes back to the loop's start (or back a bar) and right plays or
// pauses. `pedalMeaning` is that table, shown live in the transport.

const PEDAL_KEYS = new Set(['PageUp', 'PageDown'])

export type PedalMoment = 'pass' | 'fix' | 'play'

/** What the two pedal sides do now (27 §3.7.6). */
export function pedalMoment(input: {
  promptPass: number
  loop: boolean
  fixing: boolean
}): PedalMoment {
  if (input.fixing) return 'fix'
  return input.loop && input.promptPass > 0 ? 'pass' : 'play'
}

export function useInputMapper({
  desktop,
  views = [],
}: {
  desktop: boolean
  /** The view switch's choices, in order, for V. */
  views?: readonly ChosenView[]
}) {
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
      const pedal = PEDAL_KEYS.has(event.key) || (result.kind === 'action' && result.learned)
      noteInput(pedal ? 'pedal' : 'keyboard')
      if (pedal && !usePracticeUi.getState().pedalSeen) usePracticeUi.setState({ pedalSeen: true })
      // A press on one of the pedal's two sides is named by its side; any other pedal key is "Pedal".
      const side =
        result.kind === 'action' && result.action === 'pedalRight'
          ? m['practice.pedal_right']()
          : result.kind === 'action' && result.action === 'pedalLeft'
            ? m['practice.pedal_left']()
            : m['practice.hud_pedal']()
      pressedWith(pedal ? side : m['practice.hud_key']({ key: keyLabel(keyOf(event)) }), () => {
        if (result.kind === 'loop-bars') loopBars(result.bars)
        else if (result.kind === 'speed') practice.setSpeed(result.pct)
        else run(result.action, result.fine)
      })
    }

    // 1, 2, 4, 8: that many bars from the bar that's playing become the loop, and it is on.
    const loopBars = (bars: LoopBars) => {
      const { grid } = practice
      if (!grid) {
        showHud(m['practice.hud_no_beats']())
        return
      }
      const start = Math.max(grid.firstBar, grid.positionAt(practice.audio.position()).bar)
      const end = Math.min(grid.lastBar, start + bars - 1)
      practice.setLoop(barRange(grid, start, end), 'numeric')
      showHud(m['nav.loop_bars']({ start: String(start + 1), end: String(end + 1) }))
    }

    // Shift with ← or →: the loop moves by its own length, staying inside the song.
    const shiftLoop = (direction: 1 | -1) => {
      const { grid, player } = practice
      const loop = player.loop
      if (!grid || !loop) {
        usePracticeUi.setState({ loopHint: true })
        showHud(m['practice.hud_no_loop']())
        return
      }
      const length = loop.endBar - loop.startBar + 1
      const start = Math.min(
        Math.max(grid.firstBar, loop.startBar + direction * length),
        Math.max(grid.firstBar, grid.lastBar - length + 1),
      )
      const end = Math.min(grid.lastBar, start + length - 1)
      practice.setLoop(barRange(grid, start, end), 'numeric')
      showHud(m['nav.loop_bars']({ start: String(start + 1), end: String(end + 1) }))
    }

    // J, K and E (12 §8). With the tools panel that is Fix mode, which holds the queue of unsure
    // spots. Touch layouts fix in the editor sheet: open, it steps through the same queue; closed,
    // J or K opens it on the first unsure spot (practice-page's useSheetFix), and E on the bar
    // that's playing.
    const stepUnsure = (action: 'nextUnsure' | 'previousUnsure' | 'fixBar') => {
      const { grid } = practice
      if (!grid) return
      const now = grid.positionAt(practice.audio.position()).bar
      const step = { kind: action === 'nextUnsure' ? 'next' : 'previous' } as const
      if (desktop) {
        fixCommand(action === 'fixBar' ? { kind: 'bar', bar: now } : step)
        return
      }
      if (action === 'fixBar') {
        usePracticeUi.setState({ editor: { kind: 'bar', bar: now } })
        showHud(m['practice.hud_bar']({ bar: String(now + 1) }))
      } else if (usePracticeUi.getState().editor) {
        sheetCommand(step)
      } else {
        usePracticeUi.setState({ fixing: true })
      }
    }

    const run = (action: Action, fine: boolean) => {
      const { player, state } = practice
      // Fix mode loops bars to listen to, not to practise: nothing is rated, and the learner's
      // mix isn't what is playing (27 §3.7.4).
      const fixing = usePracticeUi.getState().fixing
      if (fixing && (action === 'clean' || action === 'notYet' || action === 'mutePart')) return
      // Outside Fix (and the bar editor) there is no spot to accept.
      if (action === 'acceptFix' && !fixing && usePracticeUi.getState().editor === null) return
      switch (action) {
        case 'pedalRight':
        case 'pedalLeft': {
          const right = action === 'pedalRight'
          const moment = pedalMoment({
            promptPass: usePracticeUi.getState().promptPass,
            loop: player.loop !== null,
            fixing,
          })
          if (moment === 'pass') practice.markPass(right ? 'clean' : 'not_yet')
          else if (moment === 'fix') stepUnsure(right ? 'nextUnsure' : 'previousUnsure')
          else run(right ? 'playPause' : 'restart', false)
          return
        }
        case 'fromTop':
          if (player.loop && player.loopOn) {
            practice.restart()
          } else {
            practice.send({ type: 'SEEK', seconds: 0 })
            showHud(m['practice.hud_from_top']())
          }
          return
        case 'loopBack':
        case 'loopForward':
          shiftLoop(action === 'loopForward' ? 1 : -1)
          return
        case 'countIn': {
          if (!practice.layers.beats) {
            showHud(m['practice.hud_no_beats']())
            return
          }
          // Off, then 1 bar, then 2 bars.
          const bars = !player.countIn ? 1 : player.countInBars === 1 ? 2 : 0
          practice.send({ type: 'SET_COUNT_IN', on: bars > 0, ...(bars > 0 ? { bars } : {}) })
          showHud(
            bars === 0
              ? m['practice.hud_count_in_off']()
              : bars === 1
                ? m['practice.hud_count_in_one']()
                : m['practice.hud_count_in_two'](),
          )
          return
        }
        case 'click': {
          if (!practice.layers.beats) {
            showHud(m['practice.hud_no_beats']())
            return
          }
          const on = !player.metronome
          practice.send({ type: 'SET_METRONOME', on })
          showHud(on ? m['practice.hud_click_on']() : m['practice.hud_click_off']())
          return
        }
        case 'speed':
          usePracticeUi.setState({ speedOpen: true })
          showHud(m['shortcuts.speed']())
          return
        case 'tools': {
          const ui = usePracticeUi.getState()
          if (ui.inspectorOpen && ui.tab === 'mix') {
            usePracticeUi.setState({ inspectorOpen: false })
            showHud(m['practice.hud_tools_closed']())
          } else {
            openTab('mix')
            showHud(m['practice.tab_mix']())
          }
          return
        }
        case 'view': {
          if (views.length < 2) return
          const ui = usePracticeUi.getState()
          const current = views.findIndex((view) => view === (ui.view ?? views[0]))
          chooseView(views[(current + 1) % views.length] ?? 'tab')
          return
        }
        case 'marks': {
          const defaults = usePracticeDefaults.getState()
          defaults.update({ showUncertainty: !defaults.showUncertainty })
          showHud(
            defaults.showUncertainty ? m['practice.hud_marks_off']() : m['practice.hud_marks_on'](),
          )
          return
        }
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
        // Fix (12 §4, §8): J / K step through the unsure spots and E takes the bar that's
        // playing. With the panel that is Fix mode, which holds the queue; touch layouts open
        // the bar in the editor sheet.
        case 'nextUnsure':
        case 'previousUnsure':
        case 'fixBar':
          stepUnsure(action)
          return
        case 'acceptFix': {
          // The spot's own primary control does it, so the key and the button are one path.
          const primary = document.querySelector<HTMLElement>('[data-fix-primary]')
          if (primary) primary.click()
          else showHud(m['practice.hud_no_fix']())
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
  }, [practice, desktop, views])
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
    case 'Home':
      return m['practice.key_home']()
    default:
      if (key.startsWith('Shift+')) return `⇧${keyLabel(key.slice('Shift+'.length))}`
      return key.length === 1 ? key.toUpperCase() : key
  }
}

export function actionLabel(action: Action): string {
  switch (action) {
    case 'playPause':
      return m['shortcuts.play_pause']()
    case 'pedalRight':
      return m['shortcuts.pedal_right']()
    case 'pedalLeft':
      return m['shortcuts.pedal_left']()
    case 'fromTop':
      return m['shortcuts.from_top']()
    case 'loopBack':
      return m['shortcuts.loop_back']()
    case 'loopForward':
      return m['shortcuts.loop_forward']()
    case 'countIn':
      return m['shortcuts.count_in']()
    case 'click':
      return m['shortcuts.click']()
    case 'speed':
      return m['shortcuts.speed']()
    case 'tools':
      return m['shortcuts.tools']()
    case 'view':
      return m['shortcuts.view']()
    case 'marks':
      return m['shortcuts.marks']()
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
    case 'acceptFix':
      return m['shortcuts.accept_fix']()
    case 'previousPhrase':
      return m['shortcuts.previous_phrase']()
    case 'nextPhrase':
      return m['shortcuts.next_phrase']()
    case 'cueNote':
      return m['shortcuts.cue_note']()
  }
}
