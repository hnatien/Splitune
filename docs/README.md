# Splitune docs

Splitune is a web-first practice app for people learning an instrument. A learner brings a song (file, recording or URL); Splitune isolates their part, works out what is played (beats, chords, guitar/bass tab, piano, drums) and wraps it in practice tools: bar-snapped loops, slow-down, count-in, stem mixer, confidence-aware notation and pedal control.

**Where things stand:** the MVP is built and deployed in **personal mode** (Railway Hobby for the app and Postgres, Cloudflare R2 for files, ML and Node workers on the owner's Mac or Windows PC, mock billing, no copyright gating — `specs/25-personal-mode.md`). v1 work is under way. What is done, partial or not started: **[`status.md`](status.md)**.

## What's in here
| Folder / file | What it is | Read it when |
|---|---|---|
| [`status.md`](status.md) | One table: every step, its state, open owner checks | You want to know what exists |
| [`specs/`](specs/README.md) | The build specs `00`–`28`: stack, architecture, contracts, ML pipeline, music algorithms, audio engine, UI, ops | You build or change something |
| [`steps/`](steps/README.md) | One prompt per implementation step (`s01`–`s23`), each run by a fresh agent session | You start a step |
| [`progress-log.md`](progress-log.md) | What each step actually built, decided, verified and left open, newest at the bottom | You need the history or a step's details |
| [`research/`](research/README.md) | The evidence behind the specs (2026-10-20): ML models, users, UX, market, legal, decisions D1–D13 | You need to know *why* |

## Numbers and names
Three numbering systems coexist. They look alike, so check which one a reference uses.

| You see | It means | Lives in |
|---|---|---|
| `06 §4`, `doc 26 §5`, "spec 07" | Spec number and section | `specs/06-ml-pipeline-service.md` §4 |
| `s18`, "step 18", "prompt 18", branch `impl/18-…` | Implementation step | `steps/s18-v1-practice-depth.md` |
| "Step 18", "18a", "18b", "18c" as a **progress-log heading** after 2026-10-23 | An ad-hoc piece of work, not step s18 | Mapped to steps in [`status.md`](status.md#ad-hoc-work) |
| `D1`–`D13` | Product decisions | `research/product/recommendations-and-decisions.md` |
| `P1`–`P7`, `P2g` | Prototypes and evaluations with gates | `specs/08-evaluation-harness-and-prototypes.md`; results in `services/ml/eval/results/` |
| `V1`–`V13` | v1 features | `specs/21-v1-features.md` |

Spec numbers are stable: code comments cite them hundreds of times, so a spec is never renumbered.

**Paths in backticks:** a path starting with a repo folder (`docs/`, `apps/`, `packages/`, `services/` …) is from the repo root; a bare file name (`25-personal-mode.md`) is in the same folder as the doc you are reading; any other path (`specs/07-…`, `research/ml/…`) is relative to `docs/`.

## When docs disagree
1. `specs/25-personal-mode.md` — the current mode; overrides everything below.
2. `specs/README.md` — binding rules and the spec index.
3. The spec(s) a step names.
4. `research/` — evidence and rationale, as of 2026-10-20.

## Start here
| You are | Read |
|---|---|
| An agent starting a step | `steps/00-shared-context.md`, then your `steps/sNN-….md` |
| Anyone new | this page → `status.md` → `specs/25-personal-mode.md` → `specs/README.md` |
| Full-stack engineer | `specs/` 00–05, 14, 23 |
| ML engineer | `specs/08`, `06`, `05`, `07`; `research/ml/pipeline-overview.md` |
| Client / audio engineer | `specs/10`, `11`, `12`, `24` |
| Designer | `specs/26`, `27`, `28` |
| Owner | `status.md` and the "needs the owner" items in `progress-log.md` |

## Keeping docs tidy
- A spec changes in the same commit as the code that changes it; record build-time deviations under the spec's "Implementation notes".
- A new step gets the next free `sNN-<name>.md` in `steps/` (a letter suffix such as `s15a` slots one between existing steps) and a row in `steps/README.md`.
- Each finished piece of work appends an entry to `progress-log.md` and updates its row in `status.md`.
- Mockups and screenshots go in `specs/assets/<step>/`; architecture decisions in `specs/adr/NNN-title.md`.
