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
}
vi.mock('./practice-context', () => ({ usePractice: () => practice }))
vi.mock('./keys-store', () => ({ useKeys: { getState: () => ({ learned: {} }) } }))
vi.mock('./model/practice-sync', () => ({ noteInput: () => {} }))

const { useInputMapper } = await import('./input-mapper')

const press = (key: string) => {
  const event = {
    key,
    target: null,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
    shiftKey: false,
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
    useInputMapper({ desktop: true })
  })

  it('with no loop, asks for the loop hint and says so in the HUD', () => {
    const event = press('l')
    expect(event.preventDefault).toHaveBeenCalled()
    expect(usePracticeUi.getState().loopHint).toBe(true)
    expect(usePracticeUi.getState().hud.message).toBe('No loop — tap two bars')
    expect(practice.send).not.toHaveBeenCalled()
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
