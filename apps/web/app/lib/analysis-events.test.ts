import { describe, expect, it } from 'vitest'
import { applyEvent, liveStateOf, type ScopedLiveState } from './analysis-events'

const at = '2026-10-24T10:00:00.000Z'
const idle: ScopedLiveState = {
  analysisId: undefined,
  live: { waitingFor: undefined, failures: [], lastEvent: undefined },
}

describe('analysis live state', () => {
  it('keeps one failure per stage, the latest', () => {
    let state = applyEvent(idle, 'a', {
      type: 'stage.failed',
      stage: 'chords',
      error_code: 'chords_unavailable',
      at,
    })
    state = applyEvent(state, 'a', {
      type: 'stage.failed',
      stage: 'separate',
      error_code: 'stems_unavailable',
      fallback: 'stems_unavailable',
      at,
    })
    state = applyEvent(state, 'a', {
      type: 'stage.failed',
      stage: 'chords',
      error_code: 'internal_error',
      at,
    })
    expect(liveStateOf(state, 'a').failures).toEqual([
      { stage: 'separate', errorCode: 'stems_unavailable', fallback: 'stems_unavailable' },
      { stage: 'chords', errorCode: 'internal_error' },
    ])
  })

  it("doesn't carry a run's failures over to its re-run", () => {
    const first = applyEvent(idle, 'a', {
      type: 'stage.failed',
      stage: 'separate',
      error_code: 'stems_unavailable',
      fallback: 'stems_unavailable',
      at,
    })
    expect(liveStateOf(first, 'b').failures).toEqual([])
    const rerun = applyEvent(first, 'b', { type: 'stage.started', stage: 'separate', at })
    expect(liveStateOf(rerun, 'b').failures).toEqual([])
  })
})
