import { describe, expect, it } from 'vitest'
import {
  analysisPrefix,
  artefactKey,
  assertOwnedKey,
  assertSafeKey,
  assertWithin,
  exampleKey,
  examplePrefix,
  exportKey,
  rawUploadKey,
  recordingKey,
  renderKey,
  StorageKeyError,
  stemFilesPrefix,
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
    expect(artefactKey(user, id, 1, 'probe.json')).toBe(`u/${user}/a/${id}/v1/probe.json`)
    expect(artefactKey(user, id, 1, 'tags.json')).toBe(`u/${user}/a/${id}/v1/tags.json`)
    expect(artefactKey(user, id, 1, 'separation.json')).toBe(`u/${user}/a/${id}/v1/separation.json`)
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

describe('lifecycle keys', () => {
  it('builds export bundle keys and the stem files beside a stems.json', () => {
    expect(exportKey(user, id)).toBe(`u/${user}/exports/${id}.json`)
    expect(stemFilesPrefix(artefactKey(user, id, 3, 'stems.json'))).toBe(
      `u/${user}/a/${id}/v3/stems/`,
    )
    expect(() => exportKey(user, 'not-a-uuid')).toThrow(StorageKeyError)
    for (const key of [
      artefactKey(user, id, 1, 'beats.json'),
      'assets/examples/riff/20261022T090536Z/stems.json',
      `u/${user}/a/${id}/v1/../stems.json`,
    ]) {
      expect(() => stemFilesPrefix(key), key).toThrow(StorageKeyError)
    }
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

describe('example keys', () => {
  const build = '20261022T153000Z'

  it('build assets/examples/{id}/{build}/{path}', () => {
    expect(examplePrefix('ill-fate', build)).toBe(`assets/examples/ill-fate/${build}/`)
    expect(exampleKey('ill-fate', build, 'beats.json')).toBe(
      `assets/examples/ill-fate/${build}/beats.json`,
    )
    expect(exampleKey('ill-fate', build, 'stems/guitar.m4a')).toBe(
      `assets/examples/ill-fate/${build}/stems/guitar.m4a`,
    )
  })

  it.each([
    () => examplePrefix('Ill Fate', build),
    () => examplePrefix('ill-fate', '2026-10-22'),
    () => exampleKey('ill-fate', build, '../beats.json'),
    () => exampleKey('ill-fate', build, 'stems/../../x.json'),
    () => exampleKey('ill-fate', build, 'a/b/c.json'),
    () => exampleKey('ill-fate', build, '/beats.json'),
  ])('reject invalid segments (%#)', (make) => {
    expect(make).toThrow(StorageKeyError)
  })

  it('assertWithin keeps a key inside its prefix', () => {
    const prefix = examplePrefix('ill-fate', build)
    expect(assertWithin(prefix, `${prefix}stems/bass.m4a`)).toBe(`${prefix}stems/bass.m4a`)
    for (const key of [`${prefix}../other/x.json`, `assets/examples/other/${build}/x.json`]) {
      expect(() => assertWithin(prefix, key)).toThrow(StorageKeyError)
    }
  })
})
