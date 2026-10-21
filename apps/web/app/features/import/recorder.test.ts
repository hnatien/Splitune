import { describe, expect, it } from 'vitest'
import { recordingExtension, recordingMimeType } from './recorder'

describe('recording MIME type', () => {
  it('takes the first type the browser supports', () => {
    expect(recordingMimeType(() => true)).toBe('audio/webm;codecs=opus')
    expect(recordingMimeType((t) => t.startsWith('audio/mp4'))).toBe('audio/mp4;codecs=mp4a.40.2')
    expect(recordingMimeType(() => false)).toBeUndefined()
  })

  it('names the file after the container', () => {
    expect(recordingExtension('audio/mp4;codecs=mp4a.40.2')).toBe('m4a')
    expect(recordingExtension('audio/webm;codecs=opus')).toBe('webm')
    expect(recordingExtension('audio/ogg;codecs=opus')).toBe('ogg')
  })
})
