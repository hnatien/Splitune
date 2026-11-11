import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PRACTICE,
  FOLLOW_MODES,
  PIANO_HANDS,
  PLAYHEAD_STYLES,
  rewriteStage,
  sanitizePractice,
} from './display-store'

describe('the stage → dark rewrite (26 §2)', () => {
  it('keeps stage when a patch only puts back what was stored (Skip in onboarding)', () => {
    expect(
      rewriteStage({ appearance: 'stage' }, { distance: undefined, calibration: 1 }, 'stand'),
    ).toEqual({ distance: undefined, calibration: 1 })
    expect(
      rewriteStage({ appearance: 'stage', distance: 'floor' }, { distance: 'floor' }, 'stand'),
    ).toEqual({ distance: 'floor' })
    expect(rewriteStage({ appearance: 'stage' }, { appearance: 'stage' }, 'stand')).toEqual({
      appearance: 'stage',
    })
  })

  it('leaves a stored dark, light or system appearance alone', () => {
    expect(rewriteStage({ appearance: 'dark' }, { distance: 'floor' }, 'desk')).toEqual({
      distance: 'floor',
    })
    expect(rewriteStage({ appearance: 'light' }, { appearance: 'system' }, 'desk')).toEqual({
      appearance: 'system',
    })
  })

  it('stores dark and the distance shown on the next appearance or distance change', () => {
    // Choosing Night Rehearsal keeps the distance `stage` resolved to.
    expect(rewriteStage({ appearance: 'stage' }, { appearance: 'dark' }, 'stand')).toEqual({
      appearance: 'dark',
      distance: 'stand',
    })
    // Choosing Daylight stores Daylight, still with the distance shown.
    expect(
      rewriteStage({ appearance: 'stage', distance: 'floor' }, { appearance: 'light' }, 'stand'),
    ).toEqual({ appearance: 'light', distance: 'floor' })
    // Choosing a distance stores it with Night Rehearsal.
    expect(rewriteStage({ appearance: 'stage' }, { distance: 'desk' }, 'stand')).toEqual({
      appearance: 'dark',
      distance: 'desk',
    })
    // Automatic is a choice too.
    expect(
      rewriteStage({ appearance: 'stage', distance: 'floor' }, { distance: undefined }, 'stand'),
    ).toEqual({ appearance: 'dark', distance: undefined })
  })

  it('keeps stage through changes to anything else', () => {
    expect(rewriteStage({ appearance: 'stage' }, { contrast: 'more' }, 'stand')).toEqual({
      contrast: 'more',
    })
    expect(rewriteStage({ appearance: 'stage' }, { appearance: 'stage' }, 'stand')).toEqual({
      appearance: 'stage',
    })
  })
})

describe('stored practice defaults from earlier shapes', () => {
  it('keeps every value today’s controls can show', () => {
    expect(sanitizePractice(DEFAULT_PRACTICE)).toEqual(DEFAULT_PRACTICE)
    for (const notationLayout of FOLLOW_MODES) {
      expect(sanitizePractice({ notationLayout })).toEqual({ notationLayout })
    }
    for (const playhead of PLAYHEAD_STYLES) {
      expect(sanitizePractice({ playhead })).toEqual({ playhead })
    }
    for (const pianoHands of PIANO_HANDS) {
      expect(sanitizePractice({ pianoHands })).toEqual({ pianoHands })
    }
  })

  it('migrates the shape stored before s35 (no playhead, Page / Scrolling, Both / Right)', () => {
    const before = {
      speedPct: 70,
      countInBars: 2,
      restBetween: 'beat',
      showUncertainty: false,
      passPrompt: true,
      notationLayout: 'scroll',
      soundDelayMs: 40,
      volumePct: 80,
      pianoVoicing: 'root',
      pianoHands: 'right',
      melodyLabels: 'degrees',
      melodyWindow: 'whole',
    }
    expect({ ...DEFAULT_PRACTICE, ...sanitizePractice(before) }).toEqual({
      ...before,
      playhead: 'line',
    })
  })

  it('drops unknown keys and values no control offers, and clamps numbers', () => {
    expect(
      sanitizePractice({
        notationLayout: 'continuous',
        playhead: 'glow',
        pianoHands: 'none',
        score: 'paper',
        speedPct: 400,
        soundDelayMs: -900,
        volumePct: Number.NaN,
        showUncertainty: 'yes',
      }),
    ).toEqual({ speedPct: 110, soundDelayMs: -150 })
    expect(sanitizePractice(null)).toEqual({})
    expect(sanitizePractice('page')).toEqual({})
  })
})
