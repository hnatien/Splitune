import { describe, expect, it } from 'vitest'
import { actionFor, ignoredTarget, keysFor, learn, readLearnedKeys } from './keymap'

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
    expect(actionFor('ArrowUp', {})).toBe('faster')
    expect(actionFor('x', {})).toBeUndefined()
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
})
