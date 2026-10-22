import { AnalyticsEvent } from '@splitune/contracts'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createTracker, type Event, VERSION } from './index.ts'

describe('createTracker', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('batches events and sends them after the delay, in order', async () => {
    const sent: Event[][] = []
    const tracker = createTracker({ send: async (events) => void sent.push(events), delayMs: 500 })
    tracker.track('example_song_opened', { example_id: 'ill-fate' })
    tracker.track('first_isolated_playback', { ms_since_song_selected: 1200, source: 'example' })
    expect(sent).toEqual([])
    await vi.advanceTimersByTimeAsync(500)
    expect(sent).toHaveLength(1)
    expect(sent[0]?.map((e) => e.name)).toEqual(['example_song_opened', 'first_isolated_playback'])
    for (const event of sent[0] ?? []) expect(AnalyticsEvent.safeParse(event).success).toBe(true)
  })

  it('sends at most 20 events per request', async () => {
    const sizes: number[] = []
    const tracker = createTracker({ send: async (events) => void sizes.push(events.length) })
    for (let i = 0; i < 25; i++) tracker.track('example_song_opened', { example_id: 'a' })
    await tracker.flush()
    expect(sizes).toEqual([20, 5])
  })

  it('drops a batch the API refuses and keeps tracking', async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const tracker = createTracker({ send })
    tracker.track('example_song_opened', { example_id: 'a' })
    await tracker.flush()
    tracker.track('example_song_opened', { example_id: 'b' })
    await tracker.flush()
    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[1]?.[0]).toEqual([
      { name: 'example_song_opened', props: { example_id: 'b' } },
    ])
  })
})

describe('package scaffold', () => {
  it('exports a semver version constant', () => {
    expect(VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
})
