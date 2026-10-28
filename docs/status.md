# Status

What is built, as of **2026-10-24**. Details, verification and open items for each row are in `docs/progress-log.md` (search for the heading in the last column). Update the row when a step finishes.

**Summary:** the MVP (s01–s17) is built and deployed; a few owner checks are still open. v1 has started: piano notes, the guitar/bass Notes view and the vocal Melody view are done; practice depth (s18), drums, mic scoring and the accuracy steps are not.

## Steps
| Step | What | State | Still open | Progress-log heading |
|---|---|---|---|---|
| s01–s06 | Scaffold, contracts, database + storage, API + auth, music-core, ML worker + eval harness | Done | — | Step 01 … Step 06 |
| s07 | Open-model separation, stem post, P1 | Partial | P1 listening ratings | Step 07 |
| s08 | Notes, chords, finalize, P2/P6 | Done | P2/P6 re-run on owned songs (in-sample numbers) | Step 08 |
| s09 | Orchestration, SSE progress, URL import | Done | — | Step 09 |
| s09c | Workers on a Windows PC with CUDA | Done | — | Step 09c; Production workers on the Windows PC |
| s10a | Design system and UI kit | Done | — | Step 10a |
| s10 | Web shell, import, library | Done | — | Step 10 |
| s11 | Audio engine | Done | — | Step 11 |
| s12 | Practice screen and notation | Done | — | Step 12 |
| s13 | Onboarding, example songs, PWA | Done | — | Step 13 |
| s14 | Mock billing and plans | Done | — | Step 14 |
| s15 | Lifecycle, analytics, observability | Done | — | Step 15 |
| s15a | UI polish and design QA | Partial | Usability round, real devices | Step 15a |
| s16 | Compatibility, accessibility, hardening (MVP gate) | Partial | Real devices | Step 16 |
| s17 | Deploy (Railway, R2, workers) | Partial | Signed-in device smoke test, real sleep/wake | Step 17 |
| s18 | v1 practice depth: speed trainer, transpose/capo, fingerings, tuning presets, sections, record-and-compare, metronome | Not started | Groundwork only: `SpeedTrainer` contract, `speed_trainer` flag, `suggestCapo`, manual capo input, `alt_fingerings` | — |
| s19 | v1 piano and drums | Partial | Piano: wait mode, levels (pipeline gaps moved to s24; drums moved to s25) | Step 17d; Step 18 (piano notes); Step 18a |
| s20 | v1 mic, offline, export, native | Not started | — | — |
| s21 | Guitar/bass Notes view | Done | E2E run; real devices; tuning option in the Worker | Step 18b (Phase 1 design, Phase 2 build) |
| s22 | Guitar accuracy | Not started | Needs the owner's songs, tabs and time budget | — |
| s23 | Vocal accuracy | Not started | Needs the owner's OK on plan and time budget | — |
| s24 | Piano accuracy | Partial | Phases 0–6 built and measured (P2p); owner's songs end to end and Notes/Staff screenshots pending the owner | Step 24 |
| s25 | Drums end to end | In progress | Phases 0–1 done: research re-check, P2d test set (48 items) and harness, ADTOF baseline + YourMT3+ reference, `notes.drums` stage (not scheduled); waiting on the owner (stop point 2) | Step 25 (Phases 0–1) |

## Ad-hoc work
Work done without a step prompt. Its progress-log headings use their own numbers, which do **not** match the step numbers above.

| Progress-log heading | What it was | Belongs to |
|---|---|---|
| Step 07b | Separation inference settings and time budget | s07 follow-up |
| Step 09b | Storage moved to Cloudflare R2 | s09 follow-up |
| 12b–12d (branches only, no log entry) | Chord-strip overflow, ML worker Ctrl-C, dev dashboard | s12 follow-ups |
| Step 17c | Guitar practice redesign: tab first, one transport | Between s17 and v1 |
| Step 17d | Piano chord chart, keyboard voicings, key spelling | s19 (piano) |
| Step 18 | Piano notes: Transkun stage, hand split, falling-notes roll | s19 (piano) |
| Step 18a | Piano grand staff | s19 (piano) |
| Step 18b | Guitar and bass Notes view | s21 |
| Step 18c | Vocal Melody view (merged into `dev`) | Prerequisite of s23 |
| Fix: … entries | Stage-start deadlock, production sign-in (SMTP) | — |
