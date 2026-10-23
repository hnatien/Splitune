---
title: Import, onboarding, library and YouTube embed
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Import, onboarding, library and YouTube embed

Implements M1 (import own file / record), M2 (instant local playback while the job runs), M12 (embed as visual reference with syncpoints), M13 (first-session flow with a bundled example song) and M14 (personal library). The flows follow `users/user-journeys-and-flows.md` (Journey 1, Journey 2, alternate flows A–C) and the binding input rule: **user files or recordings only; a YouTube video is a visual reference with no audio access.**

> **Personal mode is current (`25-personal-mode.md`).** Additions and overrides: (1) **URL import** — paste a YouTube (or other yt-dlp-supported) link and the worker downloads audio, optionally video, then analyses it; the downloaded video plays locally, muted and slaved to the audio clock, so sync is automatic and notation may sit beside or over it (§6a). (2) The rights checkbox, the "must own the file" copy and the embed-only restriction are dropped. (3) Example songs can be any tracks from the owner's library. The IFrame embed + syncpoints flow in §6 remains as the fallback when a download fails.

## TL;DR
- **First run never touches the network-heavy path:** pick instrument + level → bundled example song with precomputed analysis → isolated part → phrase looped at 70%. Target: first slowed loop ≤5 min after landing (p50).
- **Import = local decode first, upload second.** The browser decodes the file, starts playback/loop/slow-down immediately (M2), computes a provisional PCM hash, then uploads resumably in the background; the server re-validates with ffprobe and runs the analysis.
- **Progressive reveal** follows artefact availability: waveform + local playback → beat grid (≤10 s) → stems → chords → tab. Honest time estimate and a notification when done.
- **YouTube link → embed + "add your file" prompt.** Only documented IFrame API calls (`setPlaybackRate`, `seekTo`, `getCurrentTime`, state events); tabs render beside/below, never over, the ≥200×200 px player; sync via user-tapped syncpoints. Shipped only after counsel answers QL1 (else v1).
- **Failure flows are first-class:** unsupported/corrupt file, too long, not music, low quality, offline — each with a plain-language reason and a lawful alternative.

## 1. First-session onboarding (M13)
```mermaid
flowchart TD
  L[Landing / app open] --> I[Pick instrument]
  I --> V[Pick level: just started · a few songs · returning]
  V --> X[Example song loads from CDN: stems + analysis precomputed]
  X --> A1[Aha 1: hear your part isolated - autoplay after a tap]
  A1 --> A2[Aha 2: suggested 2-4 bar phrase looped at 70%]
  A2 --> G[Optional: 'Felt clean / Not yet' self-assessment]
  G --> S[Save progress → create account (magic link / Google / Apple)]
  S --> N[Next: import your own song or record yourself]
```
- No account is required until the user wants to save or import; progress made before signup is kept in IndexedDB and attached on signup.
- Instrument + level set defaults: view (tab/chords), level toggle (M11), mixer preset ("Your part loud"), starting speed (70% for just started).
- Example songs: 3–5 Splitune-owned recordings (`08-evaluation-harness-and-prototypes.md` §2) covering guitar rhythm, guitar riff, bass line; assets served from `splitune-assets-{env}/examples/`.
- Instrumentation: `onboarding_step_viewed`, `first_isolated_playback`, `first_loop_reduced_speed` (`16-observability-analytics-experiments.md`).

## 2. Import own file (M1, M2)
### Supported inputs
- Audio: MP3, AAC/M4A, WAV, AIFF, FLAC, OGG/Opus. Video: MP4/MOV/WebM (audio track extracted; video discarded server-side and never analysed).
- Limits (proposal): ≤ 20 min duration, ≤ 500 MB per file; longer/larger files get a clear message.
- Sources: file picker, drag-and-drop, share-target (PWA Web Share Target on Android), Files app on iPadOS via picker. Cloud pickers (Google Drive/Dropbox) are later.

