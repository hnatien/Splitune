# Loud-master correctness of the shipped separation path (step 28 Phase 3, 2026-11-07)

Question: on a hot master a stem can peak above 0 dBFS while the mixture doesn't (stems cancel in
the sum). Before step 28, audio-separator rescaled any output stem above its
`normalization_threshold` (1.0 in `stage_separation.models`) and `separate.store` clipped to ±1
when writing the 24-bit FLAC cache. Does that break `stem_post`'s `subtract` mix-minus?

Tool: `uv run --no-sync python eval/loud_master.py run --config shipped|ideal` (RTX 3060, CUDA). The
shipped `decode` → `separate` stages run with the drums chain (BS-Roformer-SW head) on:
- `xl-*`: the three P1 windows whose stems peak highest under `limit-XL` (`splitune_eval.variants`:
  soft clipper + look-ahead limiter to -6 LUFS, -1 dBTP; mixture ≤ 0.89, stems up to 2.8 = +9 dBFS);
- `mxl-*`: the same windows under the official musdb-XL ratio (mixture clipped at ±1 like a file);
- `synthetic`: an antiphase 55 Hz bass/kick pair (stems +5.3 / +0.7 dBFS, mixture -0.5 dBFS). SW sends
  both tones to "other", so it never stresses the store; it stays as the no-weights unit fixture.

`ideal` = library rescaling off and every stem cached as float (what a fix can at best recover).
"Before" = the code on `dev` before step 28 (`loud-master/shipped-before-fix.json`); "after" = the
fix: no library normalisation, stems above full scale cached as float32 WAV.

| fixture | library rescales (before → after) | stored drums peak | mixture − Σ outputs vs mixture (dB) before → after (ideal) | drums uSDR before → after | subtract mix-minus uSDR before → after (ideal) |
|---|---|---|---|---|---|
| xl-punkdisco-oral-hygiene | 3 → 0 | 1.000 → 1.253 | -16.5 → -31.5 (-31.5) | 6.63 → 7.78 | 8.99 → 10.13 (10.30) |
| mxl-punkdisco-oral-hygiene | 1 → 0 | 1.000 → 1.269 | -17.5 → -33.8 (-33.1) | 10.31 → 13.74 | 11.03 → 14.45 (14.02) |
| xl-tom-mckenzie-directions | 3 → 0 | 1.000 → 1.447 | -13.4 → -32.0 (-29.6) | 6.97 → 11.20 | 9.10 → 13.33 (13.29) |
| mxl-tom-mckenzie-directions | 1 → 0 | 1.000 → 1.299 | -15.8 → -37.4 (-37.6) | 11.39 → 18.59 | 11.52 → 18.72 (18.64) |
| xl-lyndsey-ollard-catching-up | 3 → 0 | 1.000 → 1.420 | -13.0 → -36.1 (-36.0) | 7.04 → 9.94 | 13.76 → 16.66 (16.68) |
| mxl-lyndsey-ollard-catching-up | 2 → 0 | 1.000 → 1.048 | -22.8 → -37.0 (-36.7) | 12.26 → 12.37 | 18.34 → 18.41 (18.36) |
| synthetic | 0 → 0 | 0.191 → 0.190 | -56.1 → -56.2 (-56.1) | 0.01 → 0.01 | 8.35 → 8.35 (8.35) |

- **The defect was real.** Every loud fixture had 1-3 output stems rescaled (peaks 1.05-1.48 → 1.0);
  the stems then no longer summed to the mixture (only 13-23 dB of separation between mixture and
  Σ outputs instead of 30-38 dB), and both the stem and the mix-minus lost 1.1-7.2 dB.
- **The fix recovers the ideal:** no rescales, stored stems keep their true peaks (100-12 000
  samples per window above full scale are now kept, not clipped), Σ outputs and mix-minus within
  0.4 dB of the ideal (the remaining differences are SW's overlap change: the "after" runs use the
  library default step, see 08 step 28 notes).
- **Matrix-wide** (all 50 windows; rows `@before-fix` in `2026-11-07.md`), median uSDR before → after:

  | condition | model | outputs at exactly 1.0 | vocals | drums | bass |
  |---|---|---:|---:|---:|---:|
  | limit-XL | bs_roformer_sw | 121 → 0 | 9.42 → 11.22 | 8.59 → 11.40 | 10.39 → 10.48 |
  | limit-XL | htdemucs_6s | 89 → 0 | 7.85 → 8.49 | 7.54 → 7.95 | 8.03 → 7.93 |
  | musdb-xl | bs_roformer_sw | 74 → 0 | 11.92 → 12.40 | 10.60 → 12.34 | 11.27 → 11.38 |
  | musdb-xl | htdemucs_6s | 64 → 0 | 9.25 → 9.27 | 8.88 → 9.36 | 8.08 → 8.21 |

  Most of SW's loss on loud masters was the rescaling, not the model (the "after" SW runs also use
  the library-default overlap; on 30 s clips that changes ≤ 0.13 dB).
- **Decode clipping (not fixed):** the decode cache clips decoded samples above full scale too. Lossy
  encodes of a -6 LUFS / -1 dBTP master (10 limit-XL windows) decode with peaks of 1.05-1.53 (AAC
  1.17-1.53, Opus 1.10-1.20, MP3 1.05-1.35), 10-750 samples per million above full scale. Reported
  as a follow-up (a float decode cache).

Tests: `test_a_stem_within_full_scale_is_cached_as_flac_and_a_louder_one_as_float_wav`,
`test_the_library_peak_normalisation_is_off`, `test_a_loud_stem_reaches_the_cache_unchanged`,
`test_the_stem_store_is_part_of_the_cache_key` (no weights), `test_a_raw_stem_above_full_scale_is_read_back_unclipped`
(stem_post) and `test_a_hot_master_separates_without_rescaling_or_clipping` (`models`: the
`xl-punkdisco` fixture through real BS-Roformer-SW; drums above full scale, stored = library output,
mixture − Σ outputs below -25 dB).
