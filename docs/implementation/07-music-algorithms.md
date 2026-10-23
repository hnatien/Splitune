---
title: Music algorithms (music-core package)
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Music algorithms: `packages/music-core`

The in-house, licence-green algorithms that sit between raw model output and what the learner sees. They are deliberately **not** in the Python pipeline: they must re-run instantly in the browser when the learner changes capo, tuning, level, fingering mode or fixes the beat grid. One TypeScript implementation runs in a Web Worker on the client and in Node in the orchestrator's finalize step.

## TL;DR
- **Scope:** `applyCorrections`, beat-grid utilities, quantization (1/16 grid on downbeats), bass octave correction, chord fusion helpers, key estimation, fret-assignment DP (guitar/bass), level simplification (M11), transposition/capo, alphaTex export, MusicXML export (v1), confidence calibration lookup.
- **Pure functions over the contracts in `05-analysis-schema.md`.** No I/O, no DOM, deterministic; property-based and golden tests.
- **Fret DP is the headline component** (Prototype 3 gate: ≥0.90 string/fret agreement on GuitarSet ground-truth notes, 100% of chords within span). Beginner bias: open position, span ≤4 frets, capo and tuning as inputs.
- **Performance budget:** full re-quantize + re-fret of a 4-min guitar part ≤150 ms in a Worker on a mid-range phone (proposal; measured in `18-testing-strategy.md`).
- If native v1 later needs these algorithms outside a WebView, port to Rust with WASM + UniFFI bindings (`22-native-apps.md`); keep the golden tests language-neutral (JSON in, JSON out) so a port is verifiable.

## Module map
| Module | Input | Output | Used by |
|---|---|---|---|
| `corrections/apply.ts` | artefact + `CorrectionOp[]` | effective artefact | everything that displays or exports |
| `grid/beatgrid.ts` | `Beats` (+ ops `shift_downbeat`, `tempo_octave`, `nudge_beat`) | `BeatGrid` with bar/beat lookup, `timeToTick`, `tickToTime` | loop snapping, metronome, count-in, quantize |
| `quantize/quantize.ts` | `Notes`, `BeatGrid`, options | `TabEvent[]` without string/fret | tab, drum grid, roll |
| `bass/octave.ts` | bass `Notes`, `Chords` | octave-corrected `Notes` | bass chain |
| `harmony/key.ts` | `Chords`, optional pitch-class histogram | `{tonic, mode, confidence}` | key display, capo suggestions, transposition |
| `harmony/chordtools.ts` | Harte labels | parse, transpose, simplify (sevenths→triads), shape lookup | chord strip, level toggle |
| `fret/dp.ts` | quantized events + `FretConfig` | events with `string`, `fret`, `alt_fingerings` | guitar, bass, ukulele (later) |
| `level/simplify.ts` | effective notes, chords, level | simplified events/chords | M11, V13 |
| `transpose/transpose.ts` | events/chords, semitones, capo | shifted labels and frets | V2 |
| `export/alphatex.ts` | tab + chords + meta | alphaTex string + `noteMap` (rendered note → `note_id`) | alphaTab render and confidence overlay, debug |
| `export/musicxml.ts` | tab + chords + meta | MusicXML 4.0 | V11 export |
| `calibration/lookup.ts` | raw posterior, calibration table | calibrated confidence + band | used server-side once; client only for re-banding |

## 1. Beat grid
- Build from `beats.beats[]`; derive `bar_index`/`beat_in_bar` from downbeats, not from `meter` alone (meter changes happen).
- Corrections:
  - `tempo_octave(2)`: insert a beat at the midpoint of every interval; `tempo_octave(0.5)`: drop every second beat, keeping downbeats.
  - `shift_downbeat(k)`: re-label downbeats by rotating `beat_in_bar` by `k`.
  - `nudge_beat`: move one beat; neighbours unchanged.
- `timeToTick(t)`: locate the beat interval `[b_i, b_{i+1})` by binary search, linear interpolation inside the interval, PPQ 960. Before the first beat and after the last, extrapolate with the nearest interval (pickups and fade-outs).
- Loop snapping uses `snapToBar(t, direction)` and supports pickups: if the phrase starts on an anacrusis, snap A to the pickup beat (`ux/practice-tool-patterns.md` Pattern 1).

