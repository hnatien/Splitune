# Prototype 2g — guitar accuracy end to end (2026-11-06)

git `cb9c882+dirty` · models: bs-roformer-sw BS-Roformer-SW, guitab-e25 1.1.1-e25, mel-roformer-guitar-becruily e9624f5 · notes: mir_eval 0.8.2 transcription: onset F1 (±50 ms, ±50 cents) and onset+offset F1 (offset ±max(50 ms, 20% of duration)); pitch-class F1 = onset F1 with octaves folded · tab: notes matched as for onset F1, then **TDR** = share of matched notes on the reference string and fret, **Tab F1** = notes with the right onset, pitch, string and fret (precision over all estimated notes, recall over all reference notes), pooled over items · tab through the shipped `buildTab` (`music-core` CLI, level `as_transcribed`), standard tuning unless a column says otherwise · beats: shipped beats stage on the clean guitar

Variants: `shipped` = the shipped chain on 2026-11-06: BS-Roformer-SW → Guitab E25 + A4 compensation + bends (Basic Pitch contour) → buildTab with Guitab's string probabilities as the cue (weight 2); `sep_chain_sw_becruily` = guitabbendscue2 (the shipped chain) with separator chain_sw_becruily; `sep_ens_sw_becruily` = guitabbendscue2 (the shipped chain) with separator ens_sw_becruily; `sep_mel_roformer_guitar_becruily` = guitabbendscue2 (the shipped chain) with separator mel_roformer_guitar_becruily

## GuitarSet-derived (in-sample for Basic Pitch, YourMT3+)

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| shipped · clean | 57 | 0.896 | 0.889 | 0.907 | 0.693 | 0.898 | 0.747 | 0.847 | 0.754 | 0.855 |
| shipped · stem.easy | 57 | 0.890 | 0.891 | 0.893 | 0.650 | 0.892 | 0.735 | 0.842 | 0.738 | 0.845 |
| shipped · stem.hard | 57 | 0.859 | 0.845 | 0.882 | 0.607 | 0.861 | 0.708 | 0.834 | 0.711 | 0.837 |
| sep_chain_sw_becruily · stem.easy | 57 | 0.879 | 0.888 | 0.877 | 0.637 | 0.882 | - | - | - | - |
| sep_chain_sw_becruily · stem.hard | 57 | 0.816 | 0.810 | 0.842 | 0.542 | 0.820 | - | - | - | - |
| sep_ens_sw_becruily · stem.easy | 57 | 0.879 | 0.877 | 0.886 | 0.626 | 0.882 | - | - | - | - |
| sep_ens_sw_becruily · stem.hard | 57 | 0.827 | 0.798 | 0.876 | 0.558 | 0.829 | - | - | - | - |
| sep_mel_roformer_guitar_becruily · stem.easy | 57 | 0.849 | 0.853 | 0.853 | 0.564 | 0.853 | - | - | - | - |
| sep_mel_roformer_guitar_becruily · stem.hard | 57 | 0.784 | 0.761 | 0.829 | 0.478 | 0.790 | - | - | - | - |

## other sources

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| shipped · clean | 71 | 0.776 | 0.828 | 0.743 | 0.340 | 0.783 | 0.480 | 0.625 | 0.520 | 0.676 |
| shipped · stem.easy | 71 | 0.714 | 0.810 | 0.662 | 0.258 | 0.721 | 0.461 | 0.610 | 0.497 | 0.659 |
| shipped · stem.hard | 71 | 0.613 | 0.641 | 0.637 | 0.199 | 0.620 | 0.384 | 0.592 | 0.401 | 0.620 |
| sep_chain_sw_becruily · stem.easy | 71 | 0.668 | 0.794 | 0.602 | 0.239 | 0.675 | - | - | - | - |
| sep_chain_sw_becruily · stem.hard | 71 | 0.523 | 0.568 | 0.557 | 0.168 | 0.532 | - | - | - | - |
| sep_ens_sw_becruily · stem.easy | 71 | 0.687 | 0.732 | 0.676 | 0.238 | 0.695 | - | - | - | - |
| sep_ens_sw_becruily · stem.hard | 71 | 0.539 | 0.517 | 0.642 | 0.163 | 0.549 | - | - | - | - |
| sep_mel_roformer_guitar_becruily · stem.easy | 71 | 0.631 | 0.698 | 0.616 | 0.184 | 0.641 | - | - | - | - |
| sep_mel_roformer_guitar_becruily · stem.hard | 71 | 0.471 | 0.467 | 0.553 | 0.107 | 0.484 | - | - | - | - |

