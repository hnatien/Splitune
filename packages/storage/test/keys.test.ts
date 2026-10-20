import { describe, expect, it } from 'vitest'
import {
  analysisPrefix,
  artefactKey,
  assertOwnedKey,
  assertSafeKey,
  rawUploadKey,
  recordingKey,
  renderKey,
  StorageKeyError,
  stemKey,
  uploadPrefix,
  userPrefix,
} from '../src/index.ts'

const user = 'Zk3YbQ9xWm2LpT4c'
const id = '0192f0a4-7c2e-7b1d-9a5e-3f6c8d2e1b40'

describe('key builders', () => {
  it('build the documented layout under u/{user_id}/', () => {
    expect(userPrefix(user)).toBe(`u/${user}/`)
    expect(uploadPrefix(user, id)).toBe(`u/${user}/raw/${id}/`)
    expect(analysisPrefix(user, id)).toBe(`u/${user}/a/${id}/`)
    expect(artefactKey(user, id, 1, 'beats.json')).toBe(`u/${user}/a/${id}/v1/beats.json`)
    expect(artefactKey(user, id, 2, 'notes.guitar.json')).toBe(
      `u/${user}/a/${id}/v2/notes.guitar.json`,
    )
    expect(stemKey(user, id, 1, 'guitar', 'm4a')).toBe(`u/${user}/a/${id}/v1/stems/guitar.m4a`)
    expect(stemKey(user, id, 1, 'minus_guitar', 'webm')).toBe(
      `u/${user}/a/${id}/v1/stems/minus_guitar.webm`,
    )
    expect(renderKey(user, id, 1, 'bass')).toBe(`u/${user}/a/${id}/v1/render/bass.alphatex`)
    expect(recordingKey(user, id)).toBe(`u/${user}/rec/${id}.webm`)
  })

  it('keep only a sanitised extension of the original file name', () => {
    expect(rawUploadKey(user, id, 'Artist - My Song (Live).MP3')).toBe(
      `u/${user}/raw/${id}/source.mp3`,
    )
    expect(rawUploadKey(user, id, '../../etc/passwd')).toBe(`u/${user}/raw/${id}/source.bin`)
    expect(rawUploadKey(user, id, 'noext')).toBe(`u/${user}/raw/${id}/source.bin`)
    expect(rawUploadKey(user, id, '.hidden')).toBe(`u/${user}/raw/${id}/source.bin`)
    expect(rawUploadKey(user, id, 'a.mp3/../x')).toBe(`u/${user}/raw/${id}/source.bin`)
  })

  it.each([
    () => userPrefix(''),
    () => userPrefix('a/b'),
    () => userPrefix('..'),
    () => userPrefix('x'.repeat(129)),
    () => uploadPrefix(user, 'not-a-uuid'),
    () => uploadPrefix(user, id.toUpperCase()),
    () => analysisPrefix(user, `${id}/..`),
    () => artefactKey(user, id, 0, 'beats.json'),
    () => artefactKey(user, id, 1.5, 'beats.json'),
    () => artefactKey(user, id, 1, '../beats.json'),
    () => artefactKey(user, id, 1, 'notes.kazoo.json'),
    () => stemKey(user, id, 1, '../guitar', 'm4a'),
    () => stemKey(user, id, 1, 'guitar', 'mp3' as 'm4a'),
    () => renderKey(user, id, 1, 'kazoo'),
    () => recordingKey(user, 'x'),
  ])('reject invalid segments (%#)', (build) => {
    expect(build).toThrow(StorageKeyError)
  })
})

describe('assertOwnedKey', () => {
  it('accepts keys inside the user prefix', () => {
    const key = artefactKey(user, id, 1, 'beats.json')
    expect(assertOwnedKey(user, key)).toBe(key)
  })

  it.each([
    `u/someone-else/a/${id}/v1/beats.json`,
    `u/${user}x/a/${id}/v1/beats.json`,
    `u/${user}/../other/a.json`,
    `u/${user}/./a.json`,
    `/u/${user}/a.json`,
    `u/${user}//a.json`,
    `examples/${id}/beats.json`,
    `u/${user}`,
    '',
  ])('rejects a foreign or unsafe key: %s', (key) => {
    expect(() => assertOwnedKey(user, key)).toThrow(StorageKeyError)
  })

  it('rejects non-ASCII and over-long keys', () => {
    expect(() => assertSafeKey(`u/${user}/é.json`)).toThrow(StorageKeyError)
    expect(() => assertSafeKey(`u/${user}/${'a'.repeat(1024)}`)).toThrow(StorageKeyError)
  })
})
