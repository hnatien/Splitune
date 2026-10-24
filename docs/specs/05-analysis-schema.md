---
title: Analysis artefact schema (the confidence contract)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Analysis artefact schema (the confidence contract)

This doc turns the proposal in `research/ml/pipeline-overview.md` §5 into a concrete, versioned contract between the ML pipeline (Python), the orchestrator and API (TypeScript), and every client renderer. It is the single most cross-cutting interface in Splitune: the practice screen, corrections, fallback logic, metrics and exports all read it.

## TL;DR
- **One source of truth:** Zod 4 schemas in `packages/contracts` → JSON Schema (`z.toJSONSchema`) → Pydantic v2 models generated for `services/ml`. CI fails if generated code drifts (see `02-repo-tooling-and-ci.md`).
- **Times are seconds on the decoded-PCM timeline.** Note events stay in seconds. Bar/beat/tick coordinates are added by a separate, re-runnable quantize stage so a user can fix the beat grid without re-running transcription.
- **Every entity carries calibrated confidence; every artefact carries `model_id@version` and `schema_version`.** Corrections are an overlay keyed to the artefact version, never an in-place edit.
- **Artefacts are split by stage** so the client can render progressively: `beats` (≤10 s) → `presence` + `stems` → `chords`/`sections` → `notes.*` → `tab.*` + `summary`.
- **`summary.recommended_view` drives the global fallback** (tab → notation → roll → chords-only) per instrument.

## Principles
| # | Rule | Why |
|---|---|---|
| S1 | Canonical time = seconds (float64, ms precision) from sample 0 of the decoded 44.1 kHz PCM used to compute `audio_hash` | Every model resamples differently; one timeline avoids drift between stems, notes and the playback clock |
| S2 | Quantization is a separate artefact (`tab.*`), never baked into `notes.*` | `research/ml/pipeline-overview.md` §5 "keep both coordinates" |
| S3 | `confidence` is calibrated [0,1]; `confidence_raw` keeps the model posterior | Shading needs calibrated values (`research/ml/pipeline-overview.md` §5 "calibrate before display") |
| S4 | Each artefact is immutable once written; a re-run writes a new `artefact_version` | Corrections and saved loops must never silently move (model-version pinning) |
| S5 | Corrections are ops in a separate document keyed to `(artefact_id, artefact_version, entity_id)` | "Corrections are versioned data… never overwrite model output" |
| S6 | Entity IDs are stable within an artefact version (`n000123`, `c0042`, `b0310`) | Ops and "report wrong note" need addressable entities |
| S7 | All artefacts are private to `user_id` and live under the user's storage prefix | D7; no cross-user cache |
| S8 | Unknown fields are ignored by readers; a **major** `schema_version` bump means readers must refuse | Lets the pipeline add fields without breaking old clients |

## Artefact set and delivery order

| Artefact | File (under `u/{user_id}/a/{analysis_id}/v{n}/`) | Producer stage | Typical availability (Prototype 4 gates) | Size (4-min song, gzip, estimate) |
|---|---|---|---|---|
| `manifest` | `manifest.json` | orchestrator | immediately; updated per stage | <5 KB |
| `beats` | `beats.json` | Beat This! on mixture | ≤10 s | ~15 KB |
| `presence` | `presence.json` | tagger + stem-energy gate | after separation | ~5 KB |
| `stems` | `stems.json` + `stems/{stem_id}.{m4a|webm}` | separation provider | after separation | JSON <5 KB; AAC-LC 160 kb/s ≈ 4.8 MB per stem (default); Opus 96 kb/s ≈ 2.9 MB (optional variant) |
| `sections` | `sections.json` | All-In-One (v1, amber) | after separation | <5 KB |
| `chords` | `chords.json` | chord model + fusion | after separation | ~20 KB |
| `notes.{instrument}` | `notes/{instrument}.json` | per-stem transcriber | ≤90 s p50 total | 50–300 KB |
| `tab.{instrument}` | `tab/{instrument}.json` | `music-core` quantize + fret DP | right after notes | 50–300 KB |
| `render.{instrument}` | `render/{instrument}.alphatex` (+ `.musicxml` on export) | `music-core` exporter | right after tab | 20–100 KB |
| `summary` | `summary.json` | orchestrator finalize step | last | <5 KB |
| `corrections` | Postgres `correction_ops` table (not object storage) | user edits | any time | small |