### Client steps
1. **Rights confirmation** (checkbox, required) — text versioned (`15-privacy-dmca-and-data-lifecycle.md`).
2. **Decode locally** (Mediabunny over WebCodecs for audio and video containers; `decodeAudioData` fallback where WebCodecs is missing, e.g. Firefox Android) at the AudioContext rate; show waveform; start **instant local playback** with loop and slow-down through the same audio engine as stems (`11-audio-engine.md`). Optionally run Beat This! small in a Worker for an instant beat grid (flagged; D6).
3. **Pre-flight checks:** duration, silence ratio, clipping, mono/stereo, "is this music?" heuristic (spectral flatness); warn on likely poor results ("live recording / very quiet / spoken word") with continue/cancel.
4. **File hash** (SHA-256 of the original bytes, in a Worker) → ask API whether this user already has a byte-identical upload (jumps to the existing song). Re-encodes are caught later by the server's PCM `audio_hash`, which merges into the existing song for that user.
5. **Create song + upload session** (`POST /songs`, `POST /uploads`) → resumable multipart upload of the **original file** directly to object storage via signed part URLs; persists across reloads (resume token in IndexedDB).
6. **Choose part** (defaults to profile instrument; "full mix" option always available) → `POST /analyses`.
7. **Progress UI** subscribes to the analysis event stream (`04-api-contract.md`), revealing artefacts as they land.

### Server steps
`uploaded` → ffprobe validation in a sandboxed worker (container, duration, codecs, bomb checks; `17-security.md`) → `validated` → analysis job admission (entitlement + cap check; `14-auth-billing-and-entitlements.md`) → pipeline (`06-ml-pipeline-service.md`).

## 3. Record yourself (Design E)
- `getUserMedia` with processing off → MediaRecorder (Opus/WebM; AAC/MP4 on Safari) → same import pipeline with `source_kind='recording'`.
- Use cases: record a teacher/bandmate, own performance; level meter + count-in + optional click.

## 4. Progressive results and waiting
| Moment | UI |
|---|---|
| Upload in progress | Local playback, loop, slow-down already usable; progress bar with bytes and ETA |
| `beats` ready (≤10 s after start) | Bar numbers, bar-snapped loop, count-in/metronome enabled |
| `stems` ready | Mixer appears; "audition: is this your part?" clip with "wrong instrument" correction (Journey stage 5) |
| `chords` ready | Chord strip with confidence styles |
| `notes`/`tab` ready | Tab view (or chords-only fallback per `summary.recommended_view`, with a banner explaining why) |
| Done | Push/email notification if the tab is in the background (opt-in) |

ETA = queue position × median stage time from recent runs; never show a fake progress bar.

## 5. Library (M14)
- List of songs with last practised, tempo reached per clip, status (ready/partial/stems expired/taken down).
- **Never removed by Splitune** except by the user, DMCA takedown or the stem-expiry sweeper (which keeps JSON and loops; UI offers "re-create stems").
- Resume restores `songs.player_state` (speed, mix, view, playback key, last position, selected loop).

## 6. YouTube embed as visual reference (M12; gated on QL1)
### Flow
1. User pastes a YouTube URL → parse `video_id` client-side (no server fetch of the video).
2. Render the IFrame Player (privacy-enhanced domain if counsel prefers) at ≥200×200 px (recommended ≥480×270), with **no overlays**; notation and chords render beside (landscape/desktop) or below (portrait).
3. Prompt: "To get stems and tab, add a file of this recording you own — or record yourself." Without a file: embed + speed (from `getAvailablePlaybackRates`) + A–B loop via `seekTo` only, with a plain explanation why no stems/tab.
4. With a file: after analysis, **syncpoints** align file time ↔ video time. User taps "sync here" at 2+ moments (intro hit, first downbeat, a later downbeat) while both play; piecewise-linear map in `sync_points`; drift check every N s re-seeks the video if it diverges >150 ms.

