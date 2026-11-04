import { describe, expect, it } from 'vitest'
import { type AudioSourceInput, audioSourceKey } from './audio-source'

const key = (input: Partial<AudioSourceInput>) =>
  audioSourceKey({
    holding: false,
    stemsId: undefined,
    local: false,
    sourceKind: 'upload',
    download: undefined,
    analysed: true,
    ...input,
  })

describe('audioSourceKey', () => {
  it('prefers the stems, then this page’s file, then the song’s audio', () => {
    expect(key({ stemsId: 'st1', local: true })).toBe('stems:st1')
    expect(key({ local: true })).toBe('local')
    expect(key({})).toBe('source')
  })

  it('loads nothing while the screen holds for the notes', () => {
    expect(key({ holding: true, stemsId: 'st1' })).toBe('')
  })

  it('waits for an upload’s analysis and a link’s download', () => {
    expect(key({ analysed: false })).toBe('')
    expect(key({ sourceKind: 'url', analysed: true })).toBe('')
    expect(key({ sourceKind: 'url', download: 'running' })).toBe('')
    expect(key({ sourceKind: 'url', download: 'done' })).toBe('source')
    expect(key({ sourceKind: 'url', download: 'fallback' })).toBe('source')
  })

  it('never loads an example song’s own audio: it only has stems', () => {
    expect(key({ sourceKind: 'example' })).toBe('')
    expect(key({ sourceKind: 'example', stemsId: 'st1' })).toBe('stems:st1')
  })
})