`render.*` is derived and can be deleted and regenerated at any time; it is cached only to make first paint fast on slow devices.

## Common types (excerpt of `packages/contracts/src/analysis/common.ts`)

```ts
import { z } from "zod";

export const SCHEMA_VERSION = "1.0.0";

export const ModelRef = z.object({
  model_id: z.string(),          // e.g. "beat_this/final0"
  version: z.string(),           // e.g. "1.1.0"
  weights_sha256: z.string().length(64),
  provider: z.enum(["self_hosted", "vendor"]),
  register_tier: z.enum(["green", "amber", "red"]), // copied from the licence register at run time
});

export const Confidence = z.object({
  confidence: z.number().min(0).max(1),      // calibrated
  confidence_raw: z.number().optional(),     // model posterior / activation
});

export const ArtefactHeader = z.object({
  schema_version: z.literal(SCHEMA_VERSION).or(z.string().regex(/^1\.\d+\.\d+$/)),
  artefact: z.string(),                      // "beats" | "chords" | "notes.guitar" | ...
  artefact_version: z.number().int().positive(),
  analysis_id: z.string().uuid(),
  user_id: z.string(),
  audio_hash: z.string(),                    // sha256 of decoded PCM (see 03-data-model-and-storage.md)
  sample_rate: z.literal(44100),
  duration_s: z.number().positive(),
  models: z.array(ModelRef),
  params: z.record(z.string(), z.unknown()), // exact params used; part of the cache key
  created_at: z.string().datetime(),
});

export const StageStatus = z.enum(["pending", "running", "done", "failed", "fallback", "skipped"]);
export const Instrument = z.enum(["guitar", "bass", "piano", "drums", "vocals", "other"]);
export const ConfidenceBand = z.enum(["high", "medium", "low"]); // thresholds per model in calibration file
```

## Artefact schemas

### `manifest`
```ts
export const Manifest = ArtefactHeader.extend({
  artefact: z.literal("manifest"),
  source_kind: z.enum(["upload", "recording", "url", "example", "licensed"]),
  requested_instrument: Instrument,
  pipeline_version: z.string(),              // git sha or semver of services/ml
  stages: z.record(z.string(), z.object({    // key = stage name
    status: StageStatus,
    started_at: z.string().datetime().optional(),
    finished_at: z.string().datetime().optional(),
    artefact_path: z.string().optional(),
    error_code: z.string().optional(),       // machine code, never raw exception text
    fallback_reason: z.string().optional(),
  })),
  progress: z.number().min(0).max(1),
});
```

### `beats`
```ts
// bar_index is 0-based from the first downbeat (pickup beats get -1); beat_in_bar is 1-based.
export const Beat = z.object({
  id: z.string(), t: z.number(), activation: z.number().min(0).max(1),
  is_downbeat: z.boolean(), bar_index: z.number().int(), beat_in_bar: z.number().int(),
});
export const Beats = ArtefactHeader.extend({
  artefact: z.literal("beats"),
  beats: z.array(Beat),
  bpm: z.number(),                            // median inter-beat interval
  bpm_curve: z.array(z.tuple([z.number(), z.number()])).optional(), // (t, bpm) for drifting live takes
  meter: z.object({ numerator: z.number().int(), denominator: z.number().int() }),
  tempo_octave_ambiguous: z.boolean(),        // drives the half/double toggle (M7)
  first_downbeat_t: z.number(),
});
```

### `presence`
```ts
export const Presence = ArtefactHeader.extend({
  artefact: z.literal("presence"),
  instruments: z.array(z.object({
    instrument: Instrument,
    present_prob: z.number().min(0).max(1),
    activity: z.array(z.object({ t0: z.number(), t1: z.number(), energy_ratio: z.number() })),
    bleed_suspected: z.boolean(),
    subtype: z.enum(["acoustic_guitar", "electric_guitar", "piano", "synth_keys", "organ"]).optional(),
  })),
});
```

