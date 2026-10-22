import type { AnalysisType, Instrument } from '@splitune/contracts'
import type { QueryClient } from '@tanstack/react-query'
import Uppy from '@uppy/core'
import type { Body } from '@uppy/core/utils'
import type { z } from 'zod'
import { client, errorCode, errorData, orpc } from '@/lib/api'
import { reloadMe } from '@/lib/reload-me'
import { track } from '@/lib/track'
import { hashFile } from './hash'
import { keepLocalFile } from './local-files'
import { SplituneUploader, type UploadMeta } from './splitune-uploader'
import { createUploadDb, type PendingUpload } from './upload-db'
import { useUploads } from './upload-store'

// Import a file or recording (13 §2): create the song, start the presigned multipart upload, let
// the caller open practice right away while the upload continues, then request the analysis when
// the last part is in. Uploads interrupted by a reload resume from IndexedDB (resumePendingUploads).

export type ImportRequest = {
  file: File
  fileSha256: string
  title: string
  sourceKind: 'upload' | 'recording'
  instrument: z.infer<typeof Instrument>
  type: z.infer<typeof AnalysisType>
  /** "Import anyway" after the duplicate notice. */
  allowDuplicate?: boolean
}

/** The file picked to resume an upload isn't the one it started with. */
export class DifferentFileError extends Error {}

export class DuplicateSongError extends Error {
  readonly songId: string

  constructor(songId: string) {
    super('duplicate upload')
    this.songId = songId
  }
}

const resumeStore = createUploadDb()
const initialUrls = new Map<string, { n: number; url: string }[]>()
let uppy: Uppy<UploadMeta, Body> | undefined
let queryClient: QueryClient | undefined
const records = new Map<string, PendingUpload>()
// Recordings vs files for product events (16 §2); an upload resumed after a reload counts as a file.
const recordings = new Set<string>()

const bytesBucket = (bytes: number) =>
  bytes < 10e6 ? 'lt_10mb' : bytes < 50e6 ? 'lt_50mb' : bytes < 200e6 ? 'lt_200mb' : 'gte_200mb'

function uploadEvent(record: PendingUpload, name: 'upload_completed' | 'upload_started') {
  const source = recordings.has(record.uploadId) ? 'recording' : 'file'
  track(name, { source, bytes_bucket: bytesBucket(record.bytes) })
}

function uploader(): Uppy<UploadMeta, Body> {
  if (uppy) return uppy
  const instance = new Uppy<UploadMeta, Body>({
    autoProceed: false,
    allowMultipleUploadBatches: true,
  })
  instance.use(SplituneUploader, { api: client, store: resumeStore, initialUrls })
  instance.on('upload-progress', (file, progress) => {
    const record = file && records.get(file.meta.uploadId)
    if (!record) return
    useUploads.getState().patch(record.songId, {
      phase: 'uploading',
      bytesUploaded: progress.bytesUploaded,
      bytesTotal: progress.bytesTotal ?? record.bytes,
    })
  })
  instance.on('upload-success', (file) => {
    const record = file && records.get(file.meta.uploadId)
    if (file) instance.removeFile(file.id)
    if (!record) return
    uploadEvent(record, 'upload_completed')
    void startAnalysis(record)
  })
  instance.on('upload-error', (file, error) => {
    const record = file && records.get(file.meta.uploadId)
    if (file) instance.removeFile(file.id)
    if (!record) return
    const code = errorCode(error) ?? 'upload_failed'
    track('upload_failed', {
      source: recordings.has(record.uploadId) ? 'recording' : 'file',
      bytes_bucket: bytesBucket(record.bytes),
      error_code: code,
    })
    useUploads.getState().patch(record.songId, {
      phase: 'failed',
      errorCode: code,
      errorData: errorData(error),
    })
  })
  uppy = instance
  return instance
}

/** The Query client to refresh once uploads finish (set once from the app root). */
export function connectUploads(client: QueryClient) {
  queryClient = client
}

function transfer(record: PendingUpload, file: File) {
  records.set(record.uploadId, record)
  keepLocalFile(record.songId, file)
  const instance = uploader()
  instance.addFile({
    name: file.name || record.title,
    type: file.type,
    data: file,
    source: record.uploadId,
    meta: { uploadId: record.uploadId, partSize: record.partSize },
  })
  void instance.upload()
}

