import { eventIterator, oc } from '@orpc/contract'
import { z } from 'zod'
import { Analysis, AnalysisAccepted, CreateAnalysisInput } from './analyses.ts'
import { TrackInput } from './analytics.ts'
import { ArtefactUrlInput, ArtefactUrlOutput } from './artefacts.ts'
import {
  BillingPlansOutput,
  CheckoutInput,
  MockCheckoutInput,
  MockCheckoutOutput,
  MockPortalInput,
  MockPortalOutput,
  MockSession,
  MockSessionInput,
} from './billing.ts'
import { IdInput, page, RedirectOutput } from './common.ts'
import {
  CorrectionsBatchInput,
  CorrectionsBatchOutput,
  ListCorrectionsInput,
  ListCorrectionsOutput,
} from './corrections.ts'
import { AnalysisCapDetails, ERROR_STATUS, type ErrorCode } from './errors.ts'
import { JobEvent } from './events.ts'
import {
  ClaimExampleInput,
  ClaimExampleOutput,
  ExampleUrlInput,
  ListExamplesOutput,
} from './examples.ts'
import {
  CreateLoopInput,
  DeleteLoopInput,
  ListLoopsInput,
  ListLoopsOutput,
  LoopClip,
  UpdateLoopInput,
} from './loops.ts'
import { DeleteMeOutput, ExportOutput, Me, UpdateMeInput } from './me.ts'
import { PracticeSyncInput, PracticeSyncOutput, ProgressInput, ProgressOutput } from './practice.ts'
import {
  CreateSongInput,
  CreateSongOutput,
  ImportUrlInput,
  ImportUrlOutput,
  LibrarySong,
  ListSongsInput,
  PutSyncPointsInput,
  PutYoutubeInput,
  Song,
  SongDetail,
  SongMediaInput,
  UpdateSongInput,
} from './songs.ts'
import { SystemStats, WorkerStatus } from './system.ts'
import {
  CompleteUploadInput,
  CreateUploadInput,
  CreateUploadOutput,
  LookupUploadInput,
  LookupUploadOutput,
  RefreshPartsInput,
  RefreshPartsOutput,
  UploadState,
} from './uploads.ts'

// Typed errors for every procedure. The API maps them onto the ErrorEnvelope wire shape.
const errors = {
  ...(Object.fromEntries(
    Object.entries(ERROR_STATUS).map(([code, status]) => [code, { status }]),
  ) as { [K in ErrorCode]: { status: (typeof ERROR_STATUS)[K] } }),
  analysis_cap_reached: { status: ERROR_STATUS.analysis_cap_reached, data: AnalysisCapDetails },
  rate_limited: {
    status: ERROR_STATUS.rate_limited,
    data: z.object({ retry_after_s: z.number().int().nonnegative() }),
  },
}

const base = oc.errors(errors)

