## Basic Pitch decoding, hard-band stems, `a4comp` (20 fit / 37 held-out items; onset F1)

| infer_onsets | melodia_trick | onset_threshold | frame_threshold | min_note_ms | energy_tol | fit | held-out |
|---|---|---|---|---|---|---|---|
| True | True | 0.7 | 0.5 | 58.0 | 16 | 0.752 | 0.729 |
| False | True | 0.7 | 0.5 | 58.0 | 16 | 0.752 | 0.730 |
| False | False | 0.6 | 0.5 | 58.0 | 6 | 0.751 | 0.736 |
| True | False | 0.6 | 0.5 | 58.0 | 6 | 0.750 | 0.735 |
| True | True | 0.8 | 0.5 | 58.0 | 16 | 0.750 | 0.721 |
| False | True | 0.8 | 0.5 | 58.0 | 16 | 0.750 | 0.722 |
| True | True | 0.7 | 0.5 | 58.0 | 11 | 0.750 | 0.728 |
| False | False | 0.6 | 0.5 | 58.0 | 16 | 0.750 | 0.734 |
| True | True | 0.6 | 0.5 | 58.0 | 11 (current) | 0.744 | 0.723 |

- infer_onsets alone (held-out): True: 0.723, False: 0.724

- melodia_trick alone (held-out): True: 0.723, False: 0.734

- onset_threshold alone (held-out): 0.5: 0.705, 0.6: 0.723, 0.7: 0.728, 0.8: 0.721

- frame_threshold alone (held-out): 0.4: 0.693, 0.5: 0.723, 0.6: 0.722, 0.7: 0.675

- min_note_ms alone (held-out): 58.0: 0.723, 90.0: 0.718, 127.7: 0.690

- energy_tol alone (held-out): 6: 0.719, 11: 0.723, 16: 0.725
