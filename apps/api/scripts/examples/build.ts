// pnpm examples:build [--out <manifest>] [<per-file options>] <audio file> […] — analyses the
// owner's example songs (13 §1) with the full pipeline as the system user, copies what practice
// reads into the bucket under assets/examples/{id}/{build}/ and writes the examples.json manifest
// (default apps/api/examples.json, the one the API ships). Needs the workers running against the
// same database and bucket (`pnpm dev` and the Mac workers locally; production's .env values for
// R2 + Railway Postgres). Only the manifest is committed, never audio.
//
// Options before a file apply to that file: --id <slug> --title <text> --artist <text>
// --instrument guitar|bass --part rhythm|riff|bass_line --loop <first>-<last> (bars, 1-based as in
// the UI; default: suggested from the analysis). Examples already in the manifest with other ids
// are kept.
import { createHash, randomUUID } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { basename, extname, join } from 'node:path'
import { parseArgs } from 'node:util'
import { Beats, ExamplePart, Instrument, Notes, Stems } from '@splitune/contracts'
import { ExamplesManifest, type ManifestExample } from '@splitune/contracts/examples-manifest'
import { createDb, createRepositories } from '@splitune/db'
import { createStorage, exampleKey, rawUploadKey, storageConfigFromEnv } from '@splitune/storage'
import type { z } from 'zod'
import { analysisKey, CONFIG_PROFILE, planAnalysis } from '../../src/pipeline.ts'
import { toAnalysis } from '../../src/routes/analyses.ts'
import { type SuggestedLoop, suggestLoop } from './loop.ts'

const DEFAULT_OUT = join(import.meta.dirname, '../../examples.json')
// Starting speed per level (13 §1: 70 % for "just started", 80 % for "a few songs").
const SPEEDS = { just_started: 70, few_songs: 80, returning: 80 }
const TERMINAL = new Set(['done', 'partial', 'failed', 'cancelled'])
const POLL_MS = 2_000
const TIMEOUT_MS = 30 * 60_000
const MAX_FILE_BYTES = 200 * 1024 * 1024
const MIME: Record<string, string> = {
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.flac': 'audio/flac',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
  '.ogg': 'audio/ogg',
  '.aiff': 'audio/aiff',
}

interface Request {
  file: string
  id: string
  title: string
  artist: string | null
  instrument: 'guitar' | 'bass'
  part: z.infer<typeof ExamplePart>
  loop: SuggestedLoop | undefined
}

function requests(argv: string[]): { out: string; files: Request[] } {
  const { tokens } = parseArgs({
    args: argv,
    allowPositionals: true,
    tokens: true,
    strict: true,
    options: {
      out: { type: 'string' },
      id: { type: 'string' },
      title: { type: 'string' },
      artist: { type: 'string' },
      instrument: { type: 'string' },
      part: { type: 'string' },
      loop: { type: 'string' },
    },
  })
  let out = DEFAULT_OUT
  type FileOption = 'id' | 'title' | 'artist' | 'instrument' | 'part' | 'loop'
  let pending: Partial<Record<FileOption, string>> = {}
  const files: Request[] = []
  for (const token of tokens) {
    if (token.kind === 'option' && token.value !== undefined) {
      if (token.name === 'out') out = token.value
      else pending[token.name as FileOption] = token.value
    } else if (token.kind === 'positional') {
      const name = basename(token.value, extname(token.value))
      const title = pending.title ?? name
      const instrument = Instrument.extract(['guitar', 'bass']).parse(
        pending.instrument ?? 'guitar',
      )
      const loop = pending.loop?.match(/^(\d+)-(\d+)$/)
      files.push({
        file: token.value,
        id: pending.id ?? slug(title),
        title,
        artist: pending.artist ?? null,
        instrument,
        part: ExamplePart.parse(pending.part ?? (instrument === 'bass' ? 'bass_line' : 'riff')),
        loop: loop ? { start_bar: Number(loop[1]) - 1, end_bar: Number(loop[2]) - 1 } : undefined,
      })
      pending = {}
    }
  }
  if (files.length === 0) {
    throw new Error('usage: pnpm examples:build [--out <manifest>] [options] <audio file> […]')
  }
  return { out, files }
}

