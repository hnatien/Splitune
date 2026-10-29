# Prototype 2g — guitar accuracy end to end (2026-10-29)

git `ae85565+dirty` · models: bs-roformer-sw BS-Roformer-SW, guitab-e25 1.1.1-e25, htdemucs-6s 4.0.1, mel-roformer-guitar-becruily e9624f5 · notes: mir_eval 0.8.2 transcription: onset F1 (±50 ms, ±50 cents) and onset+offset F1 (offset ±max(50 ms, 20% of duration)); pitch-class F1 = onset F1 with octaves folded · tab: notes matched as for onset F1, then **TDR** = share of matched notes on the reference string and fret, **Tab F1** = notes with the right onset, pitch, string and fret (precision over all estimated notes, recall over all reference notes), pooled over items · tab through the shipped `buildTab` (`music-core` CLI, level `as_transcribed`), standard tuning unless a column says otherwise · beats: shipped beats stage on the clean guitar

Variants: `guitabbendscue2` = guitabbends + its own string probabilities as the DP string cue, weight 2; `sep_htdemucs_6s` = guitabbendscue2 (the shipped chain) with separator htdemucs_6s; `sep_mel_roformer_guitar_becruily` = guitabbendscue2 (the shipped chain) with separator mel_roformer_guitar_becruily; `sep_ens_sw_becruily` = guitabbendscue2 (the shipped chain) with separator ens_sw_becruily

## GuitarSet-derived (in-sample for Basic Pitch, YourMT3+)

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabbendscue2 · clean | 37 | 0.887 | 0.888 | 0.891 | 0.688 | 0.889 | 0.705 | 0.809 | 0.711 | 0.816 |
| guitabbendscue2 · stem.easy | 37 | 0.882 | 0.891 | 0.878 | 0.650 | 0.885 | 0.691 | 0.800 | 0.694 | 0.803 |
| guitabbendscue2 · mix.easy | 37 | 0.526 | 0.469 | 0.643 | 0.236 | 0.538 | 0.374 | 0.713 | 0.384 | 0.732 |
| guitabbendscue2 · stem.hard | 37 | 0.857 | 0.857 | 0.866 | 0.596 | 0.860 | 0.664 | 0.790 | 0.664 | 0.790 |
| guitabbendscue2 · mix.hard | 37 | 0.416 | 0.342 | 0.608 | 0.139 | 0.430 | 0.270 | 0.641 | 0.279 | 0.663 |
| sep_htdemucs_6s · stem.easy | 37 | 0.842 | 0.856 | 0.836 | 0.564 | 0.847 | 0.654 | 0.801 | 0.659 | 0.807 |
| sep_htdemucs_6s · stem.hard | 37 | 0.811 | 0.816 | 0.817 | 0.506 | 0.815 | 0.622 | 0.787 | 0.624 | 0.790 |
| sep_mel_roformer_guitar_becruily · stem.easy | 37 | 0.842 | 0.859 | 0.836 | 0.565 | 0.847 | 0.658 | 0.802 | 0.658 | 0.801 |
| sep_mel_roformer_guitar_becruily · stem.hard | 37 | 0.787 | 0.777 | 0.817 | 0.474 | 0.793 | 0.590 | 0.778 | 0.591 | 0.780 |
| sep_ens_sw_becruily · stem.easy | 37 | 0.874 | 0.885 | 0.870 | 0.626 | 0.876 | 0.684 | 0.801 | 0.686 | 0.803 |
| sep_ens_sw_becruily · stem.hard | 37 | 0.829 | 0.814 | 0.857 | 0.551 | 0.833 | 0.636 | 0.785 | 0.637 | 0.786 |

