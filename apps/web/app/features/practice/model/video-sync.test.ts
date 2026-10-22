import { describe, expect, it } from 'vitest'
import { correctVideo } from './video-sync'

describe('video sync', () => {
  it('follows the engine rate when in sync', () => {
    expect(correctVideo(10, 10.01, 0.7)).toEqual({ playbackRate: 0.7 })
  })

  it('nudges small drift by 2 % towards the audio', () => {
    expect(correctVideo(10, 10.05, 1).playbackRate).toBeCloseTo(0.98)
    expect(correctVideo(10, 9.95, 0.5).playbackRate).toBeCloseTo(0.51)
  })

  it('re-seeks on a loop wrap and on drift over 80 ms', () => {
    expect(correctVideo(5.3, 10.1, 1, true)).toEqual({ seek: 5.3, playbackRate: 1 })
    expect(correctVideo(10, 10.2, 1)).toEqual({ seek: 10, playbackRate: 1 })
  })
})