## Held-out tiers with 95 % intervals (stem.hard; item bootstrap, 2000 resamples)

Tab F1 / TDR use the tab production builds (the notes' tuning suggestion applied). Δ = paired difference to `shipped` on the same items; ✓ = interval excludes 0.

### GuitarSet player 05

| variant | items | onset F1 | onset+offset F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|
| shipped | 33 | 0.863 [0.830, 0.892] | 0.618 [0.555, 0.673] | 0.652 [0.504, 0.787] | 0.759 [0.592, 0.906] | 0.658 [0.509, 0.794] | 0.766 [0.595, 0.914] |
| sep_chain_sw_becruily | 33 | 0.801 [0.729, 0.858] | 0.530 [0.458, 0.597] | 0.579 [0.424, 0.722] | 0.740 [0.559, 0.897] | 0.591 [0.434, 0.732] | 0.755 [0.569, 0.914] |
| Δ sep_chain_sw_becruily | 33 | -0.063 [-0.133, -0.002] ✓ | -0.087 [-0.163, -0.022] ✓ | -0.072 [-0.177, -0.006] ✓ | -0.018 [-0.054, +0.007] | -0.067 [-0.170, -0.000] ✓ | -0.010 [-0.047, +0.017] |
| sep_ens_sw_becruily | 33 | 0.827 [0.785, 0.864] | 0.565 [0.499, 0.626] | 0.619 [0.478, 0.748] | 0.748 [0.579, 0.896] | 0.634 [0.490, 0.765] | 0.765 [0.593, 0.918] |
| Δ sep_ens_sw_becruily | 33 | -0.036 [-0.066, -0.013] ✓ | -0.052 [-0.085, -0.026] ✓ | -0.032 [-0.060, -0.012] ✓ | -0.011 [-0.028, +0.002] | -0.024 [-0.047, -0.007] ✓ | -0.001 [-0.013, +0.011] |
| sep_mel_roformer_guitar_becruily | 33 | 0.781 [0.735, 0.824] | 0.482 [0.421, 0.540] | 0.578 [0.444, 0.699] | 0.746 [0.572, 0.898] | 0.583 [0.447, 0.704] | 0.752 [0.576, 0.905] |
| Δ sep_mel_roformer_guitar_becruily | 33 | -0.082 [-0.127, -0.043] ✓ | -0.135 [-0.187, -0.087] ✓ | -0.073 [-0.120, -0.039] ✓ | -0.013 [-0.037, +0.013] | -0.075 [-0.123, -0.041] ✓ | -0.014 [-0.040, +0.012] |

### Guitar-TECHS

| variant | items | onset F1 | onset+offset F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|
| shipped | 24 | 0.522 [0.416, 0.622] | 0.166 [0.109, 0.230] | 0.352 [0.247, 0.454] | 0.609 [0.474, 0.743] | 0.361 [0.263, 0.457] | 0.626 [0.513, 0.734] |
| sep_chain_sw_becruily | 24 | 0.389 [0.293, 0.491] | 0.101 [0.059, 0.152] | 0.239 [0.162, 0.328] | 0.566 [0.434, 0.710] | 0.248 [0.175, 0.327] | 0.587 [0.492, 0.715] |
| Δ sep_chain_sw_becruily | 24 | -0.133 [-0.221, -0.051] ✓ | -0.064 [-0.109, -0.021] ✓ | -0.113 [-0.199, -0.037] ✓ | -0.044 [-0.116, +0.028] | -0.113 [-0.213, -0.022] ✓ | -0.039 [-0.161, +0.073] |
| sep_ens_sw_becruily | 24 | 0.456 [0.360, 0.555] | 0.128 [0.076, 0.186] | 0.311 [0.217, 0.405] | 0.597 [0.472, 0.710] | 0.325 [0.237, 0.415] | 0.624 [0.519, 0.724] |
| Δ sep_ens_sw_becruily | 24 | -0.066 [-0.129, -0.013] ✓ | -0.038 [-0.066, -0.012] ✓ | -0.041 [-0.097, -0.001] ✓ | -0.013 [-0.053, +0.021] | -0.036 [-0.081, -0.003] ✓ | -0.002 [-0.036, +0.025] |
| sep_mel_roformer_guitar_becruily | 24 | 0.364 [0.276, 0.452] | 0.068 [0.035, 0.107] | 0.222 [0.161, 0.286] | 0.560 [0.433, 0.695] | 0.228 [0.173, 0.286] | 0.574 [0.478, 0.687] |
| Δ sep_mel_roformer_guitar_becruily | 24 | -0.157 [-0.236, -0.083] ✓ | -0.098 [-0.142, -0.056] ✓ | -0.130 [-0.204, -0.062] ✓ | -0.050 [-0.108, +0.012] | -0.134 [-0.214, -0.061] ✓ | -0.052 [-0.129, +0.024] |

### IDMT-SMT-Guitar

| variant | items | onset F1 | onset+offset F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|
| shipped | 20 | 0.741 [0.682, 0.799] | 0.241 [0.186, 0.297] | 0.339 [0.269, 0.409] | 0.461 [0.376, 0.542] | 0.389 [0.323, 0.459] | 0.530 [0.452, 0.605] |
| sep_chain_sw_becruily | 20 | 0.622 [0.555, 0.687] | 0.222 [0.169, 0.280] | 0.282 [0.218, 0.353] | 0.459 [0.369, 0.554] | 0.318 [0.255, 0.382] | 0.518 [0.431, 0.597] |
| Δ sep_chain_sw_becruily | 20 | -0.119 [-0.210, -0.029] ✓ | -0.019 [-0.067, +0.032] | -0.057 [-0.125, +0.009] | -0.002 [-0.078, +0.069] | -0.072 [-0.153, -0.001] ✓ | -0.013 [-0.094, +0.069] |
| sep_ens_sw_becruily | 20 | 0.635 [0.579, 0.695] | 0.198 [0.150, 0.247] | 0.276 [0.216, 0.338] | 0.443 [0.350, 0.526] | 0.314 [0.254, 0.379] | 0.504 [0.421, 0.578] |
| Δ sep_ens_sw_becruily | 20 | -0.107 [-0.158, -0.065] ✓ | -0.043 [-0.070, -0.019] ✓ | -0.063 [-0.105, -0.025] ✓ | -0.018 [-0.055, +0.017] | -0.075 [-0.122, -0.035] ✓ | -0.026 [-0.067, +0.010] |
| sep_mel_roformer_guitar_becruily | 20 | 0.559 [0.507, 0.610] | 0.133 [0.088, 0.189] | 0.252 [0.200, 0.306] | 0.459 [0.372, 0.542] | 0.281 [0.233, 0.329] | 0.511 [0.434, 0.583] |
| Δ sep_mel_roformer_guitar_becruily | 20 | -0.183 [-0.257, -0.105] ✓ | -0.108 [-0.163, -0.052] ✓ | -0.087 [-0.145, -0.025] ✓ | -0.002 [-0.060, +0.057] | -0.109 [-0.171, -0.043] ✓ | -0.019 [-0.082, +0.047] |

## By style (stem.hard; the sources column says which tier)

| variant | style | sources | items | onset F1 | onset P | onset R | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| shipped | comping | guitar-techs,guitarset,guitarset-hex | 35 | 0.805 | 0.825 | 0.800 | 0.666 | 0.810 | 0.668 | 0.812 |
| shipped | palmmute | guitar-techs | 6 | 0.250 | 0.420 | 0.200 | 0.122 | 0.600 | 0.122 | 0.600 |
| shipped | pieces | idmt-smt-guitar | 2 | 0.601 | 0.515 | 0.768 | 0.335 | 0.561 | 0.371 | 0.621 |
| shipped | single-line | guitar-techs,guitarset,idmt-smt-guitar | 66 | 0.763 | 0.760 | 0.785 | 0.540 | 0.700 | 0.550 | 0.713 |
| shipped | solo_bends | idmt-smt-guitar | 9 | 0.761 | 0.724 | 0.829 | 0.474 | 0.625 | 0.526 | 0.694 |
| shipped | two_guitars | guitarset | 4 | 0.773 | 0.863 | 0.704 | 0.662 | 0.856 | 0.677 | 0.876 |
| shipped | vibrato | guitar-techs | 6 | 0.207 | 0.185 | 0.451 | 0.074 | 0.733 | 0.064 | 0.633 |
| sep_chain_sw_becruily | comping | guitar-techs,guitarset,guitarset-hex | 35 | 0.751 | 0.770 | 0.751 | - | - | - | - |
| sep_chain_sw_becruily | palmmute | guitar-techs | 6 | 0.110 | 0.077 | 0.294 | - | - | - | - |
| sep_chain_sw_becruily | pieces | idmt-smt-guitar | 2 | 0.706 | 0.776 | 0.667 | - | - | - | - |
| sep_chain_sw_becruily | single-line | guitar-techs,guitarset,idmt-smt-guitar | 66 | 0.697 | 0.731 | 0.706 | - | - | - | - |
| sep_chain_sw_becruily | solo_bends | idmt-smt-guitar | 9 | 0.574 | 0.528 | 0.721 | - | - | - | - |
| sep_chain_sw_becruily | two_guitars | guitarset | 4 | 0.762 | 0.840 | 0.702 | - | - | - | - |
| sep_chain_sw_becruily | vibrato | guitar-techs | 6 | 0.179 | 0.206 | 0.375 | - | - | - | - |
| sep_ens_sw_becruily | comping | guitar-techs,guitarset,guitarset-hex | 35 | 0.776 | 0.777 | 0.790 | - | - | - | - |
| sep_ens_sw_becruily | palmmute | guitar-techs | 6 | 0.120 | 0.094 | 0.315 | - | - | - | - |
| sep_ens_sw_becruily | pieces | idmt-smt-guitar | 2 | 0.583 | 0.469 | 0.781 | - | - | - | - |
| sep_ens_sw_becruily | single-line | guitar-techs,guitarset,idmt-smt-guitar | 66 | 0.710 | 0.679 | 0.776 | - | - | - | - |
| sep_ens_sw_becruily | solo_bends | idmt-smt-guitar | 9 | 0.630 | 0.545 | 0.806 | - | - | - | - |
| sep_ens_sw_becruily | two_guitars | guitarset | 4 | 0.753 | 0.824 | 0.697 | - | - | - | - |
| sep_ens_sw_becruily | vibrato | guitar-techs | 6 | 0.133 | 0.076 | 0.535 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | comping | guitar-techs,guitarset,guitarset-hex | 35 | 0.710 | 0.709 | 0.733 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | palmmute | guitar-techs | 6 | 0.110 | 0.093 | 0.265 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | pieces | idmt-smt-guitar | 2 | 0.578 | 0.503 | 0.705 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | single-line | guitar-techs,guitarset,idmt-smt-guitar | 66 | 0.645 | 0.640 | 0.686 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | solo_bends | idmt-smt-guitar | 9 | 0.554 | 0.466 | 0.747 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | two_guitars | guitarset | 4 | 0.684 | 0.720 | 0.655 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | vibrato | guitar-techs | 6 | 0.200 | 0.141 | 0.529 | - | - | - | - |

## By tuning (stem.hard, `easiest`): standard-tuning tab vs the reference tuning and capo

| variant | tuning | items | onset F1 | Tab F1 std | Tab F1 ref tuning | unplayable std | unplayable ref tuning |
|---|---|---|---|---|---|---|---|
| shipped | capo | 2 | 0.936 | 0.832 | 0.804 | 0.000 | 0.006 |
| shipped | drop_d | 3 | 0.796 | 0.677 | 0.713 | 0.002 | 0.001 |
| shipped | full_step_down | 2 | 0.850 | 0.000 | 0.747 | 0.000 | 0.000 |
| shipped | half_step_down | 2 | 0.856 | 0.000 | 0.834 | 0.002 | 0.002 |
| shipped | off_a440 | 4 | 0.937 | 0.879 | 0.879 | 0.005 | 0.005 |
| shipped | standard | 115 | 0.704 | 0.619 | 0.619 | 0.035 | 0.035 |
| sep_chain_sw_becruily | capo | 2 | 0.940 | - | - | - | - |
| sep_chain_sw_becruily | drop_d | 3 | 0.750 | - | - | - | - |
| sep_chain_sw_becruily | full_step_down | 2 | 0.865 | - | - | - | - |
| sep_chain_sw_becruily | half_step_down | 2 | 0.861 | - | - | - | - |
| sep_chain_sw_becruily | off_a440 | 4 | 0.618 | - | - | - | - |
| sep_chain_sw_becruily | standard | 115 | 0.640 | - | - | - | - |
| sep_ens_sw_becruily | capo | 2 | 0.931 | - | - | - | - |
| sep_ens_sw_becruily | drop_d | 3 | 0.771 | - | - | - | - |
| sep_ens_sw_becruily | full_step_down | 2 | 0.838 | - | - | - | - |
| sep_ens_sw_becruily | half_step_down | 2 | 0.841 | - | - | - | - |
| sep_ens_sw_becruily | off_a440 | 4 | 0.908 | - | - | - | - |
| sep_ens_sw_becruily | standard | 115 | 0.646 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | capo | 2 | 0.923 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | drop_d | 3 | 0.694 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | full_step_down | 2 | 0.841 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | half_step_down | 2 | 0.801 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | off_a440 | 4 | 0.831 | - | - | - | - |
| sep_mel_roformer_guitar_becruily | standard | 115 | 0.588 | - | - | - | - |

## Tuning in the tab (`easiest`): standard vs the applied suggestion vs the truth

Semitone-detuned stems are the hard-band stems played back 100/200 cents lower: their true tuning is half/full step down (drop D items become drop C#/C). Applied right = the suggestion buildTab used equals the true tuning; applied wrong on standard = a non-standard tuning used on a standard-tuned excerpt.

| variant | condition | true tuning | items | Tab F1 std | Tab F1 suggested | Tab F1 true | unplayable std | unplayable suggested | applied right | applied wrong on standard |
|---|---|---|---|---|---|---|---|---|---|---|
| shipped | stem.hard | drop_d | 3 | 0.677 | 0.677 | 0.713 | 0.002 | 0.002 | 0 | 0 |
| shipped | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.747 | 0.000 | 0.000 | 0 | 0 |
| shipped | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.834 | 0.002 | 0.002 | 0 | 0 |
| shipped | stem.hard | standard | 121 | 0.634 | 0.634 | 0.634 | 0.033 | 0.033 | 0 | 0 |
| shipped | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.693 | 0.003 | 0.003 | 0 | 0 |
| shipped | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.726 | 0.011 | 0.011 | 0 | 0 |
| shipped | detune-100 | half_step_down | 121 | 0.000 | 0.000 | 0.614 | 0.032 | 0.032 | 0 | 0 |
| shipped | detune-100 | other | 2 | 0.000 | 0.000 | 0.664 | 0.000 | 0.000 | 0 | 0 |
| shipped | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.715 | 0.004 | 0.004 | 0 | 0 |
| shipped | detune-200 | full_step_down | 121 | 0.000 | 0.000 | 0.580 | 0.029 | 0.029 | 0 | 0 |
| shipped | detune-200 | other | 4 | 0.000 | 0.000 | 0.649 | 0.003 | 0.003 | 0 | 0 |
| sep_chain_sw_becruily | stem.hard | drop_d | 3 | - | 0.675 | - | - | 0.000 | 0 | 0 |
| sep_chain_sw_becruily | stem.hard | full_step_down | 2 | - | 0.000 | - | - | 0.000 | 0 | 0 |
| sep_chain_sw_becruily | stem.hard | half_step_down | 2 | - | 0.000 | - | - | 0.002 | 0 | 0 |
| sep_chain_sw_becruily | stem.hard | standard | 121 | - | 0.563 | - | - | 0.039 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | drop_d | 3 | - | 0.682 | - | - | 0.000 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | full_step_down | 2 | - | 0.000 | - | - | 0.002 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | half_step_down | 2 | - | 0.000 | - | - | 0.001 | 0 | 0 |
| sep_ens_sw_becruily | stem.hard | standard | 121 | - | 0.580 | - | - | 0.040 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | drop_d | 3 | - | 0.665 | - | - | 0.003 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | full_step_down | 2 | - | 0.000 | - | - | 0.003 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | half_step_down | 2 | - | 0.000 | - | - | 0.002 | 0 | 0 |
| sep_mel_roformer_guitar_becruily | stem.hard | standard | 121 | - | 0.526 | - | - | 0.039 | 0 | 0 |

## Detuned stems (hard-band stem re-pitched by tape speed; onset F1, all items)

| variant | stem.hard | detune+20 | detune-20 | detune+35 | detune-35 | detune+50 | detune-50 | detune-100 | detune-200 |
|---|---|---|---|---|---|---|---|---|---|
| shipped | 0.722 | - | - | - | - | - | - | 0.715 | 0.704 |
| sep_chain_sw_becruily | 0.653 | - | - | - | - | - | - | - | - |
| sep_ens_sw_becruily | 0.667 | - | - | - | - | - | - | - | - |
| sep_mel_roformer_guitar_becruily | 0.611 | - | - | - | - | - | - | - | - |

## Quantization (stem.hard, `easiest`, standard tuning)

Residual-flagged = share of tab events whose onset is > 60 ms from the grid (1/16, or swung 1/8); error = median |quantized onset - reference onset| over matched notes.

| variant | style | residual-flagged | quantized onset error ms |
|---|---|---|---|
| shipped | comping | 0.056 | 17.2 |
| shipped | palmmute | 0.328 | 89.9 |
| shipped | pieces | 0.239 | 22.4 |
| shipped | single-line | 0.157 | 28.7 |
| shipped | solo_bends | 0.196 | 45.3 |
| shipped | two_guitars | 0.012 | 17.9 |
| shipped | vibrato | 0.723 | 27.6 |
| sep_chain_sw_becruily | comping | - | nan |
| sep_chain_sw_becruily | palmmute | - | nan |
| sep_chain_sw_becruily | pieces | - | nan |
| sep_chain_sw_becruily | single-line | - | nan |
| sep_chain_sw_becruily | solo_bends | - | nan |
| sep_chain_sw_becruily | two_guitars | - | nan |
| sep_chain_sw_becruily | vibrato | - | nan |
| sep_ens_sw_becruily | comping | - | nan |
| sep_ens_sw_becruily | palmmute | - | nan |
| sep_ens_sw_becruily | pieces | - | nan |
| sep_ens_sw_becruily | single-line | - | nan |
| sep_ens_sw_becruily | solo_bends | - | nan |
| sep_ens_sw_becruily | two_guitars | - | nan |
| sep_ens_sw_becruily | vibrato | - | nan |
| sep_mel_roformer_guitar_becruily | comping | - | nan |
| sep_mel_roformer_guitar_becruily | palmmute | - | nan |
| sep_mel_roformer_guitar_becruily | pieces | - | nan |
| sep_mel_roformer_guitar_becruily | single-line | - | nan |
| sep_mel_roformer_guitar_becruily | solo_bends | - | nan |
| sep_mel_roformer_guitar_becruily | two_guitars | - | nan |
| sep_mel_roformer_guitar_becruily | vibrato | - | nan |

## Bends (stem.hard, ≥ 50 cents, matched notes)

| variant | reference bends | detected | hits | precision | recall |
|---|---|---|---|---|---|
| shipped | 78 | 54 | 50 | 0.926 | 0.641 |
| sep_chain_sw_becruily | 78 | 57 | 44 | 0.772 | 0.564 |
| sep_ens_sw_becruily | 78 | 53 | 46 | 0.868 | 0.590 |
| sep_mel_roformer_guitar_becruily | 78 | 43 | 34 | 0.791 | 0.436 |

## Separation (uSDR of the guitar stem vs the clean guitar, dB)

| separator | band | source | items | median uSDR |
|---|---|---|---|---|
| bs_roformer_sw | easy | guitar-techs | 42 | 18.82 |
| bs_roformer_sw | easy | guitarset | 54 | 17.38 |
| bs_roformer_sw | easy | guitarset-hex | 3 | 17.53 |
| bs_roformer_sw | easy | idmt-smt-guitar | 29 | 20.54 |
| bs_roformer_sw | hard | guitar-techs | 42 | 15.31 |
| bs_roformer_sw | hard | guitarset | 54 | 14.90 |
| bs_roformer_sw | hard | guitarset-hex | 3 | 14.46 |
| bs_roformer_sw | hard | idmt-smt-guitar | 29 | 15.89 |
| chain_sw_becruily | easy | guitar-techs | 42 | 7.56 |
| chain_sw_becruily | easy | guitarset | 54 | 16.39 |
| chain_sw_becruily | easy | guitarset-hex | 3 | 16.85 |
| chain_sw_becruily | easy | idmt-smt-guitar | 29 | 12.57 |
| chain_sw_becruily | hard | guitar-techs | 42 | 3.59 |
| chain_sw_becruily | hard | guitarset | 54 | 11.84 |
| chain_sw_becruily | hard | guitarset-hex | 3 | 11.29 |
| chain_sw_becruily | hard | idmt-smt-guitar | 29 | 8.07 |
| ens_sw_becruily | easy | guitar-techs | 42 | 12.28 |
| ens_sw_becruily | easy | guitarset | 54 | 15.47 |
| ens_sw_becruily | easy | guitarset-hex | 3 | 15.58 |
| ens_sw_becruily | easy | idmt-smt-guitar | 29 | 16.01 |
| ens_sw_becruily | hard | guitar-techs | 42 | 8.30 |
| ens_sw_becruily | hard | guitarset | 54 | 12.87 |
| ens_sw_becruily | hard | guitarset-hex | 3 | 12.96 |
| ens_sw_becruily | hard | idmt-smt-guitar | 29 | 12.12 |
| mel_roformer_guitar_becruily | easy | guitar-techs | 42 | 7.11 |
| mel_roformer_guitar_becruily | easy | guitarset | 54 | 12.01 |
| mel_roformer_guitar_becruily | easy | guitarset-hex | 3 | 12.05 |
| mel_roformer_guitar_becruily | easy | idmt-smt-guitar | 29 | 11.08 |
| mel_roformer_guitar_becruily | hard | guitar-techs | 42 | 2.74 |
| mel_roformer_guitar_becruily | hard | guitarset | 54 | 9.81 |
| mel_roformer_guitar_becruily | hard | guitarset-hex | 3 | 9.97 |
| mel_roformer_guitar_becruily | hard | idmt-smt-guitar | 29 | 8.23 |

## Time per 30 s of audio (this machine, median)

- `shipped` separation (bs_roformer_sw): 5.2 s
- `shipped` notes.guitar: 2.5 s
- `sep_chain_sw_becruily` separation (chain_sw_becruily): 2.6 s
- `sep_chain_sw_becruily` notes.guitar: 2.7 s
- `sep_ens_sw_becruily` separation (ens_sw_becruily): 0.0 s
- `sep_ens_sw_becruily` notes.guitar: 2.7 s
- `sep_mel_roformer_guitar_becruily` separation (mel_roformer_guitar_becruily): 2.6 s
- `sep_mel_roformer_guitar_becruily` notes.guitar: 2.7 s

Per-item rows: `2026-11-06-separation.csv`. Command: `eval/p2g.py report --variant shipped sep_chain_sw_becruily sep_ens_sw_becruily sep_mel_roformer_guitar_becruily --name separation`
