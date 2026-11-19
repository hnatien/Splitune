import { describe, expect, it } from 'vitest'
import { actionFor, ignoredTarget, keysFor, learn, readLearnedKeys, resolveKey } from './keymap'

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
  it('maps the default keys and pedal keys of 12 §8', () => {
    expect(actionFor(' ', {})).toBe('playPause')
    expect(actionFor('PageDown', {})).toBe('next')
    expect(actionFor('PageUp', {})).toBe('restart')
    expect(actionFor('C', {})).toBe('clean')
    expect(actionFor(',', {})).toBe('slower')
    expect(actionFor('.', {})).toBe('faster')
    expect(actionFor('J', {})).toBe('nextUnsure')
    expect(actionFor('k', {})).toBe('previousUnsure')
    expect(actionFor('e', {})).toBe('fixBar')
    expect(actionFor('x', {})).toBeUndefined()
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

    it('makes single keys inert when they are switched off, and keeps the rest', () => {
      for (const key of ['c', 'n', 'l', 'm', 'j', 'k', 'e', ',', '.', '[', ']', 'p']) {
        expect(resolveKey(press(key), {}, false)).toEqual({ kind: 'none' })
        expect(resolveKey(press(key), {}, true).kind).toBe('action')
      }
      // Pedal keys aren't character keys.
      expect(resolveKey(press(' '), {}, false)).toMatchObject({ action: 'playPause' })
      expect(resolveKey(press('PageDown'), {}, false)).toMatchObject({ action: 'next' })
      expect(resolveKey(press('ArrowLeft'), {}, false)).toMatchObject({ action: 'restart' })
      // A learned key is a pedal: it keeps working, even a character.
      expect(resolveKey(press('b'), { clean: 'b' }, false)).toMatchObject({
        action: 'clean',
        learned: true,
      })
    })
  })
})
