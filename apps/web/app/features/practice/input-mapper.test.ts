import { beforeEach, describe, expect, it, vi } from 'vitest'
import { INITIAL_UI, usePracticeUi } from './practice-store'

// The hook is driven without a renderer: its effect runs at once and the keydown listener it adds
// to `window` is called directly.
let keydown: ((event: KeyboardEvent) => void) | undefined
vi.stubGlobal('window', {
  addEventListener: (_type: string, handler: (event: KeyboardEvent) => void) => {
    keydown = handler
  },
  removeEventListener: () => {},
})
vi.mock('react', () => ({ useEffect: (effect: () => void) => effect() }))

// A 32-bar song, two seconds a bar; the playhead is at 12 s, so in bar 7 (index 6).
const grid = {
  firstBar: 0,
  lastBar: 31,
  positionAt: (seconds: number) => ({ bar: Math.floor(seconds / 2), beat: 1 }),
  barStart: (bar: number) => bar * 2,
  barEnd: (bar: number) => bar * 2 + 2,
}
const practice = {
  player: {
    loop: null as { startBar: number; endBar: number } | null,
    loopOn: false,
    speedPct: 70,
    countIn: false,
    countInBars: 1,
  },
  state: 'ready',
  send: vi.fn(),
  layers: { melody: false, beats: true },
  grid: grid as typeof grid | undefined,
  view: { unsureBars: new Set([2, 9, 17]) },
  music: { melody: { phrases: [] } },
  audio: { position: () => 12 },
  loopPhrase: vi.fn(),
  setSpeed: vi.fn(),
  setLoop: vi.fn(),
  markPass: vi.fn(),
  togglePlay: vi.fn(),
  restart: vi.fn(),
}
const defaults = { showUncertainty: true, update: vi.fn() }
vi.mock('@/lib/display-store', () => ({ usePracticeDefaults: { getState: () => defaults } }))
const keys = { learned: {} as Record<string, string>, singleKeys: true, learning: null }
vi.mock('./practice-context', () => ({ usePractice: () => practice }))
vi.mock('./keys-store', () => ({ useKeys: { getState: () => keys } }))
vi.mock('./model/practice-sync', () => ({ noteInput: () => {} }))
// The phrase being sung at 12 s (step 18c).
vi.mock('./model/phrases', () => ({ phraseAtTime: () => 2 }))

const { keyLabel, pedalMoment, useInputMapper } = await import('./input-mapper')

const press = (key: string, shiftKey = false, code?: string) => {
  const event = {
    key,
    code,
    target: null,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey,
    preventDefault: vi.fn(),
  }
  keydown?.(event as unknown as KeyboardEvent)
  return event
}

describe('input mapper: toggle loop', () => {
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    practice.send.mockClear()
    practice.player.loop = null
    practice.player.loopOn = false
    practice.layers.melody = false
    practice.loopPhrase.mockClear()
    useInputMapper({ desktop: true })
  })

  it('with no loop, asks for the loop hint and says so in the HUD', () => {
    const event = press('l')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(usePracticeUi.getState().loopHint).toBe(true)
    // "{source} · {action}" (27 §3.7.4).
    expect(usePracticeUi.getState().hud).toMatchObject({
      message: 'No loop — tap two bars',
      source: 'Key L',
    })
    expect(practice.send).not.toHaveBeenCalled()
  })

  it('with no loop on a sung song, loops the phrase being sung', () => {
    practice.layers.melody = true
    press('l')
    expect(practice.loopPhrase).toHaveBeenCalledWith(2)
    expect(usePracticeUi.getState().loopHint).toBe(false)
  })

  it('with a loop, toggles it and leaves the hint alone', () => {
    practice.player.loop = { startBar: 3, endBar: 4 }
    practice.player.loopOn = true
    press('l')
    expect(practice.send).toHaveBeenCalledWith({ type: 'SET_LOOP_ON', on: false })
    expect(usePracticeUi.getState().loopHint).toBe(false)
    expect(usePracticeUi.getState().hud.message).toBe('Loop off')
  })
})

describe('input mapper: speed and the pedal hint (12 §8)', () => {
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    practice.setSpeed.mockClear()
    keys.learned = {}
    keys.singleKeys = true
    useInputMapper({ desktop: true })
  })

  it('steps speed with , and . (Shift: 1 %), named in the HUD by the key', () => {
    press(',')
    expect(practice.setSpeed).toHaveBeenLastCalledWith(65)
    press('.')
    expect(practice.setSpeed).toHaveBeenLastCalledWith(75)
    press('<', true)
    expect(practice.setSpeed).toHaveBeenLastCalledWith(69)
    press('>', true)
    expect(practice.setSpeed).toHaveBeenLastCalledWith(71)
  })

  it('never changes speed with ↑ or ↓: the HUD asks to set up the pedal', () => {
    for (const key of ['ArrowUp', 'ArrowDown']) {
      const event = press(key)
      // Handled, so the page doesn't scroll.
      expect(event.preventDefault).toHaveBeenCalled()
      expect(usePracticeUi.getState().hud).toMatchObject({
        message: 'Pedal detected? Set it up',
        setUp: true,
      })
    }
    expect(practice.setSpeed).not.toHaveBeenCalled()
  })

  it('leaves single keys inert when they are off, and pedal keys working', () => {
    keys.singleKeys = false
    const event = press(',')
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(practice.setSpeed).not.toHaveBeenCalled()
    keys.learned = { faster: 'PageDown' }
    press('PageDown')
    expect(practice.setSpeed).toHaveBeenLastCalledWith(75)
  })
})

