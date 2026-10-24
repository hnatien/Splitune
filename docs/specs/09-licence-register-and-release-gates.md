---
title: Model licence register and release gates
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Model licence register and release gates

Implements D8 (`research/product/recommendations-and-decisions.md`) as code: every model, dataset and copyleft library Splitune touches has a provenance record, and CI blocks a release that would ship a red component or an amber one without recorded counsel sign-off.

> **Personal mode is current (`25-personal-mode.md`): copyright and licensing are out of scope.** The register below is kept **only as a provenance and reproducibility record** (what model, which weights hash, trained on what, evaluated how). The active profile is `personal`, which allows every tier, so CI performs schema validation and weights-hash checks only; tier gating, counsel sign-off, dependency-licence allow-lists and banned-package rules are the dormant commercial profile.

## TL;DR
- **Register = YAML files in `compliance/register/`** (one per model, dataset or notable library), validated by a JSON Schema and reviewed in PRs like code.
- **Pipeline config references models only by register id.** The ML service refuses to load weights whose SHA-256 doesn't match the register entry.
- **CI gate (`pnpm compliance:check`, also a required GitHub check):** fails on red in any `production` profile, on amber without a `signoff` block, on unknown weights hashes, and on new npm/PyPI dependencies with copyleft or unknown licences not on the allow-list.
- **Runtime stamping:** each artefact's `models[]` carries `register_tier` (`05-analysis-schema.md`), so a later licence change can find every affected user artefact.

## Record format (`compliance/register/models/basic-pitch.yaml`)
```yaml
id: basic-pitch
kind: model                    # model | dataset | library | vendor
name: Basic Pitch
version: "0.4.0"               # latest release (2024-08-16); run via the bundled nmp.onnx on ONNX Runtime, TF removed
repo_url: https://github.com/spotify/basic-pitch
code_spdx: Apache-2.0
weights:
  licence: "bundled in Apache-2.0 repo (not separately stated)"
  url: https://github.com/spotify/basic-pitch
  sha256: "<filled when the weights are vendored>"
training_data:
  - { name: MAESTRO, licence: CC-BY-NC-SA-4.0, commercial_ok: false }
  - { name: GuitarSet, licence: CC-BY-4.0, commercial_ok: true }
eval:
  - { dataset: GuitarSet, metric: onset_f1, value: 79.0, date: 2026-10-20, source: research/ml/transcription-guitar-and-bass-tabs.md }
tier: amber                    # green | amber | red
tier_reason: "NC data in training mix; weights licence not separately stated"
used_in: [notes.guitar, notes.bass, notes.vocals, client.mic_fallback]
profiles: [research, staging]  # add 'production' only after signoff
signoff:                       # required for amber in production
  counsel: null                # name of counsel / firm
  date: null
  memo_ref: null               # path in the private legal drive, not in git
author_contact:
  asked: 2026-11-01            # date we emailed authors (QM9)
  answer: null
reviewer: ml-lead
reviewed: 2026-10-20
```

The seed register mirrors the D8 snapshot:

| Tier | Seed entries |
|---|---|
| Green | beat-this, whisper, spleeter, beatnet, pm2s, music-core (in-house fret DP, quantize, key), inhouse-drums-crnn (when trained on E-GMD/GMD/Slakh only), signalsmith-stretch, alphatab (MPL-2.0 → file-level copyleft obligations recorded), osmd, music21, partitura, onnxruntime |
| Amber | basic-pitch, transkun, aria-amt (weights unverified), msst-checkpoints (no weight licence stated), hft, consonance-ace, btc, allin1, rmvpe, rosvot, crepe, swiftf0, pesto (LGPL-3.0), efficientat, panns-inference, passt, htdemucs, htdemucs_6s, community RoFormer/SCNet checkpoints, kong-piano, sam-audio, verovio (LGPL) |
| Red | muscriptor (weights CC-BY-NC-4.0), omar-rq features (CC-BY-NC-SA), madmom models, adtof, umxl, mert, essentia models, midi2scoretransformer, tabcnn repo, yourmt3, rubberband (GPL build), chordino, musescore; datasets MUSDB18-HQ, MoisesDB, MAESTRO, MedleyDB, MDB Drums, PianoVAM, PIG as **training** sources |