### Rules enforced in code
- Only documented IFrame API methods; no audio capture, no frame reading, no background play, no muted-video-with-our-stems trick (III.I.7).
- The embed is never behind the paywall; the component tree puts entitlement gates only on analysis/practice features.
- If a video is not embeddable/region-locked/removed: show the API error in plain language and continue with the user's file only.
- Store only `video_id` and syncpoints; any API-fetched title is refreshed or deleted within 30 days (III.E.4.c).
- Native apps (v1) must host the embed in the OS WebView without nested iframes (RMF, III.I.21) — see `22-native-apps.md`.

## 6a. URL import with local video (personal mode)
1. Paste URL in `/import` → `POST /v1/songs/import-url { url, instrument, download_video }`.
2. Worker `url_import` stage downloads with `yt-dlp` (Deno + `yt-dlp-ejs`), stores `raw/` audio (+ `video.mp4` ≤720p if requested), then the normal pipeline runs; SSE shows "Downloading…" before "Analysing…".
3. Practice screen shows a `<video muted playsinline>` from a signed URL; a sync controller sets `video.playbackRate` to the engine rate, re-seeks on loop wrap and when drift >80 ms, and nudges rate ±2% for smaller drift. Video follows slow-down, loops and seeks exactly like notation.
4. Layout: video top or side; notation may overlay the video (toggle) since no embed rules apply to a local file.
5. Failure (geo-blocked, private, extractor broken): plain message + options "upload a file" or "use the YouTube embed with manual syncpoints".

## 7. Failure flows (alternate flow A)
The exact user-facing copy for these (and every other message) is the catalogue in `27-screens-flows-and-content.md` §5.6; the table below gives detection and offers.

| Failure | Detection | Message (plain language) | Offer |
|---|---|---|---|
| Unsupported or corrupt file | decode or ffprobe error | "We couldn't read this file." | Try another format; record yourself |
| Too long/large | client limits | "Songs up to 20 minutes are supported." | Trim tip |
| Not music / spoken word | pre-flight heuristic | "This sounds like speech — results may be poor." | Continue anyway / cancel |
| Low quality / live | pre-flight + `presence.bleed_suspected` | "Live recordings can separate less cleanly." | Continue with "rough" labels; suggest studio version |
| Cap reached | API 402-style error | "You've used this month's analyses." | Practise existing songs (always free); upgrade; see reset date |
| Offline | `navigator.onLine` + fetch failures | "You're offline." | Queue import ("waiting for connection"); practise cached songs (v1 offline) |
| Vendor/pipeline failure | stage status `failed`/`fallback` | "Stems are unavailable right now; chords and beat are ready." | Retry later (no cap charge for failed runs) |