// Router definition without handlers (04-api-contract.md "Public procedures"): apps/api implements
// it and apps/web gets a typed client from it. Legal (DMCA) routes are dormant in personal mode.
export const contract = {
  me: {
    get: base.route({ method: 'GET', path: '/v1/me' }).output(Me),
    update: base.route({ method: 'PATCH', path: '/v1/me' }).input(UpdateMeInput).output(Me),
    export: base
      .route({ method: 'POST', path: '/v1/me/export', successStatus: 202 })
      .output(ExportOutput),
    delete: base
      .route({ method: 'DELETE', path: '/v1/me', successStatus: 202 })
      .output(DeleteMeOutput),
  },
  songs: {
    create: base
      .route({ method: 'POST', path: '/v1/songs', successStatus: 201 })
      .input(CreateSongInput)
      .output(CreateSongOutput),
    list: base
      .route({ method: 'GET', path: '/v1/songs' })
      .input(ListSongsInput)
      .output(page(LibrarySong)),
    get: base.route({ method: 'GET', path: '/v1/songs/{id}' }).input(IdInput).output(SongDetail),
    update: base
      .route({ method: 'PATCH', path: '/v1/songs/{id}' })
      .input(UpdateSongInput)
      .output(Song),
    delete: base
      .route({ method: 'DELETE', path: '/v1/songs/{id}', successStatus: 204 })
      .input(IdInput)
      .output(z.void()),
    mediaUrl: base
      .route({ method: 'GET', path: '/v1/songs/{id}/media' })
      .input(SongMediaInput)
      .output(ArtefactUrlOutput),
    importUrl: base
      .route({ method: 'POST', path: '/v1/songs/import-url', successStatus: 202 })
      .input(ImportUrlInput)
      .output(ImportUrlOutput),
    putYoutube: base
      .route({ method: 'PUT', path: '/v1/songs/{id}/youtube', successStatus: 204 })
      .input(PutYoutubeInput)
      .output(z.void()),
    deleteYoutube: base
      .route({ method: 'DELETE', path: '/v1/songs/{id}/youtube', successStatus: 204 })
      .input(IdInput)
      .output(z.void()),
    putSyncPoints: base
      .route({ method: 'PUT', path: '/v1/songs/{id}/sync-points', successStatus: 204 })
      .input(PutSyncPointsInput)
      .output(z.void()),
  },
  uploads: {
    create: base
      .route({ method: 'POST', path: '/v1/uploads', successStatus: 201 })
      .input(CreateUploadInput)
      .output(CreateUploadOutput),
    lookup: base
      .route({ method: 'GET', path: '/v1/uploads/lookup' })
      .input(LookupUploadInput)
      .output(LookupUploadOutput),
    refreshParts: base
      .route({ method: 'POST', path: '/v1/uploads/{id}/parts' })
      .input(RefreshPartsInput)
      .output(RefreshPartsOutput),
    complete: base
      .route({ method: 'POST', path: '/v1/uploads/{id}/complete' })
      .input(CompleteUploadInput)
      .output(UploadState),
    abort: base
      .route({ method: 'DELETE', path: '/v1/uploads/{id}', successStatus: 204 })
      .input(IdInput)
      .output(z.void()),
  },
  analyses: {
    create: base
      .route({ method: 'POST', path: '/v1/analyses', successStatus: 202 })
      .input(CreateAnalysisInput)
      .output(AnalysisAccepted),
    get: base.route({ method: 'GET', path: '/v1/analyses/{id}' }).input(IdInput).output(Analysis),
    events: base
      .route({ method: 'GET', path: '/v1/analyses/{id}/events' })
      .input(IdInput)
      .output(eventIterator(JobEvent)),
    rerun: base
      .route({ method: 'POST', path: '/v1/analyses/{id}/rerun', successStatus: 202 })
      .input(IdInput)
      .output(AnalysisAccepted),
  },
  artefacts: {
    url: base
      .route({ method: 'GET', path: '/v1/artefacts/{id}/url' })
      .input(ArtefactUrlInput)
      .output(ArtefactUrlOutput),
    listCorrections: base
      .route({ method: 'GET', path: '/v1/artefacts/{id}/corrections' })
      .input(ListCorrectionsInput)
      .output(ListCorrectionsOutput),
    applyCorrections: base
      .route({ method: 'POST', path: '/v1/artefacts/{id}/corrections' })
      .input(CorrectionsBatchInput)
      .output(CorrectionsBatchOutput),
  },
  loops: {
    list: base
      .route({ method: 'GET', path: '/v1/songs/{id}/loops' })
      .input(ListLoopsInput)
      .output(ListLoopsOutput),
    create: base
      .route({ method: 'POST', path: '/v1/songs/{id}/loops', successStatus: 201 })
      .input(CreateLoopInput)
      .output(LoopClip),
    update: base
      .route({ method: 'PATCH', path: '/v1/songs/{id}/loops/{loop_id}' })
      .input(UpdateLoopInput)
      .output(LoopClip),
    delete: base
      .route({ method: 'DELETE', path: '/v1/songs/{id}/loops/{loop_id}', successStatus: 204 })
      .input(DeleteLoopInput)
      .output(z.void()),
  },
  practice: {
    sync: base
      .route({ method: 'POST', path: '/v1/practice/sync' })
      .input(PracticeSyncInput)
      .output(PracticeSyncOutput),
    progress: base
      .route({ method: 'GET', path: '/v1/progress' })
      .input(ProgressInput)
      .output(ProgressOutput),
  },
  // Example songs (13 §1): listed and signed for visitors without an account; claimed once signed in.
  examples: {
    list: base.route({ method: 'GET', path: '/v1/examples' }).output(ListExamplesOutput),
    url: base
      .route({ method: 'GET', path: '/v1/examples/{id}/url' })
      .input(ExampleUrlInput)
      .output(ArtefactUrlOutput),
    claim: base
      .route({ method: 'POST', path: '/v1/examples/{id}/claim' })
      .input(ClaimExampleInput)
      .output(ClaimExampleOutput),
  },
  // Product events (16 §2), from visitors and signed-in users alike.
  analytics: {
    track: base
      .route({ method: 'POST', path: '/v1/events', successStatus: 204 })
      .input(TrackInput)
      .output(z.void()),
  },
  system: {
    workerStatus: base
      .route({ method: 'GET', path: '/v1/system/worker-status' })
      .output(WorkerStatus),
    stats: base.route({ method: 'GET', path: '/v1/system/stats' }).output(SystemStats),
  },
  billing: {
    plans: base.route({ method: 'GET', path: '/v1/billing/plans' }).output(BillingPlansOutput),
    checkout: base
      .route({ method: 'POST', path: '/v1/billing/checkout' })
      .input(CheckoutInput)
      .output(RedirectOutput),
    portal: base.route({ method: 'POST', path: '/v1/billing/portal' }).output(RedirectOutput),
    // Personal mode only (25 §2): the mock checkout and portal pages act through these.
    mockSession: base
      .route({ method: 'GET', path: '/v1/billing/mock/session' })
      .input(MockSessionInput)
      .output(MockSession),
    mockCheckout: base
      .route({ method: 'POST', path: '/v1/billing/mock/checkout' })
      .input(MockCheckoutInput)
      .output(MockCheckoutOutput),
    mockPortal: base
      .route({ method: 'POST', path: '/v1/billing/mock/portal' })
      .input(MockPortalInput)
      .output(MockPortalOutput),
  },
}

export type Contract = typeof contract
