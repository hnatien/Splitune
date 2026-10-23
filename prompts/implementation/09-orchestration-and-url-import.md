# Step 09 — Analysis orchestration, SSE progress and URL import

## Before you start
Read `prompts/implementation/00-shared-context.md`, then:
- `docs/implementation/01-system-architecture.md` (callout + §3 stage sequence, §5 realtime, §7 degradations)
- `docs/implementation/04-api-contract.md` (analyses, artefact URLs, SSE events, `import-url`)
- `docs/implementation/25-personal-mode.md` §4 (URL import), §5 (worker presence)
- `docs/implementation/23-plans-free-and-paid.md` §2 (full vs lite profiles; entitlement checks come in step 14 — leave a hook)
- `docs/implementation/13-import-onboarding-and-youtube-embed.md` §4, §6a, §7
- `docs/implementation/27-screens-flows-and-content.md` §3.7.3 (what the client shows at each artefact stage) and §5.6 (message catalogue: `analysis.*`, `import.url_*`) — the events and codes you emit are what those screens render

Prerequisites: Steps 04, 06, 07, 08.

## Goal
One API call turns an uploaded song (or a URL) into a fully analysed song with progressive results streamed to the client, using the Postgres job graph, per-stage caching and graceful partial failure.

## Deliverables
1. **`POST /v1/analyses`** (`type: full|lite`, instrument): idempotency key per doc 03; creates `analyses` row (versioned) and enqueues the stage graph with `depends_on` edges: full = `decode → {beats, tag} → separate → stem_post → {chords, notes.<instrument>} → finalize`; lite = `decode → beats → chords(mixture) → finalize`. Plus priority (Plus users get lower number — read from an `entitlements()` stub returning Free for now). An `admitAnalysis()` hook where step 14 plugs allowances.
2. **Re-run and upgrade:** `POST /v1/analyses/{id}/rerun`; Lite → Full upgrade enqueues only missing stages (cache keys reuse beats/chords).
3. **Partial failure:** non-critical stage failure marks the stage `failed`/`fallback` and lets dependants continue with documented fallbacks (doc 06 §6); `analysis.done` carries `done|partial|failed`.
4. **SSE** `GET /v1/analyses/{id}/events`: streams `job_events` for the owner, `Last-Event-ID` replay, 15 s heartbeats, ends on `analysis.done`; LISTEN/NOTIFY to wake streams. `GET /v1/artefacts/{id}/url?variant=` returns 15-minute signed URLs (codec variant for stems).
5. **Worker presence:** `GET /v1/system/worker-status` (online if heartbeat <2 min); `job_events` include `queued_waiting_for_worker` when the Mac is offline.
6. **URL import:** `POST /v1/songs/import-url` → song (`source_kind='url'`, `source_url`) + `url_import` job (python runner, onnx-cpu island): `yt-dlp` pinned with Deno + `yt-dlp-ejs`, best audio → `u/{user}/raw/…`, optional video ≤720p → `video.mp4`; time/size limits; errors `url_unsupported` / `url_download_failed`; on success it enqueues the requested analysis. Store minimal metadata (title/artist if available) on the song.
7. **Codes for the UI:** SSE events and error envelopes carry machine codes only (`error_code`, `fallback_reason`, stage `reasons`), never English text; tighten `StageFailedEvent.fallback` (currently a free `z.string()` in `packages/contracts/src/api/events.ts`) to `MachineCode` and regenerate. List every code the orchestrator, stages and URL import can emit — code, when it happens, whether the analysis was charged — in `PROGRESS.md`, so step 10 maps each to an `analysis.reason.{code}` / `import.*` message (unknown codes fall back to `analysis.failed`).
8. **Deletion:** `DELETE /v1/songs/{id}` cascade now also cancels queued jobs for that song and enqueues `delete_prefix` for the node worker (implement that job kind in `apps/node-worker`).

## Out of scope
Web UI (step 10), billing allowances (step 14), sweepers (step 15).

## Acceptance criteria
- Integration test with `ML_MODE=mock`: upload → `POST /v1/analyses` → SSE stream shows stages in dependency order → `analysis.done` → artefact URLs download valid JSON/audio.
- Real-mode test on the Mac (manual, documented): a 4-minute song and a YouTube URL both finish; report wall-clock per stage and total.
- Idempotency: duplicate POST returns the same analysis; re-run creates version n+1 and leaves old artefacts intact.
- Worker offline: analyses queue, SSE reports waiting, processing resumes when the worker starts.
- Cancelling via song deletion stops queued jobs and removes objects.
- A test asserts that no SSE event or error payload contains free-text messages (codes and numbers only), and the code list is in `PROGRESS.md`.

## Verification to run and report
`pnpm --filter api test`, `pnpm --filter node-worker test`, the manual real-mode runs with timings, `uv run pytest -k url_import` (use a mocked yt-dlp in unit tests; one opt-in live test).