## Implementation notes (step 10, 2026-10-22)
- **Upload as built:** pick → SHA-256 in a Worker (`hash-wasm`, streamed) and local decode (Mediabunny → `decodeAudioData` ≤ 200 MB → "Preview after upload") in parallel → `GET /v1/uploads/lookup` (duplicate notice: Open it · Import anyway) → "Start practising": `POST /v1/songs`, `POST /v1/uploads`, then the practice page opens while parts upload in the background (3 in parallel, retries with backoff, expired signatures re-signed with `refreshParts`, waits for `online`) → `uploads.complete` → `POST /v1/analyses`. Offline at the click: `import.offline`, and the import starts when the connection returns.
- **Resume after reload:** the IndexedDB record holds the ids, the acknowledged parts with ETags and the File; on the next page load the missing parts are uploaded and nothing already acknowledged is sent again. Browsers that refuse to store a File in IndexedDB (Safari private browsing, Playwright's ephemeral WebKit: "Error preparing Blob/File data to be stored in object store") keep the record without it, and the practice page asks for the same file again (checked by size and SHA-256).
- **Pre-flight implemented:** too long (> 20 min) and too large (> 500 MB) block; very quiet (RMS < −35 dBFS), clipping (> 0.1 % of samples at full scale) and mostly silence (> 50 % of 100 ms windows below −50 dBFS) warn. Speech and live-recording detection (`import.speech`, `import.live`) are not implemented yet.
- **Record:** first supported of WebM/Opus, MP4/AAC, WebM, Ogg/Opus; processing off; level meter from an AnalyserNode; 4-beat count-in at 100 BPM with an optional click; review with `<audio>` then "Use this recording" (uploads as `source_kind: recording`).
- Local playback on import, the instant beat grid and the progressive practice screen are steps 11–12; until then "Start practising" opens a provisional page with the analysis' stage list, ETA and status.

## Implementation notes (step 12, 2026-10-22)
- VideoPane plays the URL import's own video (`songs.mediaUrl` kind `video`) muted, slaved to the audio clock. The YouTube IFrame fallback is **not built**: the IFrame API script needs `https://www.youtube.com` in `script-src` (owner decision on the CSP), and nothing in the UI sets `youtube` refs yet.

## Implementation notes (step 13, 2026-10-22)
- **Examples as built:** `pnpm examples:build [--out] [--id --title --artist --instrument --part --loop a-b] <file>…` runs the full analysis as the system user with the real workers, copies what practice reads to `assets/examples/{id}/{build}/`, suggests the loop (`scripts/examples/loop.ts`: 4 bars, 2 when bars exceed 3.2 s, the window with the most and surest notes, first and last bar excluded) and writes `apps/api/examples.json` (starting speed 70/80/80 % for just started/a few songs/returning). Owner's choice (2026-10-22): MUSDB18-HQ 30 s windows — **riff** Hollow Ground "Ill Fate" (97 BPM), **rhythm** Bobby Nobody "Stitch Up" (125 BPM, chordal), **bass line** "Stitch Up" bass (the only bass window of nine with a usable bass tab; six others fell back to chords only).
- **Flow as built:** `/start?step=instrument|level|screen|song&instrument&level` (SSR, answers in the URL and in the guest store). For a visitor, step 4 opens the example's own practice route `/songs/{example song id}/practice?loop&speed=70&mix=your-part&level=simplified&guide=true`; its `beforeLoad` lets a signed-out visitor in only for an example (`guest-entry.ts`) and the lazy guide shows the song card over the loading screen ("Play your part" is the audio gesture), then the coach marks (above the timeline) and, after a completed pass with playback stopped, "Save your progress?" (magic link → `/start/saved`). A signed-in learner's step 4 claims the example and opens it as their own song.
- **Pre-signup progress:** IndexedDB `splitune-guest` (profile, loops, players, sessions, attempts, corrections) behind the guest link; a `splitune.guest` localStorage marker flags it. Claimed by `/start/saved` and by the app shell on any signed-in page (`useClaimOnSignIn`); idempotent (loop ids, client session/attempt/op ids, song dedupe key).
- **Defaults by instrument/level:** level toggle simplified (guitar beginners) / roots (bass beginners) / chords only ("Something else"), mix "Your part loud", starting speed from the example (also stored as this device's default speed), example part by level (rhythm for guitar beginners, riff otherwise). The practice route gained `?level=`; resume waits for the beat grid when `?loop=` is set (it used to drop the loop if the song arrived first).
- Example songs never show "Is this your guitar?" and never request their (non-existent) source audio.

## Open questions
- Will learners supply a file after pasting a video link (QU1)? Measure file-step drop-off from the first prototype.
- Whether Web Share Target / Files integration on iPadOS is reliable enough to matter before native.
- Exact duration/size limits once P4 cost data is in.

## Sources
Cross-linked: `users/user-journeys-and-flows.md` (journeys, alternate flows), `ux/onboarding-retention-motivation.md` (aha targets), `legal/youtube-copyright-and-platform-policy.md` §2 (RMF, IFrame API controls), Designs A/B/E, `product/recommendations-and-decisions.md` D1, D6, `product/feature-roadmap-beginner-to-intermediate.md` M1, M2, M12–M14.