### `stems`
```ts
export const Stems = ArtefactHeader.extend({
  artefact: z.literal("stems"),
  stems: z.array(z.object({
    stem_id: z.string(),                      // "guitar", "mix_minus_guitar", "drums", ...
    kind: z.enum(["isolated", "mix_minus", "residual"]),
    instrument: Instrument.optional(),
    provider: z.string(),                     // personal: "htdemucs_6s" | "htdemucs_ft" | "bs_roformer:<ckpt>" | "mel_roformer:<ckpt>" | "scnet_xl"; commercial: "audioshake" | "musicai" | "lalal" | "spleeter"
    files: z.array(z.object({ codec: z.enum(["opus", "aac"]), container: z.enum(["webm", "mp4"]), path: z.string(), bitrate_kbps: z.number() })),
    loudness_lufs: z.number(),                // integrated, EBU R128
    gain_to_unity_db: z.number(),             // applied only while soloing, so solo levels feel equal; the mix itself uses one shared gain
    energy_ratio_to_mix: z.number(),
    quality_hint: z.enum(["good", "rough"]),
    empty: z.boolean(),                       // hidden in mixer (M4 "hide empty stems")
  })),
  alignment_offset_samples: z.number().int(), // vendor stems re-aligned to the mixture timeline
  mix_gain_db: z.number(),                    // ONE gain applied to every stem (mixture measured to −14 LUFS) so relative balance is preserved
});
```
Every encoded file is verified for exact decoded length and zero offset against the PCM reference (AAC encoder priming and Opus pre-skip can shift stems). `mix_minus_*` is computed server-side as mixture − isolated stem (D2) after sample alignment, so the client never has to subtract.

### `sections`
```ts
export const Sections = ArtefactHeader.extend({
  artefact: z.literal("sections"),
  segments: z.array(z.object({ id: z.string(), t0: z.number(), t1: z.number(),
    label: z.enum(["intro", "verse", "prechorus", "chorus", "bridge", "solo", "inst", "outro", "break", "unknown"]),
    boundary_confidence: z.number().min(0).max(1) })),
});
```

### `chords`
```ts
export const ChordSegment = Confidence.extend({
  id: z.string(), t0: z.number(), t1: z.number(),
  label: z.string(),                          // Harte syntax, e.g. "A:min", "G:7", "N"
  bass: z.string().optional(),                // e.g. "C" for slash chords
  top_k: z.array(z.object({ label: z.string(), prob: z.number() })).max(5),
  beat_aligned: z.boolean(),
});
export const Chords = ArtefactHeader.extend({
  artefact: z.literal("chords"),
  vocabulary: z.enum(["majmin", "sevenths"]),
  segments: z.array(ChordSegment),
  key: z.object({ tonic: z.string(), mode: z.enum(["major", "minor"]), confidence: z.number() }),
  inputs_fused: z.array(z.enum(["mixture", "no_drums", "bass_root"])),
});
```
Default display is majmin; the `sevenths` artefact is written alongside when the model supports it (D4).

### `notes.{instrument}` (pitched instruments)
```ts
export const Note = Confidence.extend({
  id: z.string(),
  onset_s: z.number(), offset_s: z.number(),
  pitch_midi: z.number().int().min(21).max(108),
  velocity: z.number().int().min(1).max(127).optional(),
  bend_cents: z.array(z.tuple([z.number(), z.number()])).optional(), // (t offset s, cents)
  stem_id: z.string(),
});
export const Notes = ArtefactHeader.extend({
  artefact: z.string().regex(/^notes\.(guitar|bass|piano|vocals|other)$/),
  instrument: Instrument,
  notes: z.array(Note),
  f0: z.object({ hop_s: z.number().positive(), hz: z.array(z.number()), voicing_prob: z.array(z.number()) }).optional(), // vocals; 10 ms hop today
});
```

### `notes.drums`
```ts
export const DrumHit = Confidence.extend({
  id: z.string(), onset_s: z.number(),
  class5: z.enum(["kick", "snare", "hihat", "toms", "cymbals"]),
  gm_note: z.number().int(),                  // General MIDI percussion number
  velocity: z.number().int().optional(),
  approximate: z.boolean(),                   // true for hi-hat open/closed, crash/ride, tom choice
});
export const DrumNotes = ArtefactHeader.extend({
  artefact: z.literal("notes.drums"),
  instrument: z.literal("drums"),
  hits: z.array(DrumHit),
});
```