const slug = (text: string) =>
  text
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 63) || 'example'

// 20261022T153000Z: the build's folder, so a rebuild never overwrites cached files.
const buildStamp = (date: Date) =>
  date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')

const sha256 = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex')

const { out, files } = requests(process.argv.slice(2))
const { DATABASE_URL: databaseUrl, PIPELINE_VERSION: pipelineVersion = 'examples' } = process.env
if (!databaseUrl) throw new Error('DATABASE_URL is not set')
const db = createDb({ url: databaseUrl, max: 2, applicationName: 'splitune-examples' })
const repos = createRepositories(db)
const storage = createStorage(storageConfigFromEnv())
// The examples' own analyses belong to the system user.
const userId = await repos.examples.ensureSystemUser()

const previous = existsSync(out)
  ? ExamplesManifest.parse(JSON.parse(readFileSync(out, 'utf8')))
  : { version: 1 as const, examples: [] }

async function analyse(request: Request, build: string) {
  const bytes = readFileSync(request.file)
  if (bytes.byteLength > MAX_FILE_BYTES) throw new Error(`${request.file} is larger than 200 MB`)
  const ext = extname(request.file).toLowerCase()
  const song = await repos.songs.create(userId, {
    title: request.title,
    artist: request.artist,
    instrument: request.instrument,
    sourceKind: 'example',
  })
  const uploadId = randomUUID()
  const rawKey = rawUploadKey(userId, uploadId, basename(request.file))
  await storage.putBytes(rawKey, bytes, MIME[ext] ?? 'application/octet-stream')
  await repos.uploads.create(userId, {
    id: uploadId,
    songId: song.id,
    objectKey: rawKey,
    bytes: bytes.byteLength,
    mime: MIME[ext] ?? 'application/octet-stream',
    fileSha256: sha256(bytes),
    status: 'uploaded',
    expiresAt: new Date(Date.now() + 7 * 86_400_000),
  })
  const created = await repos.analyses.create(
    userId,
    song.id,
    {
      pipelineVersion,
      configProfile: CONFIG_PROFILE,
      requestedInstrument: request.instrument,
      analysisType: 'full',
      idempotencyKey: analysisKey([userId, `example:${request.id}`, build]),
    },
    (analysis) => planAnalysis({ userId, analysis, type: 'full', source: { rawKey }, priority: 0 }),
  )
  if (!created) throw new Error('could not create the analysis')
  const analysisId = created.analysis.id
  const started = Date.now()
  let reported = ''
  for (;;) {
    const detail = await repos.analyses.detail(userId, analysisId)
    if (!detail) throw new Error('the analysis disappeared')
    const view = toAnalysis(detail)
    const line = Object.entries(view.stages)
      .map(([stage, state]) => `${stage}:${state.status}`)
      .join(' ')
    if (line !== reported) {
      console.log(`  ${request.id} [${Math.round((Date.now() - started) / 1000)} s] ${line}`)
      reported = line
    }
    if (TERMINAL.has(view.status)) {
      if (view.status !== 'done' && view.status !== 'partial') {
        throw new Error(`analysis of ${request.file} ended ${view.status}`)
      }
      return { detail, view, seconds: Math.round((Date.now() - started) / 1000) }
    }
    if (Date.now() - started > TIMEOUT_MS) {
      throw new Error(
        `analysis of ${request.file} still running after 30 min (are the workers up?)`,
      )
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
}

async function copy(from: string, to: string, type: string) {
  const bytes = await storage.getBytes(from, { maxBytes: MAX_FILE_BYTES })
  if (!bytes) throw new Error(`missing object ${from}`)
  await storage.putBytes(to, bytes, type)
  return bytes
}

async function build(request: Request): Promise<z.infer<typeof ManifestExample>> {
  const build = buildStamp(new Date())
  const { detail, view, seconds } = await analyse(request, build)
  const keep = new Set([
    'beats',
    'chords',
    'stems',
    'summary',
    `notes.${request.instrument}`,
    `tab.${request.instrument}`,
  ])
  const latest = new Map<string, (typeof detail.artefacts)[number]>()
  for (const row of detail.artefacts) {
    const best = latest.get(row.kind)
    if (keep.has(row.kind) && (!best || row.version > best.version)) latest.set(row.kind, row)
  }
  for (const kind of ['beats', 'stems']) {
    if (!latest.has(kind)) throw new Error(`${request.file}: the analysis has no ${kind}`)
  }
  const artefacts: z.infer<typeof ManifestExample>['artefacts'] = []
  const docs = new Map<string, unknown>()
  for (const [kind, row] of latest) {
    const path = `${kind}.json`
    const bytes = await copy(row.objectKey, exampleKey(request.id, build, path), 'application/json')
    docs.set(kind, JSON.parse(new TextDecoder().decode(bytes)))
    artefacts.push({
      id: randomUUID(),
      kind,
      version: 1,
      path,
      bytes: bytes.byteLength,
      sha256: sha256(bytes),
      model_refs: row.modelRefs,
    })
  }
  const stems = Stems.parse(docs.get('stems'))
  const stemsDir = latest.get('stems')?.objectKey.replace(/[^/]+$/, '') ?? ''
  for (const file of stems.stems.flatMap((s) => s.files)) {
    await copy(
      `${stemsDir}${file.path}`,
      exampleKey(request.id, build, file.path),
      file.container === 'mp4' ? 'audio/mp4' : 'audio/webm',
    )
  }
  const beats = Beats.parse(docs.get('beats'))
  const notesDoc = docs.get(`notes.${request.instrument}`)
  const loop = request.loop ?? suggestLoop(beats, notesDoc ? Notes.parse(notesDoc) : undefined)
  const earlier = previous.examples.find((e) => e.id === request.id)
  console.log(
    `  ${request.id}: ${view.status} in ${seconds} s, ${Math.round(beats.bpm)} BPM, loop bars ` +
      `${loop.start_bar + 1}–${loop.end_bar + 1}, view ${detail.analysis.recommendedView ?? '—'}`,
  )
  return {
    id: request.id,
    build,
    title: request.title,
    artist: request.artist,
    instrument: request.instrument,
    part: request.part,
    duration_s: beats.duration_s,
    audio_hash: beats.audio_hash,
    // The visitor's device keys its progress by this id, so it survives rebuilds.
    song_id: earlier?.song_id ?? randomUUID(),
    analysis: {
      id: randomUUID(),
      pipeline_version: pipelineVersion,
      recommended_view: detail.analysis.recommendedView,
      stages: view.stages,
      created_at: view.created_at,
      finished_at: view.finished_at ?? new Date().toISOString(),
    },
    artefacts,
    loop,
    speed_pct: SPEEDS,
  }
}

try {
  const built: z.infer<typeof ManifestExample>[] = []
  const failed: string[] = []
  for (const request of files) {
    console.log(`${request.id}: analysing ${request.file} (${request.instrument}, ${request.part})`)
    try {
      built.push(await build(request))
    } catch (error) {
      // One bad file doesn't cost the others their analysis; it is reported and left out.
      console.error(`  ${request.id}: FAILED — ${(error as Error).message}`)
      failed.push(request.id)
    }
  }
  const ids = new Set(built.map((e) => e.id))
  const manifest = ExamplesManifest.parse({
    version: 1,
    examples: [...previous.examples.filter((e) => !ids.has(e.id)), ...built].sort((a, b) =>
      a.id.localeCompare(b.id),
    ),
  })
  writeFileSync(out, `${JSON.stringify(manifest, null, 2)}\n`)
  console.log(`Wrote ${out}: ${manifest.examples.length} example(s).`)
  if (failed.length > 0) {
    console.error(`Not built: ${failed.join(', ')}`)
    process.exitCode = 1
  }
} finally {
  await db.$client.end()
}
