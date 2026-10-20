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

export const recordingKey = (userId: string, recordingId: string) =>
  `${userPrefix(userId)}rec/${check(recordingId, UUID, 'recording id')}.webm`