### `tab.{instrument}` (quantized and fretted; produced by `packages/music-core`)
```ts
export const TabEvent = z.object({
  note_id: z.string(),                        // FK into notes.* of the referenced version
  bar: z.number().int(), beat: z.number().int(), tick: z.number().int(), // PPQ 960; bar = beats.bar_index, beat 1-based
  duration_ticks: z.number().int(),
  quantize_residual_ms: z.number(),
  string: z.number().int().min(1).max(7).optional(),  // 1 = highest-pitched string
  fret: z.number().int().min(0).max(24).optional(),
  alt_fingerings: z.array(z.object({ string: z.number().int(), fret: z.number().int(), cost: z.number() })).max(3).optional(),
  hand: z.enum(["L", "R"]).optional(),        // piano (v1)
});
export const Tab = z.object({
  schema_version: z.string(), artefact: z.string(), analysis_id: z.string().uuid(),
  notes_ref: z.object({ artefact: z.string(), artefact_version: z.number().int() }),
  beats_ref: z.object({ artefact_version: z.number().int(), corrections_rev: z.number().int() }),
  ppq: z.literal(960),
  tuning_midi: z.array(z.number().int()),     // e.g. [64,59,55,50,45,40]
  capo: z.number().int().min(0).max(12),
  level: z.enum(["chords_only", "simplified", "as_transcribed", "roots", "full"]),
  fingering_mode: z.enum(["easiest", "as_played"]),
  events: z.array(TabEvent),
  music_core_version: z.string(),
});
```
`tab.*` is cheap to recompute, so the client recomputes it in a Web Worker whenever tuning, capo, level, fingering mode or the beat-grid corrections change. The server copy is the default for first paint and for native clients.

### `summary`
```ts
export const Summary = z.object({
  schema_version: z.string(), analysis_id: z.string().uuid(),
  per_instrument: z.array(z.object({
    instrument: Instrument,
    note_confidence_mean: z.number(), fraction_low_conf: z.number(),
    recommended_view: z.enum(["tab", "notation", "roll", "drum_grid", "f0", "chords_only"]),
    reasons: z.array(z.string()),             // machine codes shown as plain-language banners
  })),
  chords_confidence_mean: z.number(),
  rough_stems: z.array(z.string()),
});
```

## `recommended_view` rule (proposed, re-tune after Prototype 2)
Evaluated per instrument in the finalize step, in order:

1. Stage `notes.{instrument}` failed or was skipped → `chords_only` (reason `notes_unavailable`).
2. Instrument not in D11's notation set for the current release (MVP: guitar, bass) → `chords_only` (reason `notation_not_supported`).
3. `stems.quality_hint == "rough"` **and** `fraction_low_conf > 0.35` → `chords_only` (reason `rough_stem_low_conf`).
4. `fraction_low_conf > 0.5` → `chords_only` (reason `low_confidence`).
5. Otherwise the instrument default from D13: guitar/bass `tab`, piano `roll`, drums `drum_grid`, vocals `f0`.

`fraction_low_conf` = share of notes whose band is `low`. Thresholds live in `services/ml/config/views.yaml` so they can be tuned without a deploy, and every change is logged with the model versions it was tuned on. These numbers are **proposals**; the fallback-rate targets in `research/product/feature-roadmap-beginner-to-intermediate.md` (guitar ≤40%, bass ≤20%) are the check.

## Corrections overlay
Stored in Postgres (`correction_ops`, see `03-data-model-and-storage.md`) so edits sync instantly and survive artefact regeneration.

