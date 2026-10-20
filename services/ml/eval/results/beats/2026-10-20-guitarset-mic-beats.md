# beats — guitarset-mic-beats (2026-10-20)

- Git: `f92c6a9+dirty`
- Set: `guitarset-mic-beats` (CC-BY-4.0; GuitarSet v1.1.0, Zenodo record 3371780 (annotation.zip, audio_mono-mic.zip; md5 verified on download). Players played to a click; beat_position is that click grid. beat_this final0 and small0 were trained on GuitarSet's comping tracks (not the solos; Beat This! paper §4.1), so comp scores are in-sample and solo scores are the fairer number.), split test, 120 items
- Models: `beat_this/final0@1.1.0` (weights 8c328b45f59d)
- Metric variant: mir_eval 0.8.2 beat.evaluate: F-measure ±70 ms; beats before 5 s trimmed (mir_eval default); CMLt/AMLt continuity at 17.5% tolerance; downbeat F-measure ±70 ms, same trimming
- Command: `uv run splitune-eval score --task beats --set guitarset-mic-beats --pred $PRED/final0-mps --note 'Other runs (same set, same metric): small0 on CPU F-measure 0.7315 (comp 0.8929, solo 0.5701); final0 on MPS after AAC 128 kb/s round-trip (codec simulator) 0.7792 (comp 0.9363, solo 0.6221).' --note 'No gate (step 06 reports only). Comp is in beat_this'"'"'s training data; solo is the fairer number.'`
- Predictions: final0 on mps, codec none
- Other runs (same set, same metric): small0 on CPU F-measure 0.7315 (comp 0.8929, solo 0.5701); final0 on MPS after AAC 128 kb/s round-trip (codec simulator) 0.7792 (comp 0.9363, solo 0.6221).
- No gate (step 06 reports only). Comp is in beat_this's training data; solo is the fairer number.

| Metric | Mean | Median | Min | n |
|---|---|---|---|---|
| Any Metric Level Continuous | 0.6402 | 0.7118 | 0.0000 | 120 |
| Any Metric Level Total | 0.7241 | 0.8760 | 0.0000 | 120 |
| Cemgil | 0.6849 | 0.7311 | 0.1238 | 120 |
| Cemgil Best Metric Level | 0.7351 | 0.7947 | 0.1680 | 120 |
| Correct Metric Level Continuous | 0.5468 | 0.5067 | 0.0000 | 120 |
| Correct Metric Level Total | 0.6150 | 0.7295 | 0.0000 | 120 |
| Downbeat F-measure | 0.6155 | 0.6795 | 0.0000 | 120 |
| F-measure | 0.7747 | 0.8629 | 0.1869 | 120 |
| Goto | 0.4167 | 0.0000 | 0.0000 | 120 |
| Information gain | 0.4901 | 0.5175 | 0.1158 | 120 |
| P-score | 0.7468 | 0.8499 | 0.1714 | 120 |

`F-measure` by tag:

| Tag | Mean | n |
|---|---|---|
| style=comp | 0.9435 | 60 |
| style=solo | 0.6058 | 60 |
