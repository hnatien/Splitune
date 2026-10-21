import { describe, expect, it } from 'vitest'
import { applyDisplay, DISPLAY_SCRIPT, DISPLAY_STORAGE_KEY, readStoredDisplay } from './display.ts'

function fakeRoot() {
  const attributes = new Map<string, string>()
  const classes = new Set<string>()
  const style = new Map<string, string>()
  return {
    attributes,
    classes,
    style,
    root: {
      setAttribute: (name: string, value: string) => attributes.set(name, value),
      classList: {
        toggle: (name: string, on: boolean) => (on ? classes.add(name) : classes.delete(name)),
      },
      style: { setProperty: (name: string, value: string) => style.set(name, value) },
    } as unknown as HTMLElement,
  }
}

const mediaWith =
  (...matching: string[]) =>
  (query: string) => ({ matches: matching.includes(query) })

describe('applyDisplay', () => {
  it('follows the OS for System choices', () => {
    const { root, attributes, classes } = fakeRoot()
    const resolved = applyDisplay(
      {},
      root,
      mediaWith(
        '(prefers-color-scheme: dark)',
        '(prefers-contrast: more)',
        '(prefers-reduced-motion: reduce)',
      ),
    )
    expect(resolved).toEqual({
      appearance: 'dark',
      contrast: 'more',
      distance: 'desk',
      readingFont: 'inter',
      motion: 'reduce',
      calibration: 1,
      score: 'paper',
    })
    expect(Object.fromEntries(attributes)).toEqual({
      'data-appearance': 'dark',
      'data-contrast': 'more',
      'data-motion': 'reduce',
      'data-distance': 'desk',
      'data-reading-font': 'inter',
      'data-score': 'paper',
    })
    expect(classes.has('dark')).toBe(true)
  })

  it('keeps the score on paper unless the user asks it to match the appearance', () => {
    const score = (value: unknown) => {
      const { root, attributes } = fakeRoot()
      applyDisplay({ score: value as 'paper' }, root, mediaWith())
      return attributes.get('data-score')
    }
    expect(score('match')).toBe('match')
    expect(score('paper')).toBe('paper')
    expect(score('junk')).toBe('paper')
  })

  it('a stored choice beats the OS, and Stage keeps the dark class for shadcn', () => {
    const { root, attributes, classes } = fakeRoot()
    applyDisplay(
      { appearance: 'stage', contrast: 'normal' },
      root,
      mediaWith('(prefers-contrast: more)'),
    )
    expect(attributes.get('data-appearance')).toBe('stage')
    expect(attributes.get('data-contrast')).toBe('normal')
    expect(classes.has('dark')).toBe(true)
    applyDisplay({ appearance: 'light' }, root, mediaWith('(prefers-color-scheme: dark)'))
    expect(classes.has('dark')).toBe(false)
  })

  it('derives the distance preset from the pointer and screen', () => {
    const distance = (...media: string[]) =>
      applyDisplay({}, fakeRoot().root, mediaWith(...media)).distance
    expect(distance()).toBe('desk')
    expect(distance('(pointer: coarse)')).toBe('stand')
    expect(distance('(pointer: coarse)', '(max-width: 640px)')).toBe('floor')
  })

  it('clamps calibration to −20 % … +40 % and ignores junk', () => {
    const calibration = (value: unknown) => {
      const { root, style } = fakeRoot()
      applyDisplay({ calibration: value as number }, root, mediaWith())
      return style.get('--read-calibration')
    }
    expect(calibration(1.2)).toBe('1.2')
    expect(calibration(3)).toBe('1.4')
    expect(calibration(0.1)).toBe('0.8')
    expect(calibration('nope')).toBe('1')
  })
})

describe('readStoredDisplay', () => {
  it('returns defaults for missing, malformed or non-object values', () => {
    const storage = (value: string | null) => ({ getItem: () => value })
    expect(readStoredDisplay(storage(null))).toEqual({})
    expect(readStoredDisplay(storage('{oops'))).toEqual({})
    expect(readStoredDisplay(storage('42'))).toEqual({})
    expect(readStoredDisplay(storage('{"appearance":"stage"}'))).toEqual({ appearance: 'stage' })
  })
})

describe('DISPLAY_SCRIPT', () => {
  const run = (stored: string | null, throwing = false) => {
    const { root, attributes } = fakeRoot()
    const localStorage = {
      getItem: (key: string) => {
        if (throwing) throw new Error('blocked')
        return key === DISPLAY_STORAGE_KEY ? stored : null
      },
    }
    const window = { matchMedia: mediaWith('(prefers-color-scheme: dark)') }
    new Function('localStorage', 'document', 'window', DISPLAY_SCRIPT)(
      localStorage,
      { documentElement: root },
      window,
    )
    return attributes.get('data-appearance')
  }

  it('applies the stored appearance before first paint', () => {
    expect(run('{"appearance":"stage"}')).toBe('stage')
  })

  it('falls back to the OS when storage is empty, corrupt or blocked', () => {
    expect(run(null)).toBe('dark')
    expect(run('not json')).toBe('dark')
    expect(run(null, true)).toBe('dark')
  })
})