Datasets get the same record with `kind: dataset` and a `use: [eval_only | training_ok]` field. Vendors (AudioShake, Music.AI, LALAL.AI) get `kind: vendor` with contract fields: `retention_days`, `trains_on_customer_content`, `per_user_caching_allowed`, `dpa_signed`, `contract_ref`.

## Enforcement

### 1. Pipeline config binds to register ids
`services/ml/config/pipeline.production.yaml`:
```yaml
stages:
  beats:      { model: beat-this,   variant: final0 }
  separation: { provider: vendor,   vendor: audioshake, fallback: spleeter }
  notes.guitar: { model: basic-pitch }
  chords:     { model: consonance-ace }
```
At start-up the service loads each referenced record, verifies `sha256` of the weights file it is about to load, and refuses to start if the tier is not allowed for the active profile.

### 2. CI gate (`compliance/check.ts`, run with `pnpm compliance:check`)
Fails when:
1. A record doesn't validate against `compliance/register.schema.json`.
2. Any pipeline config for profile `production` references a `red` record, or an `amber` record without `signoff.counsel` and `signoff.date`.
3. A model file under `services/ml/weights/` or in the weights bucket manifest has no matching `sha256` in the register.
4. A dataset with `use: eval_only` appears in any training config (`services/ml/train/**.yaml`).
5. A new dependency's licence is not on the allow-list. JS: `pnpm licenses list --json --prod`; Python: `uv pip list --format json` + `pip-licenses --format=json`. Allow-list: MIT, Apache-2.0, BSD-2/3-Clause, ISC, 0BSD, MPL-2.0 (with file-level note), Zlib, Unicode, CC0-1.0, Python-2.0. Anything else (GPL, AGPL, LGPL, unknown) needs an explicit exception record.
6. A client bundle includes an LGPL/GPL module (checked on the production web build's module graph).

### 3. ML-BOM
CI converts the register into a **CycloneDX 1.7 ML-BOM** (`cyclonedx-bom` for Python deps + a small script that maps register records to `modelCard` components) and attaches it to each release. SPDX 3.x AI/Dataset profiles are an alternative once 3.1 is final.

### 4. Release checklist hook
The release workflow (`19-deployment-and-operations.md`) prints the tiers of everything in the deploy and attaches the register snapshot (git sha) to the release notes.

### 5. Re-tiering playbook
If a component's licence changes or counsel withdraws sign-off:
1. Change the record's tier in a PR (CI now fails for production).
2. Swap the stage to its fallback via config (provider interfaces make this a config change).
3. Query artefacts by `models[].model_id` + `register_tier` to list affected users; offer "re-analyse" with the new model; never delete user edits.

## Copyleft obligations to track
| Component | Licence | Obligation | Where it matters |
|---|---|---|---|
| alphaTab | MPL-2.0 | Publish modifications to alphaTab's own files; app code unaffected | Web and any WebView-based native app; keep alphaTab unmodified or upstream patches |
| PESTO | LGPL-3.0 | Allow relinking; problematic for static linking on iOS | Prefer SwiftF0 (MIT) on device unless counsel clears (QL8) |
| Verovio | LGPL-3.0 | Same as above | Only if notation view needs it (v1 piano) |
| Rubber Band | GPL-2.0-or-later | Commercial licence required for closed or app-store distribution | Only if P7 fails |

## Open questions
- Who is the named counsel for amber sign-offs, and where are memos stored (outside git)?
- Should the register live in a database once the team grows? Keep YAML in git until >100 entries; Git history is the audit log.

## Sources
Cross-linked research: `research/ml/datasets-metrics-and-licensing.md` (three-layer framework, provenance record fields, dataset licences), `research/product/recommendations-and-decisions.md` D8 (register snapshot), `research/ux/music-display-ui.md` (alphaTab, Verovio licences), `research/ml/playback-time-stretch-pitch-shift.md` (Rubber Band licensing), `research/ml/transcription-vocals-melody.md` (PESTO LGPL).