## other sources

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabbendscue2 · clean | 20 | 0.781 | 0.841 | 0.746 | 0.343 | 0.784 | 0.464 | 0.622 | 0.495 | 0.664 |
| guitabbendscue2 · stem.easy | 20 | 0.683 | 0.768 | 0.632 | 0.277 | 0.687 | 0.450 | 0.617 | 0.475 | 0.651 |
| guitabbendscue2 · mix.easy | 20 | 0.290 | 0.249 | 0.465 | 0.059 | 0.303 | 0.164 | 0.545 | 0.173 | 0.577 |
| guitabbendscue2 · stem.hard | 20 | 0.652 | 0.722 | 0.618 | 0.268 | 0.658 | 0.404 | 0.596 | 0.427 | 0.630 |
| guitabbendscue2 · mix.hard | 20 | 0.220 | 0.164 | 0.441 | 0.036 | 0.230 | 0.123 | 0.539 | 0.129 | 0.567 |
| sep_htdemucs_6s · stem.easy | 20 | 0.572 | 0.730 | 0.497 | 0.185 | 0.578 | 0.345 | 0.579 | 0.370 | 0.621 |
| sep_htdemucs_6s · stem.hard | 20 | 0.527 | 0.689 | 0.471 | 0.173 | 0.535 | 0.316 | 0.583 | 0.339 | 0.625 |
| sep_mel_roformer_guitar_becruily · stem.easy | 20 | 0.663 | 0.738 | 0.630 | 0.211 | 0.677 | 0.403 | 0.601 | 0.421 | 0.629 |
| sep_mel_roformer_guitar_becruily · stem.hard | 20 | 0.531 | 0.562 | 0.545 | 0.137 | 0.550 | 0.322 | 0.597 | 0.325 | 0.604 |
| sep_ens_sw_becruily · stem.easy | 20 | 0.707 | 0.778 | 0.674 | 0.283 | 0.714 | 0.442 | 0.614 | 0.461 | 0.639 |
| sep_ens_sw_becruily · stem.hard | 20 | 0.611 | 0.644 | 0.612 | 0.245 | 0.617 | 0.365 | 0.595 | 0.379 | 0.618 |

## By style (stem.hard; the sources column says which tier)

| variant | style | sources | items | onset F1 | onset P | onset R | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabbendscue2 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.828 | 0.775 | 0.611 | 0.757 | 0.609 | 0.755 |
| guitabbendscue2 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.848 | 0.864 | 0.846 | 0.612 | 0.737 | 0.621 | 0.748 |
| guitabbendscue2 | solo_bends | idmt-smt-guitar | 3 | 0.769 | 0.689 | 0.888 | 0.326 | 0.432 | 0.397 | 0.527 |
| guitabbendscue2 | two_guitars | guitarset | 4 | 0.764 | 0.861 | 0.692 | 0.660 | 0.859 | 0.675 | 0.877 |
| guitabbendscue2 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |
| sep_htdemucs_6s | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.716 | 0.781 | 0.702 | 0.559 | 0.749 | 0.559 | 0.749 |
| sep_htdemucs_6s | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.753 | 0.788 | 0.740 | 0.550 | 0.758 | 0.556 | 0.767 |
| sep_htdemucs_6s | solo_bends | idmt-smt-guitar | 3 | 0.767 | 0.750 | 0.787 | 0.375 | 0.490 | 0.457 | 0.597 |
| sep_htdemucs_6s | two_guitars | guitarset | 4 | 0.698 | 0.765 | 0.643 | 0.592 | 0.836 | 0.619 | 0.875 |
| sep_htdemucs_6s | vibrato | guitar-techs | 2 | 0.083 | 0.500 | 0.045 | 0.019 | 1.000 | 0.019 | 1.000 |
| sep_mel_roformer_guitar_becruily | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.685 | 0.698 | 0.702 | 0.517 | 0.737 | 0.518 | 0.739 |
| sep_mel_roformer_guitar_becruily | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.770 | 0.773 | 0.786 | 0.559 | 0.754 | 0.559 | 0.755 |
| sep_mel_roformer_guitar_becruily | solo_bends | idmt-smt-guitar | 3 | 0.622 | 0.496 | 0.860 | 0.290 | 0.484 | 0.271 | 0.451 |
| sep_mel_roformer_guitar_becruily | two_guitars | guitarset | 4 | 0.715 | 0.781 | 0.660 | 0.605 | 0.841 | 0.625 | 0.869 |
| sep_mel_roformer_guitar_becruily | vibrato | guitar-techs | 2 | 0.007 | 0.004 | 0.050 | 0.000 | 0.000 | 0.000 | 0.000 |
| sep_ens_sw_becruily | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.753 | 0.765 | 0.760 | 0.572 | 0.745 | 0.576 | 0.751 |
| sep_ens_sw_becruily | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.823 | 0.817 | 0.843 | 0.595 | 0.740 | 0.596 | 0.740 |
| sep_ens_sw_becruily | solo_bends | idmt-smt-guitar | 3 | 0.672 | 0.550 | 0.880 | 0.331 | 0.505 | 0.352 | 0.536 |
| sep_ens_sw_becruily | two_guitars | guitarset | 4 | 0.750 | 0.825 | 0.690 | 0.644 | 0.854 | 0.657 | 0.871 |
| sep_ens_sw_becruily | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |

