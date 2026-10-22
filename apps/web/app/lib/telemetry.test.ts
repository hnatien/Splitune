import { describe, expect, it, vi } from 'vitest'
import { browserFamily, deviceClass, inAppApp, withDevice } from './telemetry'
import { connectTracker, type QueuedEvent, track, trackCorrection } from './track'

describe('telemetry context', () => {
  it('names the engine family for the platform dashboard', () => {
    const chrome =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/152.0.0.0 Safari/537.36'
    const safari =
      'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    const firefox =
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0'
    expect(browserFamily(chrome)).toBe('chromium')
    expect(browserFamily(safari)).toBe('webkit')
    expect(browserFamily(firefox)).toBe('firefox')
    expect(browserFamily('curl/8')).toBe('other')
  })

  it('classes devices by pointer and size', () => {
    expect(deviceClass(() => false)).toBe('desktop')
    expect(deviceClass((q) => q === '(pointer: coarse)')).toBe('tablet')
    expect(deviceClass(() => true)).toBe('phone')
  })

  it('names the app around an in-app browser', () => {
    expect(inAppApp('Mozilla/5.0 (iPhone) Instagram 300.0')).toBe('instagram')
    expect(inAppApp('Mozilla/5.0 [FBAN/FBIOS;FBAV/400.0]')).toBe('facebook')
    expect(inAppApp('Mozilla/5.0 musical_ly_30.0')).toBe('tiktok')
    expect(inAppApp('Mozilla/5.0 LinkedInApp')).toBe('other')
  })

  it('queues events until the sender connects, then sends them in order', () => {
    const sent: QueuedEvent[] = []
    track('speed_changed', { speed_pct: 70, input_mode: 'pedal' })
    trackCorrection('chords', 'set_chord', { model_id: 'btc/sevenths', version: '1.0.0' })
    trackCorrection('notes', 'mark_correct', undefined)
    connectTracker((event) => sent.push(event))
    track('level_changed', { level: 'simplified' })
    expect(sent).toEqual([
      { name: 'speed_changed', props: { speed_pct: 70, input_mode: 'pedal' } },
      {
        name: 'correction_made',
        props: { op: 'set_chord', entity: 'chord', model_ref: 'btc/sevenths@1.0.0' },
      },
      { name: 'level_changed', props: { level: 'simplified' } },
    ])
  })

  it('adds the device context the queued event leaves out', () => {
    vi.stubGlobal('window', { matchMedia: () => ({ matches: false }) })
    const underrun = withDevice({ name: 'audio_underrun', props: { rate: 0.7, preset: 'mid' } })
    expect(Object.keys(underrun.props).sort()).toEqual([
      'browser',
      'device_class',
      'preset',
      'rate',
    ])
    const level = { name: 'level_changed' as const, props: { level: 'roots' } }
    expect(withDevice(level)).toBe(level)
    vi.unstubAllGlobals()
  })
})