async function startAnalysis(record: PendingUpload) {
  const store = useUploads.getState()
  store.patch(record.songId, { phase: 'starting_analysis', bytesUploaded: record.bytes })
  try {
    const accepted = await client.analyses.create({
      song_id: record.songId,
      instrument: record.instrument,
      type: record.type,
    })
    store.patch(record.songId, { phase: 'done', analysisId: accepted.analysis_id })
    await resumeStore.delete(record.uploadId).catch(() => undefined)
    records.delete(record.uploadId)
  } catch (error) {
    store.patch(record.songId, {
      phase: 'failed',
      errorCode: errorCode(error) ?? 'analysis_request_failed',
      errorData: errorData(error),
    })
  }
  await queryClient?.invalidateQueries({
    queryKey: orpc.songs.get.queryKey({ input: { id: record.songId } }),
  })
  await queryClient?.invalidateQueries({ queryKey: orpc.songs.list.key() })
  // The new analysis used an allowance: the meter follows.
  if (queryClient) await reloadMe(queryClient)
}

/** Creates the song and its upload; the transfer continues in the background. Returns the song. */
export async function startImport(request: ImportRequest): Promise<string> {
  const { file } = request
  const { song_id: songId } = await client.songs.create({
    title: request.title,
    instrument: request.instrument,
    source_kind: request.sourceKind,
  })
  const target = await client.uploads.create({
    song_id: songId,
    filename: file.name || request.title,
    bytes: file.size,
    mime: file.type || 'application/octet-stream',
    file_sha256: request.fileSha256,
    ...(request.allowDuplicate ? { allow_duplicate: true } : {}),
  })
  if ('duplicate_of_song_id' in target) {
    // The empty song made for this import is not needed.
    await client.songs.delete({ id: songId }).catch(() => undefined)
    throw new DuplicateSongError(target.duplicate_of_song_id)
  }
  const record: PendingUpload = {
    uploadId: target.upload_id,
    songId,
    title: request.title,
    instrument: request.instrument,
    type: request.type,
    fileSha256: request.fileSha256,
    bytes: file.size,
    partSize: target.part_size,
    parts: [],
    file,
    createdAt: Date.now(),
  }
  // Storing the file can fail (quota; Safari private browsing refuses blobs in IndexedDB): the
  // record is kept without it, and after a reload the learner picks the same file again.
  await resumeStore
    .put(record)
    .catch(() => resumeStore.put({ ...record, file: undefined }).catch(() => undefined))
  initialUrls.set(record.uploadId, target.parts)
  if (request.sourceKind === 'recording') recordings.add(record.uploadId)
  uploadEvent(record, 'upload_started')
  useUploads.getState().upsert(songId, {
    title: request.title,
    phase: navigator.onLine ? 'uploading' : 'waiting_online',
    bytesTotal: file.size,
  })
  transfer(record, file)
  return songId
}

let resumed = false

/** Continues uploads a previous page left unfinished (once per page). */
export async function resumePendingUploads(): Promise<void> {
  if (resumed || typeof indexedDB === 'undefined') return
  resumed = true
  const pending = await resumeStore.all().catch(() => [] as PendingUpload[])
  for (const record of pending) {
    const uploaded = record.parts.reduce(
      (sum, part) => sum + Math.min(record.partSize, record.bytes - (part.n - 1) * record.partSize),
      0,
    )
    records.set(record.uploadId, record)
    useUploads.getState().upsert(record.songId, {
      title: record.title,
      phase: !record.file ? 'needs_file' : navigator.onLine ? 'uploading' : 'waiting_online',
      bytesUploaded: uploaded,
      bytesTotal: record.bytes,
    })
    if (record.parts.length === Math.ceil(record.bytes / record.partSize)) {
      // Every part is in: the page closed before (or while) completing.
      try {
        await client.uploads.complete({ id: record.uploadId, parts: record.parts })
      } catch (error) {
        if (errorCode(error) !== 'conflict') throw error
      }
      await startAnalysis(record)
      continue
    }
    if (record.file) transfer(record, record.file)
  }
}

/** Continues an upload whose file the browser couldn't keep, once the learner picks it again. */
export async function resumeWithFile(songId: string, file: File): Promise<void> {
  const record = [...records.values()].find((r) => r.songId === songId)
  if (!record) return
  if (file.size !== record.bytes || (await hashFile(file)) !== record.fileSha256) {
    throw new DifferentFileError('not the file this upload started with')
  }
  const resumed = { ...record, file }
  records.set(record.uploadId, resumed)
  useUploads.getState().patch(songId, { phase: navigator.onLine ? 'uploading' : 'waiting_online' })
  transfer(resumed, file)
}

/** Retries a failed upload or analysis request of this song. */
export async function retryUpload(songId: string): Promise<void> {
  const record = [...records.values()].find((r) => r.songId === songId)
  if (!record) return
  const item = useUploads.getState().items[songId]
  if (item && item.bytesUploaded >= record.bytes) {
    await startAnalysis(record)
    return
  }
  if (record.file) transfer(record, record.file)
}
