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

const practice = {
  player: { loop: null as object | null, loopOn: false, speedPct: 70 },
  state: 'ready',
  send: vi.fn(),
  layers: { melody: false },
  grid: {},
  music: { melody: { phrases: [] } },
  audio: { position: () => 12 },
  loopPhrase: vi.fn(),
  setSpeed: vi.fn(),
}
const keys = { learned: {} as Record<string, string>, singleKeys: true, learning: null }
vi.mock('./practice-context', () => ({ usePractice: () => practice }))
vi.mock('./keys-store', () => ({ useKeys: { getState: () => keys } }))
vi.mock('./model/practice-sync', () => ({ noteInput: () => {} }))
// The phrase being sung at 12 s (step 18c).
vi.mock('./model/phrases', () => ({ phraseAtTime: () => 2 }))

const { useInputMapper } = await import('./input-mapper')

const press = (key: string, shiftKey = false) => {
  const event = {
    key,
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
