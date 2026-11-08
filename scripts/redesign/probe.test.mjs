import { describe, expect, it } from 'vitest'
import { emulation } from './harness.mjs'
import { themedUrl } from './probe.mjs'

const story = 'http://localhost:6006/iframe.html?id=base-button--primary&viewMode=story'

describe('themedUrl', () => {
  it('sets the Storybook appearance global for the look', () => {
    const url = new URL(themedUrl(story, 'night'))
    expect(url.searchParams.get('globals')).toBe('appearance:dark;motion:reduce')
    expect(url.searchParams.get('id')).toBe('base-button--primary')
    expect(new URL(themedUrl(story, 'daylight', 'full')).searchParams.get('globals')).toBe(
      'appearance:light;motion:full',
    )
  })

  it('keeps other globals and accepts a matching pin', () => {
    const url = themedUrl(`${story}&globals=distance:floor;appearance:dark`, 'night')
    expect(new URL(url).searchParams.get('globals')).toBe(
      'distance:floor;appearance:dark;motion:reduce',
    )
  })

  it('rejects a URL that pins another appearance', () => {
    expect(() => themedUrl(`${story}&globals=appearance:light`, 'night')).toThrow(
      'URL sets globals appearance:light but --look night needs dark',
    )
  })

  it('rejects a URL that pins another motion setting', () => {
    expect(() => themedUrl(`${story}&globals=motion:full`, 'night', 'reduce')).toThrow(
      'URL sets globals motion:full but --motion reduce needs reduce',
    )
  })

  it('leaves app URLs alone (the stored display choice themes them)', () => {
    expect(themedUrl('http://localhost:3000/library', 'night')).toBe(
      'http://localhost:3000/library',
    )
  })
})

describe('emulation', () => {
  it('matches the colour scheme to the look and emulates touch on request', () => {
    expect(emulation({ look: 'daylight' })).toEqual({
      colorScheme: 'light',
      reducedMotion: 'reduce',
      hasTouch: false,
      isMobile: false,
    })
    expect(emulation({ look: 'night', touch: true, motion: 'full' })).toEqual({
      colorScheme: 'dark',
      reducedMotion: 'no-preference',
      hasTouch: true,
      isMobile: true,
    })
  })

  it('rejects an unknown motion setting', () => {
    expect(() => emulation({ look: 'night', motion: 'slow' })).toThrow('unknown motion slow')
  })
})