```ts
export const CorrectionOp = z.discriminatedUnion("op", [
  z.object({ op: z.literal("set_chord"), segment_id: z.string(), label: z.string(), bass: z.string().optional() }),
  z.object({ op: z.literal("split_chord"), segment_id: z.string(), at_s: z.number(), label: z.string() }),
  z.object({ op: z.literal("set_note"), note_id: z.string(), patch: z.object({ pitch_midi: z.number().int().optional(), onset_s: z.number().optional(), offset_s: z.number().optional(), string: z.number().int().optional(), fret: z.number().int().optional() }) }),
  z.object({ op: z.literal("add_note"), note: Note.omit({ confidence: true, confidence_raw: true }) }),
  z.object({ op: z.literal("delete_note"), note_id: z.string() }),
  z.object({ op: z.literal("shift_downbeat"), by_beats: z.number().int() }),
  z.object({ op: z.literal("tempo_octave"), factor: z.enum(["double", "half"]) }),
  z.object({ op: z.literal("nudge_beat"), beat_id: z.string(), delta_s: z.number() }),
  z.object({ op: z.literal("set_section"), segment_id: z.string(), label: SectionLabel }),
  z.object({ op: z.literal("mark_correct"), entity_id: z.string() }),
  z.object({ op: z.literal("report_wrong"), entity_id: z.string(), comment: z.string().max(500).optional() }),
]);
```
- **Effective view** = artefact ⊕ ops applied in `rev` order. Implemented once in `packages/music-core` (`applyCorrections`) and used by web, native and server export.
- `report_wrong` and `mark_correct` do not change what is shown; they feed the correction-rate metric (`16-observability-analytics-experiments.md`).
- **Re-analysis** with a new model creates a new artefact version. Old ops stay attached to the old version; the UI offers "keep my edited version" or "switch to new analysis" (never a silent merge).
- **Training use** of ops requires the user's separate opt-in flag (`users.training_opt_in`, default false; D7).

## Source of truth and code generation
1. Author schemas in `packages/contracts/src/**` with Zod 4 (`src/analysis/*` for artefacts, corrections and the stage contract; `src/api/*` for API shapes and the oRPC contract). Schemas that Python needs are registered (with a name) in the `contracts` registry.
2. `pnpm --filter contracts build` emits `packages/contracts/schema/contracts.json` (every registered type under `$defs`) plus one self-contained `schema/<Type>.json` per top-level document, via `z.toJSONSchema()`.
3. `services/ml/scripts/gen_contracts.py` runs `datamodel-codegen` on the bundle and writes Pydantic v2 models to `services/ml/packages/splitune_ml_core/src/splitune_ml_core/contracts/_generated.py` (wrapped by `splitune_ml_core.contracts`, which adds `assert_compatible` and `dump_json`). `pnpm contracts:gen` runs steps 2–3.
4. `pnpm contracts:check` regenerates both into a temp dir and fails on any diff; it runs as the "Contracts drift" step of the CI `checks` job.
5. Golden fixtures (`packages/contracts/fixtures/*.json`, listed in `fixtures/index.json` with their type) are validated by both the Vitest and pytest suites; `fixtures/invalid/*` must be rejected by both. API request/response shapes are not in the bundle: they reach other languages through oRPC's OpenAPI export.

## Implementation notes (step 02, 2026-10-20)
The Zod sources are authoritative; the snippets above are kept close to them. Deviations from the original proposal:
- **Python parity.** Generated models use strict scalars (no `"1.5"` → number or `1` → bool coercion), keep date-times and UUIDs as strings checked with Zod's exact regex (UTC `Z` timestamps only), and use tagged unions (`discriminator`). Unknown fields are ignored on both sides (S8): the JSON Schema is emitted in input mode, so it never says `additionalProperties: false`.
- **No float literals.** Python `Literal` can't hold floats, so `tempo_octave.factor` is `"double" | "half"` and `f0.hop_s` is a positive number.
- **Optional, never nullable, in Python-facing types.** Python writers drop `None` (`dump_json`), which is lossless only while no required field is nullable; a Vitest test enforces this on the bundle.
- **Tightened:** `weights_sha256`, `audio_hash`, `cache_key` and artefact `sha256` are lowercase hex (`Sha256Hex`); `error_code`/`fallback_reason` match `^[a-z][a-z0-9_.]*$` (`MachineCode`, so raw exception text is rejected); `ArtefactHeader.artefact` is an `ArtefactKind` pattern; times are non-negative; `key.confidence`, `note_confidence_mean`, `fraction_low_conf` and `chords_confidence_mean` are in [0, 1]; `summary.reasons` is the `ViewReason` enum of the rule above; `set_section.label` is `SectionLabel`; `tab`/`summary` `schema_version` use the same major-1 pattern as the header; `tab.artefact` is `tab.{guitar|bass|piano|vocals|other}`.
- **Added:** the `DrumNotes` wrapper for `notes.drums`; `ConfidenceBand`, `SourceKind`, `StageName` (stage catalogue of `06` incl. `url_import`, `lyrics`, `notes.other`) as named enums.
- **Stage contract (personal mode):** `StageRequest` carries bucket object keys in `inputs`/`outputs`; presigned URLs (`presigned.inputs/outputs`) and `callback {url, nonce}` are optional for the hosted path. `StageResult` also carries `analysis_id` and `stage`; all `StageMetrics` fields are optional.
- **Indexing:** `bar_index`, `tab.bar` and loop-clip bars are 0-based from the first downbeat (pickup = -1); `beat_in_bar`, `tab.beat` and loop-clip beats are 1-based; ticks are 0…959.
- **Versioning:** `SCHEMA_VERSION = "1.0.0"`; `assertCompatible(version)` (TS) and `assert_compatible(version)` (Python) reject a different major or a non-semver string.

