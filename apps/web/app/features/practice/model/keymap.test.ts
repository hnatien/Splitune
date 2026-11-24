import { describe, expect, it } from 'vitest'
import {
  ACTIONS,
  actionFor,
  DEFAULT_KEYS,
  ignoredTarget,
  keyOf,
  keysFor,
  LOOP_BARS,
  learn,
  readLearnedKeys,
  resolveKey,
  SPEED_KEYS,
} from './keymap'
import { pointerFocus } from './pointer-focus'

const target = (html: string, selector: string) => {
  const host = {
    closest: (s: string) =>
      s.split(',').some((part) => part.trim() === selector || part.includes(selector)) ? {} : null,
  }
  return {
    target: host as unknown as EventTarget,
    key: html,
    altKey: false,
    ctrlKey: false,
    metaKey: false,
  }
}

describe('key map', () => {
  it('maps the default keys of 12 §8', () => {
    expect(actionFor(' ', {})).toBe('playPause')
    expect(actionFor('ArrowLeft', {})).toBe('restart')
    expect(actionFor('ArrowRight', {})).toBe('next')
    expect(actionFor('C', {})).toBe('clean')
    expect(actionFor(',', {})).toBe('slower')
    expect(actionFor('.', {})).toBe('faster')
    expect(actionFor('J', {})).toBe('nextUnsure')
    expect(actionFor('k', {})).toBe('previousUnsure')
    expect(actionFor('e', {})).toBe('fixBar')
    expect(actionFor('q', {})).toBeUndefined()
  })

  it('gives the pedal its own two sides: Page Down is go, Page Up is again', () => {
    expect(actionFor('PageDown', {})).toBe('pedalRight')
    expect(actionFor('PageUp', {})).toBe('pedalLeft')
    // The bar keys are the arrows alone now, so a pedal press never skips a bar by accident.
    expect(DEFAULT_KEYS.next).toEqual(['ArrowRight'])
    expect(DEFAULT_KEYS.restart).toEqual(['ArrowLeft'])
  })

  it('maps the keys of 27 §3.7.6: from the top, count-in, tools, view and marks', () => {
    expect(actionFor('r', {})).toBe('fromTop')
    expect(actionFor('Home', {})).toBe('fromTop')
    expect(actionFor('i', {})).toBe('countIn')
    expect(actionFor('t', {})).toBe('click')
    expect(actionFor('x', {})).toBe('tools')
    expect(actionFor('s', {})).toBe('speed')
    expect(actionFor('S', {})).toBe('speed')
    expect(actionFor('v', {})).toBe('view')
    expect(actionFor('u', {})).toBe('marks')
    expect(actionFor('Shift+ArrowLeft', {})).toBe('loopBack')
    expect(actionFor('Shift+ArrowRight', {})).toBe('loopForward')
  })

  it('binds no default key to two actions', () => {
    const keys = ACTIONS.flatMap((action) => DEFAULT_KEYS[action].map((key) => key.toLowerCase()))
    expect(new Set(keys).size).toBe(keys.length)
    // The digits and Shift with a digit are the loop lengths and the speeds, never an action.
    for (const key of [...LOOP_BARS.map(String), ...Object.keys(SPEED_KEYS)]) {
      expect([key, keys.includes(key.toLowerCase())]).toEqual([key, false])
    }
  })

  it('maps the vocal phrase keys', () => {
    expect(actionFor('[', {})).toBe('previousPhrase')
    expect(actionFor(']', {})).toBe('nextPhrase')
    expect(actionFor('P', {})).toBe('cueNote')
  })

  it('lets a learned key win and keeps one learned key per action', () => {
    let learned = learn({}, 'clean', 'b')
    expect(actionFor('b', learned)).toBe('clean')
    learned = learn(learned, 'notYet', 'PageDown')
    expect(actionFor('PageDown', learned)).toBe('notYet')
    learned = learn(learned, 'clean', 'PageDown')
    expect(learned).toEqual({ clean: 'PageDown' })
    expect(keysFor('clean', learned)).toEqual(['PageDown', 'c'])
  })

  it('reads stored keys defensively', () => {
    expect(readLearnedKeys({ getItem: () => '{"clean":"b","bogus":"x","next":3}' })).toEqual({
      clean: 'b',
    })
    expect(readLearnedKeys({ getItem: () => 'not json' })).toEqual({})
    expect(readLearnedKeys(undefined)).toEqual({})
  })

  it('leaves typing, focused buttons and modifiers alone', () => {
    expect(ignoredTarget(target('a', 'input'))).toBe(true)
    expect(ignoredTarget(target(' ', 'button'))).toBe(true)
    expect(ignoredTarget(target('ArrowLeft', 'button'))).toBe(false)
    expect(ignoredTarget({ ...target('l', 'div'), metaKey: true })).toBe(true)
  })

  it('keeps Space and Enter global on a control that was only clicked', () => {
    const control = {}
    const inside = {
      closest: (selector: string) => (selector.startsWith('button') ? control : null),
    } as unknown as EventTarget
    const on = (key: string) => ({
      target: inside,
      key,
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    })
    // Tabbed to, or focused by the app (Fix puts focus on "It's right"): the keys press it.
    expect(ignoredTarget(on(' '))).toBe(true)
    expect(ignoredTarget(on('Enter'))).toBe(true)
    // Clicked or tapped: Space plays, so the keys stay ours.
    pointerFocus.press(inside)
    expect(ignoredTarget(on(' '))).toBe(false)
    expect(ignoredTarget(on('Enter'))).toBe(false)
    // Focus leaves another control: this one is still the pointer's.
    pointerFocus.leave({} as unknown as EventTarget)
    expect(ignoredTarget(on(' '))).toBe(false)
    // Tab moves focus by keyboard: wherever it lands, the keys press that control.
    pointerFocus.tab()
    expect(ignoredTarget(on(' '))).toBe(true)
    // Focus leaves the clicked control and comes back some other way.
    pointerFocus.press(inside)
    pointerFocus.leave(control as unknown as EventTarget)
    expect(ignoredTarget(on('Enter'))).toBe(true)
    // A press outside any control takes the pointer's claim away.
    pointerFocus.press(inside)
    pointerFocus.press({ closest: () => null } as unknown as EventTarget)
    expect(ignoredTarget(on(' '))).toBe(true)
  })

  it('keeps the keys working inside the practice sheets, and nowhere else that is a popup', () => {
    const inside = (attributes: string[]) => ({
      target: {
        closest: (selector: string) =>
          selector.includes('[role="dialog"]')
            ? { hasAttribute: (name: string) => attributes.includes(name) }
            : null,
      } as unknown as EventTarget,
      key: 'j',
      altKey: false,
      ctrlKey: false,
      metaKey: false,
    })
    // The tools sheet and the bar editor carry data-practice-keys: J, K, Y and the pedal act.
    expect(ignoredTarget(inside(['data-practice-keys']))).toBe(false)
    // Any other dialog, menu or listbox owns its keys.
    expect(ignoredTarget(inside([]))).toBe(true)
  })

  it('accepts the suggested fix with Y', () => {
    expect(actionFor('y', {})).toBe('acceptFix')
  })

  describe('resolveKey (12 §8, frozen decision 5)', () => {
    const press = (key: string, extra: { shiftKey?: boolean; code?: string } = {}) => ({
      key,
      shiftKey: false,
      ...extra,
    })

    it('never changes speed with ↑ or ↓: it asks for the pedal until one is set up', () => {
      for (const key of ['ArrowUp', 'ArrowDown']) {
        expect(resolveKey(press(key), {}, true)).toEqual({ kind: 'pedal-hint' })
        expect(resolveKey(press(key, { shiftKey: true }), {}, true)).toEqual({ kind: 'pedal-hint' })
        // A set-up pedal that didn't bind ↑/↓: they do nothing.
        expect(resolveKey(press(key), { playPause: 'PageDown' }, true)).toEqual({ kind: 'none' })
      }
      // Bound by the pedal setup, ↑ acts, and only as bound.
      expect(resolveKey(press('ArrowUp'), { playPause: 'ArrowUp' }, true)).toMatchObject({
        kind: 'action',
        action: 'playPause',
      })
    })

    it('steps speed with , and . by 5 %, and with Shift by 1 %', () => {
      expect(resolveKey(press(','), {}, true)).toMatchObject({ action: 'slower', fine: false })
      expect(resolveKey(press('.'), {}, true)).toMatchObject({ action: 'faster', fine: false })
      // US layout: Shift turns them into < and >; elsewhere the physical key still counts.
      expect(resolveKey(press('<', { shiftKey: true }), {}, true)).toMatchObject({
        action: 'slower',
        fine: true,
      })
      expect(resolveKey(press('>', { shiftKey: true }), {}, true)).toMatchObject({
        action: 'faster',
        fine: true,
      })
      expect(resolveKey(press(';', { shiftKey: true, code: 'Comma' }), {}, true)).toMatchObject({
        action: 'slower',
        fine: true,
      })
    })

    it('loops 1, 2, 4 or 8 bars from here with the digit alone', () => {
      for (const bars of LOOP_BARS) {
        expect(resolveKey(press(String(bars)), {}, true)).toEqual({ kind: 'loop-bars', bars })
      }
      // The other digits do nothing, so a slip never sets an odd loop.
      for (const key of ['3', '5', '6', '7', '9', '0']) {
        expect([key, resolveKey(press(key), {}, true)]).toEqual([key, { kind: 'none' }])
      }
    })

    it('sets the speed with Shift and 5 … 0, read from the physical digit on any layout', () => {
      const shifted = (code: string, key: string) => ({ key, code, shiftKey: true })
      // A US layout types % ^ & * ( ) with Shift; a French one types the digits themselves.
      expect(resolveKey(shifted('Digit5', '%'), {}, true)).toEqual({ kind: 'speed', pct: 50 })
      expect(resolveKey(shifted('Digit7', '&'), {}, true)).toEqual({ kind: 'speed', pct: 70 })
      expect(resolveKey(shifted('Digit7', '7'), {}, true)).toEqual({ kind: 'speed', pct: 70 })
      expect(resolveKey(shifted('Digit0', ')'), {}, true)).toEqual({ kind: 'speed', pct: 100 })
      // Shift with 1 … 4 is not a speed, and not a loop either.
      expect(resolveKey(shifted('Digit4', '$'), {}, true)).toEqual({ kind: 'none' })
      expect(keyOf(shifted('Digit7', '&'))).toBe('Shift+7')
    })

    it('a slowed loop is three keys: 4, Shift+7, Space', () => {
      expect(resolveKey(press('4'), {}, true)).toEqual({ kind: 'loop-bars', bars: 4 })
      expect(resolveKey({ key: '&', code: 'Digit7', shiftKey: true }, {}, true)).toEqual({
        kind: 'speed',
        pct: 70,
      })
      expect(resolveKey(press(' '), {}, true)).toMatchObject({ action: 'playPause' })
    })

    it('makes single keys inert when they are switched off, and keeps the rest', () => {
      for (const key of ['c', 'n', 'l', 'm', 'j', 'k', 'e', ',', '.', '[', ']', 'p']) {
        expect(resolveKey(press(key), {}, false)).toEqual({ kind: 'none' })
        expect(resolveKey(press(key), {}, true).kind).toBe('action')
      }
      for (const key of ['r', 'i', 'x', 'v', 'u', '1', '2', '4', '8']) {
        expect([key, resolveKey(press(key), {}, false)]).toEqual([key, { kind: 'none' }])
      }
      // Shift with a digit types a symbol, so it is a character key too.
      expect(resolveKey({ key: '&', code: 'Digit7', shiftKey: true }, {}, false)).toEqual({
        kind: 'none',
      })
      // Pedal keys, Home and the arrows (with Shift too) aren't character keys.
      expect(resolveKey(press(' '), {}, false)).toMatchObject({ action: 'playPause' })
      expect(resolveKey(press('PageDown'), {}, false)).toMatchObject({ action: 'pedalRight' })
      expect(resolveKey(press('PageUp'), {}, false)).toMatchObject({ action: 'pedalLeft' })
      expect(resolveKey(press('ArrowLeft'), {}, false)).toMatchObject({ action: 'restart' })
      expect(resolveKey(press('Home'), {}, false)).toMatchObject({ action: 'fromTop' })
      expect(
        resolveKey({ key: 'ArrowRight', code: 'ArrowRight', shiftKey: true }, {}, false),
      ).toMatchObject({ action: 'loopForward' })
      // A learned key is a pedal: it keeps working, even a character.
      expect(resolveKey(press('b'), { clean: 'b' }, false)).toMatchObject({
        action: 'clean',
        learned: true,
      })
    })
  })
})
