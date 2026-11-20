# Status

What is built, as of **2026-11-21**. Details, verification and open items for each row are in `docs/progress-log.md` (search for the heading in the last column). Update the row when a step finishes.

**Summary:** the MVP (s01–s17) is built and deployed; a few owner checks are still open. v1: piano notes, the guitar/bass Notes view, the vocal Melody view, drums (s25), guitar and piano accuracy (s22, s24, steps 26–27) and the separation work (s28, s29, s40a) are on `dev`. The redesign's s32–s39 and the black-and-white system (s46) are merged into `dev`; s41a is in progress, s40b–s45 are not started (s44 deferred). Not started outside the redesign: s18 (most of it), s20, s23 and s30.

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
| s22 | Guitar accuracy | Done | Owner's own songs (public data only so far); end-to-end check in the app; `chain_sw_becruily` separator (GPU crashed) | Step 22 |
| s23 | Vocal accuracy | Not started | Needs the owner's OK on plan and time budget | — |
| s24 | Piano accuracy | Partial | Phases 0–6 built and measured (P2p); owner's songs end to end and Notes/Staff screenshots pending the owner | Step 24 |
| s25 | Drums end to end | Partial | Merged into `dev`. Phases 0–6 built: P2d (onset F1 0.838 vs 0.793 baseline), `notes.drums` behind `v1.drums`, drum score/levels/alphaTex, drum grid and staff views, gate pass (0.80) + confidence floor 0.75, local end to end done. Open: the owner's excerpts on the Mac, grid/staff screenshots, `v1.drums` on in production after deploy, DrumSep kit split (moved to s30) | Step 25 |
| s28 | Separation evaluation on real-song conditions | Partial | Merged into `dev`. Listening ratings pending the owner | Step 28 |
| s29 | Separation improvements | Partial | Merged into `dev`. Vocals head (Leap v1) and SW shift averaging proposed, pending the owner's listening session; Phase 7 (DrumSep 5- vs 6-stem) skipped, left to s30 | Step 29 |
| s30 | Drum-kit pieces: kick/snare/toms/cymbals stems, piece channels, lane focus | Not started | Phase 4 (UI) needs s40b on `dev` and a doc 27 design first | — |
| s31a | Redesign: Night Rehearsal specs (docs 26–28 rewritten; 12, 21 and the UI rule updated) | Done | Owner may revisit the deviation register (26 §4.9) | Step s31a |
| s31b | Redesign: step prompts s32–s45 | Done | — | Step s31b |
| s31c | Redesign: mockup harness (reference renders and fidelity probe) | Done | — | Step s31c |
| s32 | Redesign: tokens, fonts, practice perf baseline | Done | Merged into `dev` (`1036959`); perf baseline `fe7b099` from the unchanged screen. Owner: legibility check (Foundations/Fonts › Legibility) | Step s32 |
| s33 | Redesign: base components on Night Rehearsal | Done | Merged into `dev` (`7e0f4db`). G2 next: the owner reviews `redesign/.renders/s33/index.html`. Five tokens added at the owner's request (`--primary-hover`, `text-button-lg`, `shadow-capsule`, `rounded-5xl`, `shadow-play`) | Step s33 |
| s34 | Redesign: app shell, ⌘K palette, Library and Add song | Done | Merged into `dev` (`b02b0ad`). G4 next (devices, both themes; place of "What works best?"). Fidelity 0 unexplained; budget 304.8 KB with the entry-chunk setting. E2E smoke blocked by a sign-up reset that predates s34 | Step s34 |
| s35 | Redesign: practice core (five regions, notation restyle, progressive state, new keymap) | Done | Merged into `dev` (`0724b61`). G4 next (devices, both themes; pass prompt after every pass, inspector drawer during Getting ready). Fidelity 0 unexplained (148 comparisons); budget 309.2 KB (from 304.2); perf: forced layout 604 → 0 desktop, 606 → 6 tablet, latencies within baseline, the play-press frame within the baseline's spread. Gaps: Stop analysing (no cancel API), Pick another re-runs the whole analysis, chord-name confidence overlay, "Use as default for {part}" | Step s35 |
| s36 | Redesign: home, auth, onboarding, pricing, settings IA, system states | Done | Merged into `dev` (`f2eef5a`). G4 next (devices, both themes). Fidelity 0 unexplained; budget 304.2 KB; Single-key switch left for s35; known: WebKit story-run crash (rarer, no longer hangs), forced-colours song-card tile (s34) and practice e2e (s35) | Step s36 |
| s37 | Redesign: speed ladder (V1) and the finished Loop tab | Done | On `dev` as one commit (`bd107d7`). G4 next (devices, both themes). `v1.speed_trainer` on; ladder off for new loops by default (owner); budget 311.4 KB (from 309.1). Owner: the production data check, and the flag row if one overrides the default. Gaps: phone Tools sheet card (s43) | Step s37 |
| s38 | Redesign: Fix mode (unsure-spot queue, alternatives in frequencies, audition, desktop editor) | Done | On `dev` as one commit (`24d77af`). G4 next (devices, both themes; placement of Replace all and Show original; the synth by ear). Budget 312.2 KB (from 311.4); Chromium e2e and stories green. Gaps: selection band and wash still amber (needs `ui/waveform-timeline` and `packages/notation`), no "?" tap on notes outside Fix mode, tablets and phones keep the editor sheet until s43, WebKit / Firefox e2e not run on this PC | Step s38 |
| s39 | Redesign: Progress tab and the library's progress strips from `GET /v1/progress` | Done | On `dev` as one commit (`88d7d79`). G4 next (devices, both themes; placement of the Warm up chip, which has no mockup). Contract change (owner-approved): sessions, session ids, clip names, last attempt, `days` window. Budget 312.4 KB (from 311.8). Gaps: guests see only unsent passes on the tab; unnamed clips are reused for new loops, so their history can span ranges; no analytics event for the success metric (needs a contracts change) | Step s39 |
| s40a | Redesign: keep all separated stems (backend) | Done | Merged into `dev` (`5ded3d0`) after G3 on the PC: target identical, tagger veto and tagger-only bleed check off, `models` tests and full `eval:regression` pass, parallel stem encodes keep a bass analysis at +15 % (≈ +2 % vs `dev`). Owner: update the Mac worker (`git pull`, `uv sync`, `pnpm workers restart`); listening session `s40a-g3-2026-11-20` by ear | Step s40a (done) |
| s41a | Redesign: sections backend (allin1 stage + part fallback) | In progress | Built on `impl/s41a-sections` (`d944b61`); review fixes left, then G3 (island install, weights, timing, 3 songs by ear, `eval:regression`) before merge | Step s41a (in progress) |
| s40b | Redesign: every stem in the mixer, presets, Rough, Click and "Hear the chords", phone mini-mixer | Not started | — | — |
| s41b | Redesign: section chips, loop a section, rename | Not started | Needs s41a's sections (fixtures until it merges) | — |
| s42 | Redesign: beat pulse, vibrate, tap-along sound delay | Not started | — | — |
| s43 | Redesign: Stand view, phone glance and Tools sheet, pedal wizard | Not started | — | — |
| s44 | Redesign: notify when ready (Web Push) | Deferred | Deferred by the owner; VAPID keys are an owner action | — |
| s45 | Redesign: hardening and QA (WCAG gates, perf gate, visual matrix, G5/G6) | Not started | Visual-regression baselines still predate s46 | — |
| s46 | Redesign: black-and-white system after OpenAI's interface language (tokens, Figtree, base components, shells, every screen, Home art) | Done | Merged into `dev` (`368fb17`). Every screen area is restyled and docs 26–28 match the code; the Night Rehearsal mockups are history (structure only). The Home art is the owner's generated set (`docs/home-art.md`). Open: visual-regression baselines (`e2e:visual`) not regenerated; the WebKit story run and e2e not run on this PC; real-device checks | Step s46 |

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
| Username and password sign-in | Username + password replaces the magic link; Mailpit removed from Docker Compose and the Railway IaC (the live Railway service is removed separately) | Personal mode (25) |
| Step 26 | Piano accuracy follow-up: candidate screen, Transkun pop fine-tune on the solo-piano path | s24 follow-up |
| Step 27 | Guitar accuracy follow-up: P2g with intervals, note ends, bends, half/full-step-down detection; string-cue candidates and `chain_sw_becruily` measured, not shipped | s22 follow-up |