// 27 §3.7.6: a loop in one key, the loop moved by its own length, and speed by Shift and a digit.
describe('input mapper: a loop and a speed in one key each', () => {
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    practice.setLoop.mockClear()
    practice.setSpeed.mockClear()
    practice.player.loop = null
    practice.grid = grid
    keys.learned = {}
    keys.singleKeys = true
    useInputMapper({ desktop: true })
  })

  it('4 loops four bars from the bar that is playing and says which', () => {
    press('4')
    expect(practice.setLoop).toHaveBeenCalledWith(
      { startBar: 6, endBar: 9, start: 12, end: 20 },
      'numeric',
    )
    expect(usePracticeUi.getState().hud).toMatchObject({
      message: 'Loop bars 7–10',
      source: 'Key 4',
    })
  })

  it('stops a loop at the last bar of the song', () => {
    practice.audio.position = () => 60
    press('8')
    expect(practice.setLoop).toHaveBeenCalledWith(
      expect.objectContaining({ startBar: 30, endBar: 31 }),
      'numeric',
    )
    practice.audio.position = () => 12
  })

  it('says why a digit does nothing before the beat is found', () => {
    practice.grid = undefined
    press('2')
    expect(practice.setLoop).not.toHaveBeenCalled()
    expect(usePracticeUi.getState().hud.message).toBe('Bars arrive when the beat is found')
  })

  it('Shift with → and ← moves the loop by its own length, inside the song', () => {
    practice.player.loop = { startBar: 4, endBar: 7 }
    press('ArrowRight', true)
    expect(practice.setLoop).toHaveBeenLastCalledWith(
      expect.objectContaining({ startBar: 8, endBar: 11 }),
      'numeric',
    )
    press('ArrowLeft', true)
    expect(practice.setLoop).toHaveBeenLastCalledWith(
      expect.objectContaining({ startBar: 0, endBar: 3 }),
      'numeric',
    )
    practice.player.loop = { startBar: 28, endBar: 31 }
    press('ArrowRight', true)
    expect(practice.setLoop).toHaveBeenLastCalledWith(
      expect.objectContaining({ startBar: 28, endBar: 31 }),
      'numeric',
    )
  })

  it('Shift with → asks for a loop when there is none', () => {
    press('ArrowRight', true)
    expect(practice.setLoop).not.toHaveBeenCalled()
    expect(usePracticeUi.getState().loopHint).toBe(true)
  })

  it('Shift with 7 sets 70 %, whatever character the layout types', () => {
    press('&', true, 'Digit7')
    expect(practice.setSpeed).toHaveBeenLastCalledWith(70)
    press('0', true, 'Digit0')
    expect(practice.setSpeed).toHaveBeenLastCalledWith(100)
  })

  it('S opens the speed panel, says so, and is inert with single keys off', () => {
    const event = press('s')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(usePracticeUi.getState().speedOpen).toBe(true)
    expect(usePracticeUi.getState().hud).toMatchObject({ message: 'Type a speed', source: 'Key S' })
    expect(practice.setSpeed).not.toHaveBeenCalled()

    usePracticeUi.setState(INITIAL_UI)
    keys.singleKeys = false
    press('s')
    expect(usePracticeUi.getState().speedOpen).toBe(false)
  })

  it('leaves the digits inert with single keys off', () => {
    keys.singleKeys = false
    const event = press('4')
    expect(event.preventDefault).not.toHaveBeenCalled()
    expect(practice.setLoop).not.toHaveBeenCalled()
  })
})