## Implementation notes (step 05, 2026-10-20)
Contract additions made with `packages/music-core` (all optional, so `SCHEMA_VERSION` is now **1.1.0**; 1.0.0 documents stay valid):
- **`TabEvent.unplayable`** (optional boolean): a placement fact, not uncertainty. With `string`/`fret` the pitch was moved by octaves into the tuning's range ("8va"/"8vb" marker); without them the note has no position within the span limit ("!" marker). Never a dashed outline (`26-design-system.md` §5).
- **`Tab.swing_bars`** (optional): bars quantized on the triplet-1/8 grid; ticks in those bars are multiples of 320.
- **`CalibrationTable`** (new document, `services/ml/config/calibration/{model_id}@{version}.json`): `method` (`isotonic` | `identity`), `knots` [(raw, calibrated)], `bands {high, medium}` (calibrated thresholds), optional `fitted_on`. Read by the Python stages and by music-core `calibration/lookup.ts`.
- **Conventions fixed by music-core:** `TabEvent.fret` is absolute (from the nut; with a capo the capo fret is the open string), while alphaTex writes frets relative to the capo as alphaTab expects. `quantize_residual_ms` is signed (original − snapped, positive = late). In the bass `roots` level, `note_id` is `root:{segment_id}@{bar}` because those notes are synthesised from the chords and don't exist in `notes.bass`.

## Implementation notes (step 06, 2026-10-20)
`SCHEMA_VERSION` is now **1.2.0** (additions only; 1.0/1.1 documents stay valid; music-core goldens regenerated for the stamp):
- **`Probe` artefact** (`probe.json`, kind `probe`, new in `ArtefactKind`), written by `decode`: header + `container`, `source_bytes`, `source_sha256`, optional `source_duration_s`, `audio_streams`, `audio_stream` (`ProbeStream`: codec, sample_rate, channels, channel_layout, bit_rate, duration_s), `decoded_frames` (44.1 kHz stereo f32le frames), optional `loudness_lufs` (BS.1770-4 integrated) and `peak_dbfs` (both absent for silence). `models` is empty; `params` carries the ffmpeg version and limits. File tags are never copied. `packages/storage` `artefactKey` accepts `probe.json`.
- **`StageRequest.cache_key` is optional:** the enqueuer cannot know `audio_hash` before decode; the worker computes the key (03 "Keys") when it is absent.

## Implementation notes (step 07, 2026-10-21)
`SCHEMA_VERSION` is now **1.3.0** (additions only):
- **`Tags`** (`tags.json`, kind `tags`, written by `tag`): header + `window_s`, `windows`, `instruments[]` (`InstrumentTag`: instrument, `present_prob` = the tagger's raw clip-level score, optional `subtype`) and optional `fallback_reason` (`tagger_unavailable` with an empty list when the tagger couldn't run). The subtype enum is now the named `InstrumentSubtype`, shared with `presence`.
- **`Separation`** (`separation.json`, kind `separation`, written by `separate`): `target`, `provider` (Stem.provider naming), `mix_minus` (`subtract` | `complement`), `device` (`mps` | `cpu`), `stems[]` (`SeparatedStem`: model output `name`, optional `instrument`, `role` target | complement | extra, worker-local `file` relative to the separation cache, `sha256`, `frames`) and `failed_attempts[]` (model, error_code) for the fallback chain. It points at files on the Mac's disk, never at bucket keys.
- **`stems` conventions fixed by stem_post:** `files[].path` is relative to the stems.json directory (`stems/<stem_id>.m4a`); `gain_to_unity_db` replaces `mix_gain_db` while a stem is soloed; empty stems report `loudness_lufs` −70; AAC is always present, Opus only when enabled and verified.
- `packages/storage` `artefactKey` accepts `tags.json` and `separation.json`.

