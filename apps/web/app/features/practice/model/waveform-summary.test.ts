import { describe, expect, it } from 'vitest'
import { WAVEFORM_SLICES, waveformSummary } from './waveform-summary'

describe('waveformSummary', () => {
  it('gives 96 levels, each a share of the loudest slice', () => {
    // A quiet first half and a full second half, 10 blocks per slice.
    const rms = new Float32Array(WAVEFORM_SLICES * 10).map((_, block) =>
      block < (WAVEFORM_SLICES * 10) / 2 ? 0.1 : 0.4,
    )
    const levels = waveformSummary(rms)
    expect(levels).toHaveLength(WAVEFORM_SLICES)
    expect(levels?.[0]).toBe(25)
    expect(levels?.at(-1)).toBe(100)
  })

  it('still fills every slice for audio shorter than the slices', () => {
    const levels = waveformSummary(new Float32Array([0.2, 0.4]))
    expect(levels).toHaveLength(WAVEFORM_SLICES)
    expect(levels?.[0]).toBe(50)
    expect(levels?.at(-1)).toBe(100)
  })

  it('has nothing to show for silence or no audio', () => {
    expect(waveformSummary(new Float32Array(500))).toBeNull()
    expect(waveformSummary(new Float32Array(0))).toBeNull()
  })
})