## By tuning (stem.hard, `easiest`): standard-tuning tab vs the reference tuning and capo

| variant | tuning | items | onset F1 | Tab F1 std | Tab F1 ref tuning | unplayable std | unplayable ref tuning |
|---|---|---|---|---|---|---|---|
| guitabbendscue2 | capo | 2 | 0.874 | 0.682 | 0.682 | 0.006 | 0.012 |
| guitabbendscue2 | drop_d | 3 | 0.822 | 0.682 | 0.731 | 0.001 | 0.001 |
| guitabbendscue2 | full_step_down | 2 | 0.869 | 0.000 | 0.718 | 0.002 | 0.002 |
| guitabbendscue2 | half_step_down | 2 | 0.847 | 0.000 | 0.814 | 0.000 | 0.000 |
| guitabbendscue2 | off_a440 | 4 | 0.925 | 0.870 | 0.870 | 0.007 | 0.007 |
| guitabbendscue2 | standard | 44 | 0.759 | 0.649 | 0.649 | 0.020 | 0.020 |
| sep_htdemucs_6s | capo | 2 | 0.884 | 0.756 | 0.749 | 0.012 | 0.012 |
| sep_htdemucs_6s | drop_d | 3 | 0.717 | 0.589 | 0.606 | 0.000 | 0.000 |
| sep_htdemucs_6s | full_step_down | 2 | 0.839 | 0.000 | 0.707 | 0.000 | 0.000 |
| sep_htdemucs_6s | half_step_down | 2 | 0.787 | 0.000 | 0.761 | 0.004 | 0.008 |
| sep_htdemucs_6s | off_a440 | 4 | 0.856 | 0.805 | 0.805 | 0.006 | 0.006 |
| sep_htdemucs_6s | standard | 44 | 0.681 | 0.599 | 0.599 | 0.016 | 0.016 |
| sep_mel_roformer_guitar_becruily | capo | 2 | 0.906 | 0.765 | 0.765 | 0.000 | 0.006 |
| sep_mel_roformer_guitar_becruily | drop_d | 3 | 0.644 | 0.574 | 0.581 | 0.005 | 0.005 |
| sep_mel_roformer_guitar_becruily | full_step_down | 2 | 0.847 | 0.000 | 0.659 | 0.000 | 0.000 |
| sep_mel_roformer_guitar_becruily | half_step_down | 2 | 0.774 | 0.000 | 0.731 | 0.004 | 0.005 |
| sep_mel_roformer_guitar_becruily | off_a440 | 4 | 0.793 | 0.684 | 0.684 | 0.015 | 0.015 |
| sep_mel_roformer_guitar_becruily | standard | 44 | 0.672 | 0.571 | 0.571 | 0.027 | 0.027 |
| sep_ens_sw_becruily | capo | 2 | 0.888 | 0.734 | 0.708 | 0.000 | 0.006 |
| sep_ens_sw_becruily | drop_d | 3 | 0.760 | 0.624 | 0.671 | 0.001 | 0.001 |
| sep_ens_sw_becruily | full_step_down | 2 | 0.855 | 0.000 | 0.701 | 0.000 | 0.002 |
| sep_ens_sw_becruily | half_step_down | 2 | 0.817 | 0.000 | 0.781 | 0.001 | 0.001 |
| sep_ens_sw_becruily | off_a440 | 4 | 0.871 | 0.783 | 0.783 | 0.006 | 0.006 |
| sep_ens_sw_becruily | standard | 44 | 0.728 | 0.615 | 0.615 | 0.028 | 0.028 |

