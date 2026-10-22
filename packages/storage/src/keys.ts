// Object key layout of 03-data-model-and-storage.md "Object storage layout". Every user object
// lives under u/{user_id}/; builders validate each segment and throw rather than build a key that
// could escape that prefix. Keys never contain titles, emails or original file names (17 §3):
// raw uploads keep only a sanitised extension.

export class StorageKeyError extends Error {
  override name = 'StorageKeyError'
}

const USER_ID = /^[A-Za-z0-9_-]{1,128}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const STEM_ID = /^[a-z0-9][a-z0-9_.-]{0,63}$/
const SAFE_KEY = /^[A-Za-z0-9_.-]+(\/[A-Za-z0-9_.-]+)*\/?$/
const EXTENSION = /^[a-z0-9]{1,8}$/

function check(value: string, pattern: RegExp, what: string): string {
  if (!pattern.test(value)) throw new StorageKeyError(`invalid ${what}`)
  return value
}

const ARTEFACT_FILES = new Set([
  'manifest.json',
  'probe.json',
  'beats.json',
  'tags.json',
  'separation.json',
  'presence.json',
  'stems.json',
  'sections.json',
  'chords.json',
  'summary.json',
])
const PER_INSTRUMENT = /^(notes|tab)\.(guitar|bass|piano|drums|vocals|other)\.json$/
const INSTRUMENT = /^(guitar|bass|piano|drums|vocals|other)$/

// Rejects empty, absolute, traversing ('.'/'..' segments), doubled-slash and non-ASCII keys.
export function assertSafeKey(key: string): string {
  if (key.length > 1024 || !SAFE_KEY.test(key)) throw new StorageKeyError('invalid object key')
  if (key.split('/').some((segment) => segment === '.' || segment === '..')) {
    throw new StorageKeyError('invalid object key')
  }
  return key
}

export const userPrefix = (userId: string) => `u/${check(userId, USER_ID, 'user id')}/`

// Throws unless `key` is a safe key inside `userId`'s prefix, e.g. a key sent back by a client.
export function assertOwnedKey(userId: string, key: string): string {
  assertSafeKey(key)
  if (!key.startsWith(userPrefix(userId))) throw new StorageKeyError('key outside user prefix')
  return key
}

export const uploadPrefix = (userId: string, uploadId: string) =>
  `${userPrefix(userId)}raw/${check(uploadId, UUID, 'upload id')}/`

export function rawUploadKey(userId: string, uploadId: string, originalFilename: string): string {
  const dot = originalFilename.lastIndexOf('.')
  const ext = dot > 0 ? originalFilename.slice(dot + 1).toLowerCase() : ''
  return `${uploadPrefix(userId, uploadId)}source.${EXTENSION.test(ext) ? ext : 'bin'}`
}

// URL import (25 §4): the muted video ≤720p next to the downloaded audio of the same import.
export const rawVideoKey = (userId: string, importId: string) =>
  `${uploadPrefix(userId, importId)}video.mp4`

export const analysisPrefix = (userId: string, analysisId: string) =>
  `${userPrefix(userId)}a/${check(analysisId, UUID, 'analysis id')}/`

function versionPrefix(userId: string, analysisId: string, version: number): string {
  if (!Number.isInteger(version) || version < 1) throw new StorageKeyError('invalid version')
  return `${analysisPrefix(userId, analysisId)}v${version}/`
}

// `file` is one of the analysis JSON documents, e.g. beats.json or notes.guitar.json.
export function artefactKey(userId: string, analysisId: string, version: number, file: string) {
  if (!ARTEFACT_FILES.has(file) && !PER_INSTRUMENT.test(file)) {
    throw new StorageKeyError('invalid artefact file')
  }
  return `${versionPrefix(userId, analysisId, version)}${file}`
}

// AAC-LC in MP4 (.m4a) is the default; Opus in WebM is the optional variant.
export function stemKey(
  userId: string,
  analysisId: string,
  version: number,
  stemId: string,
  format: 'm4a' | 'webm',
) {
  if (format !== 'm4a' && format !== 'webm') throw new StorageKeyError('invalid stem format')
  return `${versionPrefix(userId, analysisId, version)}stems/${check(stemId, STEM_ID, 'stem id')}.${format}`
}

export const renderKey = (
  userId: string,
  analysisId: string,
  version: number,
  instrument: string,
) =>
  `${versionPrefix(userId, analysisId, version)}render/${check(instrument, INSTRUMENT, 'instrument')}.alphatex`

// "Download my data" bundles (15 §4), removed by the lifecycle sweeper once they expire.
export const exportKey = (userId: string, exportId: string) =>
  `${userPrefix(userId)}exports/${check(exportId, UUID, 'export id')}.json`

// The audio files of a stems artefact sit beside its JSON: …/v{n}/stems.json → …/v{n}/stems/.
export function stemFilesPrefix(stemsJsonKey: string): string {
  assertSafeKey(stemsJsonKey)
  if (!/^u\/[A-Za-z0-9_-]+\/a\/[0-9a-f-]{36}\/v\d+\/stems\.json$/.test(stemsJsonKey)) {
    throw new StorageKeyError('not a stems.json key')
  }
  return `${stemsJsonKey.slice(0, -'.json'.length)}/`
}

// Example songs (13 §1): Splitune-owned analyses, shared by every visitor and every claimed copy.
// Each build gets its own prefix, so cached files never change under a URL.
const EXAMPLE_ID = /^[a-z0-9][a-z0-9-]{0,62}$/
const EXAMPLE_BUILD = /^\d{8}T\d{6}Z$/
const EXAMPLE_PATH = /^[a-z0-9][a-z0-9_.-]{0,63}(\/[a-z0-9][a-z0-9_.-]{0,63})?$/

export const EXAMPLES_PREFIX = 'assets/examples/'

export const examplePrefix = (exampleId: string, build: string) =>
  `${EXAMPLES_PREFIX}${check(exampleId, EXAMPLE_ID, 'example id')}/${check(build, EXAMPLE_BUILD, 'example build')}/`

// `path` is relative to the build: an analysis document (beats.json) or a stem (stems/guitar.m4a).
export function exampleKey(exampleId: string, build: string, path: string): string {
  return assertSafeKey(
    `${examplePrefix(exampleId, build)}${check(path, EXAMPLE_PATH, 'example path')}`,
  )
}

// Throws unless `key` is a safe key inside `prefix` (a user's or an example build's).
export function assertWithin(prefix: string, key: string): string {
  assertSafeKey(key)
  if (!key.startsWith(prefix)) throw new StorageKeyError('key outside prefix')
  return key
}

export const recordingKey = (userId: string, recordingId: string) =>
  `${userPrefix(userId)}rec/${check(recordingId, UUID, 'recording id')}.webm`