## 2. Quantization (all instruments)
1. For each note onset, compute fractional tick via `timeToTick`.
2. Choose grid: 1/16 straight by default; detect swing per bar when ≥60% of off-beat 1/8 onsets fall nearer 2/3 than 1/2 of the beat → use triplet-1/8 grid for that bar (heuristic; record `swing=true` on the bar).
3. Snap onset to the nearest grid point; `quantize_residual_ms` = original − snapped in ms (signed: positive = played late). |Residual| >60 ms is flagged (shown as a dotted underline, `26-design-system.md` §5; dashed outlines are reserved for medium/low confidence).
4. Duration: snap offset the same way, minimum one grid step; for guitar/bass, clip to the next onset on the same string after fret assignment (string can't ring through a new note).
5. Polyphony: onsets within 30 ms of each other collapse to a chord event (guitar strums arrive spread over 10–40 ms).
6. Drums: same grid; flams (two hits of same class within 25 ms) collapse to one hit with `flam=true`.

Rubato and drifting live takes are the known weak case (QM12); the grid follows the beat grid, so as long as beats follow the performance, notes do too.

## 3. Bass octave correction
Bass trackers lock onto the second harmonic (`ml/transcription-guitar-and-bass-tabs.md` §6). Pass, per note:
1. Candidate pitches `p`, `p−12`, `p+12` within the instrument range (4-string E1–G4 default; 5-string B0).
2. Cost = `w1·|chord_root_pc − pc(candidate)|_circular` (only when the chord segment's confidence ≥ medium) + `w2·|candidate − previous_note|/12` (smoothness) + `w3·spectral_penalty` (low energy in the stem below the candidate's f0, computed server-side and passed as `low_band_energy` per note).
3. Viterbi over the note sequence; keep the original if the improvement is below a margin (avoid flip-flopping).
Weights start at `w1=1, w2=0.5, w3=1` and are tuned on the Prototype 2 bass set by maximising raw pitch accuracy without hurting raw chroma accuracy (`mir_eval.melody` RPA vs RCA).

## 4. Key estimation (green, unbenchmarked — QM19)
- Duration-weighted chord-root and chord-quality histogram → correlate with Krumhansl–Kessler (or Temperley) major/minor profiles over 24 keys; add the pitch-class histogram of transcribed notes when available.
- `confidence` = softmax margin between the best and second-best key. Show "Key: A minor (likely)" when the margin is small.
- Evaluate on the Prototype 6 annotated set before showing key prominently.

## 5. Fret-assignment DP (guitar and bass)

### Inputs
```ts
type FretConfig = {
  tuningMidi: number[];        // high→low, e.g. [64,59,55,50,45,40]
  capo: number;                // 0–12, user input (capo is ambiguous from audio)
  maxFret: number;             // 20 default
  maxSpan: number;             // 4 for beginner bias (D3), 5 for "as played"
  mode: "easiest" | "as_played";
  handPositionPrior?: number;  // optional fret centre, e.g. from user preference
};
```

### State and transitions
- Each time step is a quantized event (single note or chord). A **candidate** for a step is an assignment of every note in it to a distinct string with a playable fret (`fret ≥ capo`, `fret ≤ maxFret`, pitch = open-string pitch + fret).
- Enumerate candidates per step; prune to the K=24 cheapest by local cost (chords on six strings can explode combinatorially).
- DP over steps: `best[i][c] = local(c) + min_{c'} (best[i−1][c'] + transition(c', c))`. Backtrack for the optimum; keep the second- and third-best distinct per-note fingerings as `alt_fingerings` (from the K-best list at each step).

### Cost terms (initial weights; tune in Prototype 3)
| Term | Formula sketch | Weight (easiest / as_played) | Why |
|---|---|---|---|
| Fret height | mean fret position above capo | 0.3 / 0.1 | open-position bias for beginners |
| Open string bonus | −1 per open string when the pitch allows | 0.5 / 0.1 | beginners prefer open strings |
| Span | max−min fretted fret in candidate; ∞ if > `maxSpan` | 1.0 / 0.6 | hard playability constraint (MIDI-to-Tab still produced 12-fret stretches, so a hard limit is needed) |
| Hand shift | |centre(c) − centre(c')| in frets, scaled by 1/Δt | 0.8 / 0.8 | minimise movement, more forgiving with more time |
| String skip | strings jumped between consecutive single notes | 0.2 / 0.2 | picking ease |
| Chord shape prior | −bonus if candidate matches a known open/barre shape for the current chord label | 0.7 / 0.3 | idiomatic voicings; chord library in `harmony/chordtools.ts` |
| Same-string legato | small bonus for consecutive notes on one string within 2 frets | 0 / 0.3 | approximates slides/hammer-ons in "as played" |

### Bass specifics
4/5-string tuning presets; `maxSpan` 4 (one-finger-per-fret); stronger hand-shift weight; root–fifth pattern prior (bonus for the fifth on the adjacent higher string one fret up).

### Edge cases
- Pitch out of range for the tuning → mark event `unplayable` and move it to the nearest octave in range, shown with an "8va"/"8vb" marker (never silently). A note that cannot be placed within the span (no string/fret) is also `unplayable` and gets a "!" marker on the beat. Unplayable is a placement fact, not uncertainty, so it never uses the dashed outline (`26-design-system.md` §5).
- Drop-D or half-step-down tunings: user input in v1 (QM18 heuristic later: lowest detected note < E2 suggests drop tuning).
- Capo changes re-run the DP only (no re-quantize).

### Validation (Prototype 3, `08-evaluation-harness-and-prototypes.md`)
- GuitarSet ground-truth notes → DP → string/fret agreement (pass ≥0.90) and span compliance (100%).
- Same with Basic Pitch notes on GuitarSet audio (report, no gate).
- 3 guitarists rate playability on 10 excerpts vs Guitar Pro 8 output (pass: ≥ GP8).

## 6. Level simplification (M11; V13 later)
| Instrument | Level | Rule |
|---|---|---|
| Guitar | `chords_only` | hide notes; show chord strip + diagrams (easiest shape for the effective key/capo) + strum marks on beats |
| Guitar | `simplified` | chords → triads (drop extensions/inversions via `chordtools.simplify`); riffs keep only notes with confidence ≥ medium on strong beats; max one note per beat in single-note lines |
| Guitar | `as_transcribed` | effective notes unchanged |
| Bass | `roots` | one root note per chord segment on each downbeat (from chords + octave-corrected register) |
| Bass | `full` | effective notes unchanged |
| Piano (v1) | `right_hand_melody`, `block_chords_left` | V13; see `21-v1-features.md` |

Rules are deterministic and documented in the UI ("Simplified: extensions removed, one note per beat").

## 7. Transposition and capo (V2)
- **Playback key** (pitch-shift in semitones) and **shapes key/capo** are separate (Pattern 4). Playback key changes the audio graph (`11-audio-engine.md`) and transposes displayed chord labels and note pitches; it does not touch fret assignment unless "keep shapes" is off.
- **Capo suggestion:** for each capo 0–7, transpose chords down by capo and score the shape difficulty sum (open shapes 1, barre 3, others 4); suggest the lowest-cost capo with "sounds like original key".

## 8. Exporters
- **alphaTex** (render path): header (`\title`, `\tempo`, `\tuning`, `\capo`), one staff per instrument, `|` bars, durations from ticks, `fret.string` notes, chord names as beat text only when requested (`chordNames`, default off: the chord strip shows them). alphaTex has no custom per-note property, so confidence cannot be encoded in the text: `buildTab` returns a `noteMap` from every rendered alphaTab note (bar, voice, beat index, note index) to `note_id`, and the renderer applies `NoteStyle` ink plus an overlay positioned from `boundsLookup` (`12-practice-screen-and-notation.md`, `26-design-system.md` §5). Verify the `fret.string` syntax against the alphaTex language reference before relying on it (`ux/music-display-ui.md`).
- **MusicXML 4.0** (V11): `<technical><string/><fret/></technical>` for tab, `<harmony>` for chords, percussion via `<unpitched>` and GM `<midi-unpitched>` (W3C tutorial). Export always uses the effective (corrected) view.
- Guitar Pro export (V11) goes through alphaTab's exporter if available in the pinned version; otherwise MusicXML only.

## 9. Testing
- **Golden files:** the bundled example song's artefacts → expected `tab.*` and alphaTex. Language-neutral JSON so a future Rust port can reuse them.
- **Property tests** (fast-check): quantize is idempotent; every fretted note sounds the input pitch; no candidate exceeds `maxSpan`; `applyCorrections` with an empty op list is identity; transposing +n then −n is identity.
- **Benchmarks:** Vitest bench on a 4-min dense guitar part; regression fails CI if >20% slower than baseline.

## Implementation notes (step 05, 2026-10-20)
`packages/music-core` implements the module map above (MusicXML export is V11, not built). Deviations and decisions:
- **Entry point:** `buildTab(notes, beats, corrections, options)` returns `{ tab, alphaTex, noteMap, … }` (plus `effective` artefacts, `displayChords`, `skippedCorrections`, `residualFlagged`, `warnings`). Order: corrections on beats/chords → bass octave correction on model notes → note corrections (user edits win) → playback transposition → quantize → level → fret DP → same-string duration clipping → alphaTex.
- **Beat grid:** labels are always re-derived from `is_downbeat`; a pickup of a full bar or more gets inferred downbeats so `bar_index` stays ≥ −1. `tempo_octave` keeps the meter's beat count per bar, phase-locked to the first downbeat (doubling makes each detected bar two bars). Global ticks count from the first detected beat; notes earlier than beat 1 of bar −1 are clamped there and flagged by their residual.
- **Quantize:** swing votes are per note and only from onsets nearest the 1/2 or 2/3 beat positions (1/4 and 3/4 don't vote), so straight sixteenth lines never read as swing; idempotent for beat intervals ≥ ~0.12 s (property-tested). Chord collapse anchors on the first onset of the group.
- **Bass octave (§3):** the chord-root term as written is constant across octave candidates (same pitch class), so it is implemented as a register prior: no cost within one octave above the chord root placed in E1–D#2, `w1`/12 per semitone outside it. `low_band_energy` (energy at the f0 of p−12) penalises p by `e` and p−12 by `1 − e`. Flip-flopping is prevented by a per-change cost (`change = 0.75`) instead of a global margin. Weights are untuned until the P2 bass set exists.
- **Bass root–fifth prior:** a fifth on the next higher string in fourths tuning is **two** frets up, not one; the prior matches interval 7 on the adjacent higher string (and the octave two strings up).
- **Fret DP state:** (candidate, hand position p) instead of candidate alone. The index finger is at p, fingers cover p…p+3, one stretch to p+4 (`stretch` weight); open strings fit every position, so the hand position survives open notes, and movement inside a box is free. The shift cost is `handShift × |Δp| / (1 + Δt / handShiftTimeS)`. Added because the first-order centre model lost the hand on every open-only step; GuitarSet shows 96% (solo) / 99% (comp) of consecutive fretted notes within 3 frets. Infeasible chords drop notes (bass and melody kept first) and mark them `unplayable` without string/fret; more notes than strings keep the extremes first.
- **P3 tuning and result** (`services/ml/eval/results/p3/2026-10-20.md`, tools `services/ml/eval/p3_guitarset.py`, `p3_tune.py`): coordinate descent on GuitarSet players 00–02, checked on 03–05. Tuned `as_played` weights: fretHeight 0, openString −0.2 (open strings slightly avoided in position playing), span 0.2, handShift 1, handShiftTimeS 1, stretch 1, ringing 0.3 (others as in the table). `easiest` keeps the beginner bias (fretHeight 0.3, openString 0.5) with the same playability terms (handShiftTimeS 1, stretch 1, ringing 0.3). Bass weights are untuned (no bass tab set); bass got the guitar's stretch penalty. Result: span compliance 100%; agreement 0.789 `as_played` (comp 0.846, solo 0.636; held-out players 0.747), 0.596 `easiest`; lowest-fret baseline 0.454. **The ≥0.90 gate is not met.** Tried and rejected: a key-based hand-position prior (solo box on the minor tonic) dropped agreement to 0.53.
- **Shape prior:** standard-tuning library (open shapes; E- and A-shape barres for maj/min/7/min7/maj7/sus) applies to tunings that are a uniform shift of standard; drop/open tunings get no shape prior.
- **Levels:** `simplified` keeps notes with confidence ≥ medium that start on a beat (so ≤ 1 onset per beat); `chords_only` emits no events. Bass `roots` follows the octave-corrected bass register and slash basses.
- **Transposition:** with `keepShapes` the capo moves by the playback shift; if that leaves 0–12, frets are recomputed and `keep_shapes_unavailable` is returned. Pins (`set_note` string/fret) are dropped under a transposition.
- **Calibration:** default bands high ≥ 0.70, medium ≥ 0.40 until P2 fits tables (`CalibrationTable` contract, `05-analysis-schema.md`).
- **Key:** confidence = softmax(correlation / 0.05) margin between the two best keys.
- **alphaTex vs this doc (verified against alphatab.net/docs/alphatex and the 1.8.4 importer, which the tests run on every output with zero diagnostics):** the `.` section separators are gone since 1.7; `\tempo` and `\ts` are bar-level tags; multi-argument metadata needs parentheses (`\ts (4 4)`, otherwise a warning); frets are written **relative to the capo** (alphaTab adds `\capo` to the tuning); string 1 is the highest string; durations per beat (`3.2.8`), dots `{d}`, triplets `{tu 3}` (swing bars use only whole beats and triplet eighths so groups are complete), ties `-.string`, pickup bars `\ac`, chord names `{ch "Am"}` only with `chordNames`. There is **no custom note property**, hence `noteMap`.
- **CLI:** `node src/cli.ts <fret|quantize|build-tab>` (or `pnpm --silent --filter @splitune/music-core cli …`; without `--silent` pnpm prints its banner to stdout). Invalid input exits 2 with an ErrorEnvelope-shaped object on stderr. Golden files: `packages/music-core/golden/*.json` (`{command, input, expected}`), regenerated with `pnpm --filter @splitune/music-core golden:update`.
- **Runtime dependencies:** only `@splitune/contracts` (the CLI validates with its Zod schemas; library code imports contract types plus `SCHEMA_VERSION`). Note that importing `@splitune/contracts` pulls in Zod at runtime in the Worker bundle.

## Implementation notes (step 08, 2026-10-21)
- **Finalize** (`apps/node-worker/src/finalize.ts`) calls `buildTab(notes, beats, {}, { chords, fingeringMode: 'easiest', bands, lowBandEnergy })` once per fretted instrument, with the bands the notes stage recorded (`notes.params.calibration.bands`) and, for bass, `lowBandEnergy` built from `Note.low_band_energy`. Default levels (`as_transcribed` / `full`); no corrections (the node_worker role can't read `correction_ops`; the client applies them). Writes `tab.<instrument>.json` (validated with the `Tab` schema) and `render/<instrument>.alphatex`; `noteMap` is not stored (the client recomputes it).
- **CLI `key` command:** `node src/cli.ts key` with `{segments, notes?}` → `{tonic, mode, confidence}` (`estimateKey`); the chords stage calls it when `key: music_core` (golden `key.fixture.json`).

## Implementation notes (step 13, 2026-10-22)
- **Quantizer fix:** a note snapped forward across a bar line kept the grid step of the bar it was played in; from a swing bar into a straight bar its minimum length became a triplet 1/8 (320 ticks), its end left the straight grid and `toAlphaTex` threw `cannot express 80 ticks at 240`. `snapTick` now takes the step of the bar the snapped tick lands in. Found on a real example song at the `simplified` level (test: quantize "takes the grid step of the bar a note snaps into").

## Open questions
- Learned assigner later (Fretting-Transformer/MIDI-to-Tab-style) has no usable code or licence; revisit only if Prototype 3 fails (D3).
- Easiest vs as-played default (QU7) is a user-research question; the default is `easiest` for MVP.
- Swing detection heuristic quality is unmeasured; validate on the Prototype 6 set.

## Sources
Cross-linked research: `ml/transcription-guitar-and-bass-tabs.md` (lowest-fret 98.30%, Fretting-Transformer, MIDI-to-Tab spans, CREPE/SwiftF0 floors), `ml/chords-beats-key-structure.md` (key gap, chord accuracy), `ml/pipeline-overview.md` §4 (Prototype 3 gates) and §5, `ux/practice-tool-patterns.md` (loop snapping, transposition pattern), `ux/music-display-ui.md` (alphaTex, MusicXML percussion), `product/recommendations-and-decisions.md` (D3, D11, D13).