## Tuning in the tab (`easiest`): standard vs the applied suggestion vs the truth

Semitone-detuned stems are the hard-band stems played back 100/200 cents lower: their true tuning is half/full step down (drop D items become drop C#/C). Applied right = the suggestion buildTab used equals the true tuning; applied wrong on standard = a non-standard tuning used on a standard-tuned excerpt.

| variant | condition | true tuning | items | Tab F1 std | Tab F1 suggested | Tab F1 true | unplayable std | unplayable suggested | applied right | applied wrong on standard |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabbendscue2 | stem.hard | drop_d | 3 | 0.682 | 0.682 | 0.731 | 0.001 | 0.001 | 0 | 0 |
| guitabbendscue2 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.718 | 0.002 | 0.002 | 0 | 0 |
| guitabbendscue2 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.814 | 0.000 | 0.000 | 0 | 0 |
| guitabbendscue2 | stem.hard | standard | 50 | 0.669 | 0.669 | 0.669 | 0.019 | 0.019 | 0 | 0 |
| sep_htdemucs_6s | stem.hard | drop_d | 3 | 0.589 | 0.589 | 0.606 | 0.000 | 0.000 | 0 | 0 |
| sep_htdemucs_6s | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.707 | 0.000 | 0.000 | 0 | 0 |
| sep_htdemucs_6s | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.761 | 0.004 | 0.004 | 0 | 0 |
| sep_htdemucs_6s | stem.hard | standard | 50 | 0.621 | 0.621 | 0.621 | 0.015 | 0.015 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | drop_d | 3 | 0.574 | 0.574 | 0.581 | 0.005 | 0.005 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.659 | 0.000 | 0.000 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.731 | 0.004 | 0.004 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | standard | 50 | 0.585 | 0.585 | 0.585 | 0.025 | 0.025 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | drop_d | 3 | 0.624 | 0.624 | 0.671 | 0.001 | 0.001 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.701 | 0.000 | 0.000 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.781 | 0.001 | 0.001 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | standard | 50 | 0.632 | 0.632 | 0.632 | 0.026 | 0.026 | 0 | 0 |

## Quantization (stem.hard, `easiest`, standard tuning)

Residual-flagged = share of tab events whose onset is > 60 ms from the grid (1/16, or swung 1/8); error = median |quantized onset - reference onset| over matched notes.

| variant | style | residual-flagged | quantized onset error ms |
|---|---|---|---|
| guitabbendscue2 | comping | 0.031 | 17.5 |
| guitabbendscue2 | single-line | 0.104 | 19.9 |
| guitabbendscue2 | solo_bends | 0.614 | 85.5 |
| guitabbendscue2 | two_guitars | 0.015 | 18.6 |
| guitabbendscue2 | vibrato | 0.895 | nan |
| sep_htdemucs_6s | comping | 0.040 | 21.2 |
| sep_htdemucs_6s | single-line | 0.115 | 22.2 |
| sep_htdemucs_6s | solo_bends | 0.503 | 64.5 |
| sep_htdemucs_6s | two_guitars | 0.022 | 24.0 |
| sep_htdemucs_6s | vibrato | 0.432 | 36.3 |
| sep_mel_roformer_guitar_becruily | comping | 0.047 | 19.6 |
| sep_mel_roformer_guitar_becruily | single-line | 0.117 | 20.7 |
| sep_mel_roformer_guitar_becruily | solo_bends | 0.593 | 84.2 |
| sep_mel_roformer_guitar_becruily | two_guitars | 0.026 | 19.8 |
| sep_mel_roformer_guitar_becruily | vibrato | 0.864 | 143.8 |
| sep_ens_sw_becruily | comping | 0.040 | 18.6 |
| sep_ens_sw_becruily | single-line | 0.112 | 20.7 |
| sep_ens_sw_becruily | solo_bends | 0.601 | 74.6 |
| sep_ens_sw_becruily | two_guitars | 0.021 | 21.6 |
| sep_ens_sw_becruily | vibrato | 0.910 | nan |

## Bends (stem.hard, ≥ 50 cents, matched notes)

| variant | reference bends | detected | hits | precision | recall |
|---|---|---|---|---|---|
| guitabbendscue2 | 48 | 34 | 30 | 0.882 | 0.625 |
| sep_htdemucs_6s | 48 | 14 | 14 | 1.000 | 0.292 |
| sep_mel_roformer_guitar_becruily | 48 | 36 | 31 | 0.861 | 0.646 |
| sep_ens_sw_becruily | 48 | 35 | 32 | 0.914 | 0.667 |

## Separation (uSDR of the guitar stem vs the clean guitar, dB)

| separator | band | source | items | median uSDR |
|---|---|---|---|---|
| bs_roformer_sw | easy | guitar-techs | 14 | 17.05 |
| bs_roformer_sw | easy | guitarset | 34 | 17.43 |
| bs_roformer_sw | easy | guitarset-hex | 3 | 18.34 |
| bs_roformer_sw | easy | idmt-smt-guitar | 6 | 21.41 |
| bs_roformer_sw | hard | guitar-techs | 14 | 14.29 |
| bs_roformer_sw | hard | guitarset | 34 | 14.23 |
| bs_roformer_sw | hard | guitarset-hex | 3 | 15.78 |
| bs_roformer_sw | hard | idmt-smt-guitar | 6 | 18.31 |
| ens_sw_becruily | easy | guitar-techs | 14 | 8.47 |
| ens_sw_becruily | easy | guitarset | 34 | 14.73 |
| ens_sw_becruily | easy | guitarset-hex | 3 | 15.74 |
| ens_sw_becruily | easy | idmt-smt-guitar | 6 | 18.27 |
| ens_sw_becruily | hard | guitar-techs | 14 | 7.70 |
| ens_sw_becruily | hard | guitarset | 34 | 13.06 |
| ens_sw_becruily | hard | guitarset-hex | 3 | 10.89 |
| ens_sw_becruily | hard | idmt-smt-guitar | 6 | 12.90 |
| htdemucs_6s | easy | guitar-techs | 14 | 2.52 |
| htdemucs_6s | easy | guitarset | 34 | 11.38 |
| htdemucs_6s | easy | guitarset-hex | 3 | 11.59 |
| htdemucs_6s | easy | idmt-smt-guitar | 6 | 8.38 |
| htdemucs_6s | hard | guitar-techs | 14 | 2.95 |
| htdemucs_6s | hard | guitarset | 34 | 10.23 |
| htdemucs_6s | hard | guitarset-hex | 3 | 10.79 |
| htdemucs_6s | hard | idmt-smt-guitar | 6 | 6.22 |
| mel_roformer_guitar_becruily | easy | guitar-techs | 14 | 3.83 |
| mel_roformer_guitar_becruily | easy | guitarset | 34 | 11.72 |
| mel_roformer_guitar_becruily | easy | guitarset-hex | 3 | 11.93 |
| mel_roformer_guitar_becruily | easy | idmt-smt-guitar | 6 | 14.31 |
| mel_roformer_guitar_becruily | hard | guitar-techs | 14 | 3.19 |
| mel_roformer_guitar_becruily | hard | guitarset | 34 | 9.96 |
| mel_roformer_guitar_becruily | hard | guitarset-hex | 3 | 7.53 |
| mel_roformer_guitar_becruily | hard | idmt-smt-guitar | 6 | 8.74 |

## Time per 30 s of audio (this machine, median)

- `guitabbendscue2` separation (bs_roformer_sw): 4.6 s
- `sep_htdemucs_6s` separation (htdemucs_6s): 1.7 s
- `sep_htdemucs_6s` notes.guitar: 2.0 s
- `sep_mel_roformer_guitar_becruily` separation (mel_roformer_guitar_becruily): 2.6 s
- `sep_mel_roformer_guitar_becruily` notes.guitar: 2.5 s
- `sep_ens_sw_becruily` separation (ens_sw_becruily): 0.0 s
- `sep_ens_sw_becruily` notes.guitar: 1.8 s

Per-item rows: `2026-10-29-separation.csv`. Command: `eval/p2g.py report --variant guitabbendscue2 sep_htdemucs_6s sep_mel_roformer_guitar_becruily sep_ens_sw_becruily --name separation`