## Implementation notes (step 08, 2026-10-21)
`SCHEMA_VERSION` is now **1.4.0** (additions only):
- **`Note.low_band_energy`** (optional, [0, 1]): written by `notes.bass`; the share of spectral energy at the f0 of `pitch − 12` among the energies at the f0s of `pitch` and `pitch − 12` over the note's first second. Finalize passes it to music-core's octave correction (`buildTab` option `lowBandEnergy`, 07 §3).
- **`ViewReason` gains `quality_gate_failed`** (the instrument failed its Prototype 2 gate, set in `services/ml/config/views.yaml` `quality_gate`) and **`stems_unavailable`** (informational: notes came from the mixture; the view is unchanged).
- **`recommended_view` rule as implemented** (`apps/node-worker/src/views.ts`, thresholds in `views.yaml`): 1 notes missing → `notes_unavailable`; 2 not in `notation_supported` → `notation_not_supported`; **2a `quality_gate: fail` → `quality_gate_failed`**; 3 isolated stem rough and `fraction_low_conf > rough_stem_low_conf` (0.35) → `rough_stem_low_conf`; 4 `fraction_low_conf > low_confidence` (0.5) → `low_confidence`; 5 the instrument default. Boundaries are exclusive (`> 0.5`). `fraction_low_conf` uses the bands the notes stage recorded in `params.calibration.bands` (default 0.70 / 0.40). An empty transcription counts as all-low (`fraction_low_conf` 1). `chords_confidence_mean` is duration-weighted over non-`N` segments; `rough_stems` lists every stem with `quality_hint: rough`.
- **One chords artefact, vocabulary from config:** `chords.json` carries the vocabulary the recognizer decoded in (`sevenths` by default: P6 chose BTC sevenths, or `majmin`), not a second artefact; music-core simplifies sevenths to triads for display (`simplifyChords`). `top_k` holds the mean fused beat posteriors of the 5 best labels; `confidence_raw` = the mean posterior of the chosen label (identity calibration until a chord table is fitted); every segment is `beat_aligned`.
- **Per-instrument object names** follow `packages/storage`: `notes.<instrument>.json`, `tab.<instrument>.json`, `render/<instrument>.alphatex` (doc tables above say `notes/{instrument}.json`).
- Analysis end state: finalize sets `analyses.status` to `done`, or `partial` when chords, stems or a requested instrument's notes are missing, with an `analysis.done` event carrying the summary artefact id; a permanently failed finalize sets `failed`.

## Implications for other docs
- `03-data-model-and-storage.md`: `analyses`, `artefacts`, `correction_ops` tables and the storage layout.
- `06-ml-pipeline-service.md`: every stage writes its artefact atomically (temp key, then rename via copy) and updates `manifest`.
- `07-music-algorithms.md`: quantize, fret DP, `applyCorrections`, level simplification, alphaTex export all consume these types.
- `12-practice-screen-and-notation.md`: confidence bands → outline/dash styles, never colour alone.

## Open questions
- ~~Calibration method per model (isotonic vs temperature scaling) is decided after Prototype 2 produces a labelled set~~ — isotonic per transcriber and instrument (step 08, `services/ml/config/calibration/`).
- Whether to store `f0` frames for vocals in a binary format (Float32 + gzip) instead of JSON if files exceed ~1 MB.
- ~~Whether sevenths should be a second artefact or a field on each segment~~ — neither: one `chords.json` in the configured vocabulary (sevenths by default after P6), simplified for display by music-core (step 08).

## Sources
Cross-linked research docs: `research/ml/pipeline-overview.md` (§5 confidence contract), `research/ml/chords-beats-key-structure.md`, `research/ml/transcription-guitar-and-bass-tabs.md`, `research/ml/transcription-drums.md`, `research/ml/transcription-vocals-melody.md`, `research/ux/music-display-ui.md`, `research/product/recommendations-and-decisions.md` (D4, D7, D11, D13).
