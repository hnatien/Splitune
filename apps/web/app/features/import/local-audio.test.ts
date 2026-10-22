import { describe, expect, it, vi } from 'vitest'
import type { AudioStats } from './audio-stats'
import { decodeLocally, type LocalAudio } from './local-audio'

// The local decode chain (13 §2, 24 §3): Mediabunny over WebCodecs first, the browser's
// decodeAudioData where Mediabunny can't decode, "Preview after upload" when neither can.

const stats = { durationS: 3 } as AudioStats
const decoded: LocalAudio = { kind: 'decoded', stats }
const file = (name: string, type = '') => new File([new Uint8Array(4)], name, { type })
const none = async () => undefined

describe('decodeLocally', () => {
  it('uses Mediabunny when it decodes, without touching decodeAudioData', async () => {
    const webAudio = vi.fn(none)
    expect(await decodeLocally(file('a.m4a'), { demux: async () => decoded, webAudio })).toBe(
      decoded,
    )
    expect(webAudio).not.toHaveBeenCalled()
  })

  it('falls back to decodeAudioData when the codec has no WebCodecs decoder', async () => {
    const result = await decodeLocally(file('a.m4a', 'audio/mp4'), {
      demux: async () => ({ kind: 'needs_upload', durationS: 3 }),
      webAudio: async () => decoded,
    })
    expect(result).toBe(decoded)
  })

  it('falls back to decodeAudioData when Mediabunny fails or reads no container', async () => {
    const failing = async () => Promise.reject(new Error('demux failed'))
    expect(
      await decodeLocally(file('a.mp3'), { demux: failing, webAudio: async () => decoded }),
    ).toBe(decoded)
    expect(await decodeLocally(file('a.mp3'), { demux: none, webAudio: async () => decoded })).toBe(
      decoded,
    )
  })

  it('keeps the demuxed duration when neither path decodes', async () => {
    expect(
      await decodeLocally(file('clip.mov', 'video/quicktime'), {
        demux: async () => ({ kind: 'needs_upload', durationS: 42 }),
        webAudio: none,
      }),
    ).toEqual({ kind: 'needs_upload', durationS: 42 })
  })

  it('waits for the server for media it can read nothing of, and rejects everything else', async () => {
    expect(await decodeLocally(file('take.aiff'), { demux: none, webAudio: none })).toEqual({
      kind: 'needs_upload',
    })
    expect(
      await decodeLocally(file('notes.txt', 'text/plain'), { demux: none, webAudio: none }),
    ).toEqual({ kind: 'unreadable' })
  })

  it('reports a container without an audio track as unreadable at once', async () => {
    const webAudio = vi.fn(none)
    expect(
      await decodeLocally(file('silent.mp4', 'video/mp4'), {
        demux: async () => ({ kind: 'unreadable' }),
        webAudio,
      }),
    ).toEqual({ kind: 'unreadable' })
    expect(webAudio).not.toHaveBeenCalled()
  })
})