// 27 §3.7.6: left means again, right means go, and the moment decides what that is.
describe('input mapper: the two pedal sides', () => {
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    for (const spy of [practice.markPass, practice.togglePlay, practice.restart]) spy.mockClear()
    practice.player.loop = null
    practice.grid = grid
    keys.learned = {}
    keys.singleKeys = true
    useInputMapper({ desktop: false })
  })

  it('plays or pauses with the right side and goes back with the left', () => {
    press('PageDown')
    expect(practice.togglePlay).toHaveBeenCalledTimes(1)
    expect(usePracticeUi.getState().hud).toMatchObject({ source: 'Pedal', message: 'Play' })
    press('PageUp')
    expect(practice.restart).toHaveBeenCalledTimes(1)
    expect(practice.markPass).not.toHaveBeenCalled()
  })

  it('answers a looped pass: right is Felt clean, left is Not yet', () => {
    practice.player.loop = { startBar: 4, endBar: 7 }
    usePracticeUi.setState({ promptPass: 2 })
    press('PageDown')
    expect(practice.markPass).toHaveBeenLastCalledWith('clean')
    press('PageUp')
    expect(practice.markPass).toHaveBeenLastCalledWith('not_yet')
    expect(practice.togglePlay).not.toHaveBeenCalled()
    expect(practice.restart).not.toHaveBeenCalled()
  })

  it('steps through the unsure spots in Fix and rates nothing there', () => {
    usePracticeUi.setState({ fixing: true, promptPass: 2 })
    practice.player.loop = { startBar: 4, endBar: 7 }
    press('PageDown')
    // From bar 7 (index 6) the next unsure bar is index 9.
    expect(usePracticeUi.getState().editor).toMatchObject({ kind: 'bar', bar: 9 })
    press('PageUp')
    expect(usePracticeUi.getState().editor).toMatchObject({ kind: 'bar', bar: 2 })
    expect(practice.markPass).not.toHaveBeenCalled()
  })

  it('works with single keys off, because a pedal sends no character', () => {
    keys.singleKeys = false
    press('PageDown')
    expect(practice.togglePlay).toHaveBeenCalledTimes(1)
  })
})

describe('pedalMoment', () => {
  it('follows the pass prompt only while a loop is on, and Fix before either', () => {
    expect(pedalMoment({ promptPass: 3, loop: true, fixing: false })).toBe('pass')
    expect(pedalMoment({ promptPass: 0, loop: true, fixing: false })).toBe('play')
    expect(pedalMoment({ promptPass: 2, loop: false, fixing: false })).toBe('play')
    expect(pedalMoment({ promptPass: 4, loop: true, fixing: true })).toBe('fix')
  })
})

describe('input mapper: count-in, marks and the keys named in the HUD', () => {
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    practice.send.mockClear()
    defaults.update.mockClear()
    practice.player.countIn = false
    practice.player.countInBars = 1
    practice.grid = grid
    keys.learned = {}
    keys.singleKeys = true
    useInputMapper({ desktop: true })
  })

  it('I steps the count-in: off, 1 bar, 2 bars, off', () => {
    press('i')
    expect(practice.send).toHaveBeenLastCalledWith({ type: 'SET_COUNT_IN', on: true, bars: 1 })
    practice.player.countIn = true
    press('i')
    expect(practice.send).toHaveBeenLastCalledWith({ type: 'SET_COUNT_IN', on: true, bars: 2 })
    practice.player.countInBars = 2
    press('i')
    expect(practice.send).toHaveBeenLastCalledWith({ type: 'SET_COUNT_IN', on: false })
    expect(usePracticeUi.getState().hud.message).toBe('Count-in off')
  })

  it('U hides and shows the unsure marks and says which', () => {
    press('u')
    expect(defaults.update).toHaveBeenLastCalledWith({ showUncertainty: false })
    expect(usePracticeUi.getState().hud).toMatchObject({
      message: 'Unsure marks hidden',
      source: 'Key U',
    })
  })

  it('X opens the tools on Mix and closes them again', () => {
    press('x')
    expect(usePracticeUi.getState()).toMatchObject({ inspectorOpen: true, tab: 'mix' })
    press('x')
    expect(usePracticeUi.getState().inspectorOpen).toBe(false)
  })

  it('names Shift keys in the HUD', () => {
    expect(keyLabel('Shift+7')).toBe('⇧7')
    expect(keyLabel('Shift+ArrowLeft')).toBe('⇧←')
  })
})

// 27 §3.7.6: Y accepts the suggested fix on the selected spot, by pressing the spot's own control.
describe('input mapper: accept a fix', () => {
  const primary = { click: vi.fn() }
  beforeEach(() => {
    usePracticeUi.setState(INITIAL_UI)
    primary.click.mockClear()
    keys.learned = {}
    keys.singleKeys = true
    vi.stubGlobal('document', {
      querySelector: (selector: string) => (selector === '[data-fix-primary]' ? primary : null),
    })
    useInputMapper({ desktop: true })
  })

  it("presses the spot's primary control in Fix mode", () => {
    usePracticeUi.setState({ fixing: true })
    press('y')
    expect(primary.click).toHaveBeenCalledTimes(1)
  })

  it('works from the bar editor on touch layouts too', () => {
    usePracticeUi.setState({ editor: { kind: 'bar', bar: 4 } })
    press('y')
    expect(primary.click).toHaveBeenCalledTimes(1)
  })

  it('does nothing while practising, where there is no spot', () => {
    press('y')
    expect(primary.click).not.toHaveBeenCalled()
  })

  it('says so when the selected spot has nothing to accept', () => {
    usePracticeUi.setState({ fixing: true })
    vi.stubGlobal('document', { querySelector: () => null })
    press('y')
    expect(usePracticeUi.getState().hud.message).toBe('Nothing to accept on this spot')
  })
})
