# Prototype 2p — piano on pop material (2026-10-24, phase2-mixture)

git `fdb7248+dirty` · Transkun `2.0.1` · separator per chain · mir_eval 0.8.2: onset ±50 ms / ±50 cents; offsets ±max(50 ms, 20 % of duration) against key-release (`key`) and sustain-pedal-extended (`pedal`) references; velocity per mir_eval transcription_velocity; pitch-class = octaves folded · stem uSDR = piano stem vs the clean piano (band items) · s / 30 s = wall time of separation (stem inputs) + notes.piano on this PC (RTX 3060, CUDA), per 30 s of audio.

Tiers are reported apart; `legacy` is P2's MAESTRO + MUSDB band and BabySlakh items (key-release references only).

## baseline: by tier and condition

| tier / condition | items | onset F1 | P | R | on+off F1 (key) | on+off F1 (pedal) | on+off+vel F1 | pitch-class F1 | stem uSDR dB | off-grid share | s / 30 s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| real-solo / clean | 12 | 0.923 | 0.944 | 0.904 | 0.623 | 0.377 | 0.486 | 0.924 | — | — | 6.717 |
| real-solo / stem | 12 | 0.923 | 0.945 | 0.905 | 0.622 | 0.377 | 0.485 | 0.925 | — | — | 18.629 |
| real-solo / mixture | 12 | 0.923 | 0.944 | 0.904 | 0.623 | 0.377 | 0.486 | 0.924 | — | — | 5.001 |
| real-solo / chosen | 12 | 0.923 | 0.945 | 0.905 | 0.622 | 0.377 | 0.485 | 0.925 | — | 0.143 | 18.607 |
| real-band / clean | 8 | 0.963 | 0.966 | 0.961 | 0.648 | 0.346 | 0.550 | 0.963 | — | — | 5.035 |
| real-band / stem | 8 | 0.960 | 0.964 | 0.955 | 0.613 | 0.330 | 0.500 | 0.960 | 21.153 | — | 17.163 |
| real-band / mixture | 8 | 0.729 | 0.663 | 0.831 | 0.345 | 0.234 | 0.261 | 0.735 | — | — | 4.908 |
| real-band / chosen | 8 | 0.960 | 0.964 | 0.955 | 0.613 | 0.330 | 0.500 | 0.960 | 21.153 | 0.161 | 17.274 |
| pop-solo / clean | 12 | 0.924 | 0.926 | 0.925 | 0.594 | 0.589 | 0.389 | 0.941 | — | — | 5.309 |
| pop-solo / stem | 12 | 0.847 | 0.886 | 0.816 | 0.509 | 0.503 | 0.345 | 0.859 | — | — | 17.859 |
| pop-solo / mixture | 12 | 0.924 | 0.926 | 0.925 | 0.594 | 0.589 | 0.389 | 0.941 | — | — | 5.577 |
| pop-solo / chosen | 12 | 0.847 | 0.886 | 0.816 | 0.509 | 0.503 | 0.345 | 0.859 | — | 0.026 | 17.859 |
| pop-band / clean | 16 | 0.947 | 0.962 | 0.938 | 0.715 | 0.710 | 0.448 | 0.949 | — | — | 4.148 |
| pop-band / stem | 16 | 0.876 | 0.905 | 0.858 | 0.623 | 0.617 | 0.381 | 0.893 | 11.818 | — | 16.590 |
| pop-band / mixture | 16 | 0.661 | 0.585 | 0.825 | 0.390 | 0.386 | 0.228 | 0.691 | — | — | 4.300 |
| pop-band / chosen | 16 | 0.876 | 0.905 | 0.858 | 0.623 | 0.617 | 0.381 | 0.893 | 11.818 | 0.037 | 16.415 |
| legacy / clean | 33 | 0.949 | 0.973 | 0.932 | 0.759 | 0.759 | — | 0.952 | — | — | 6.796 |
| legacy / stem | 33 | 0.833 | 0.847 | 0.851 | 0.539 | 0.539 | — | 0.840 | 10.700 | — | 32.295 |
| legacy / mixture | 33 | 0.653 | 0.637 | 0.748 | 0.412 | 0.412 | — | 0.682 | — | — | 13.638 |
| legacy / chosen | 33 | 0.833 | 0.847 | 0.851 | 0.539 | 0.539 | — | 0.840 | 10.700 | 0.089 | 32.491 |

## baseline: chosen input by tag (all new tiers)

| tag | items | onset F1 | P | R | on+off F1 (key) | on+off F1 (pedal) | on+off+vel F1 | pitch-class F1 | stem uSDR dB | off-grid share | s / 30 s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| acoustic | 38 | 0.901 | 0.924 | 0.886 | 0.572 | 0.431 | 0.421 | 0.910 | 15.490 | 0.101 | 17.533 |
| electric | 8 | 0.931 | 0.962 | 0.905 | 0.773 | 0.767 | 0.467 | 0.938 | 12.801 | 0.000 | 17.518 |
| keys | 2 | 0.617 | 0.686 | 0.563 | 0.276 | 0.276 | 0.156 | 0.646 | — | 0.041 | 16.008 |
| solo | 24 | 0.885 | 0.915 | 0.860 | 0.566 | 0.440 | 0.415 | 0.892 | — | 0.084 | 18.233 |
| band | 24 | 0.904 | 0.925 | 0.890 | 0.620 | 0.521 | 0.420 | 0.915 | 14.930 | 0.078 | 16.701 |
| sparse | 8 | 0.977 | 0.981 | 0.974 | 0.748 | 0.554 | 0.541 | 0.977 | 23.103 | 0.065 | 16.711 |
| dense | 16 | 0.867 | 0.897 | 0.849 | 0.556 | 0.505 | 0.360 | 0.884 | 10.843 | 0.085 | 16.696 |
| featured | 6 | 0.867 | 0.880 | 0.865 | 0.727 | 0.727 | 0.405 | 0.891 | 15.812 | 0.097 | 16.258 |
| buried | 2 | 0.990 | 0.986 | 0.993 | 0.806 | 0.806 | 0.496 | 0.990 | 23.050 | 0.000 | 15.243 |
| doubled | 3 | 0.754 | 0.787 | 0.740 | 0.535 | 0.535 | 0.385 | 0.802 | 10.964 | 0.000 | 15.479 |
| heavy-pedal | 4 | 0.870 | 0.903 | 0.845 | 0.301 | 0.288 | 0.222 | 0.884 | — | 0.007 | 18.141 |
| phone | 2 | 0.509 | 0.601 | 0.441 | 0.176 | 0.163 | 0.095 | 0.537 | — | 0.042 | 16.375 |
| room | 3 | 0.845 | 0.891 | 0.811 | 0.442 | 0.461 | 0.343 | 0.855 | — | 0.000 | 17.245 |
| off-a440 | 2 | 0.987 | 0.992 | 0.982 | 0.824 | 0.824 | 0.539 | 0.987 | — | 0.100 | 19.906 |
| slakh-native | 8 | 0.854 | 0.905 | 0.819 | 0.500 | 0.487 | 0.333 | 0.870 | 6.016 | 0.001 | 16.826 |

## baseline: calibration (chosen input, held-out notes)

ECE **0.001** over 8324 notes (precision 0.917)

| band | notes | share | precision |
|---|---|---|---|
| high ≥ 0.7 | 8324 | 1.000 | 0.917 |
| medium 0.4-0.7 | 0 | 0.000 | — |
| low < 0.4 | 0 | 0.000 | — |

| bin | notes | mean confidence | precision |
|---|---|---|---|
| 0.0-0.1 | 0 | 0.000 | 0.000 |
| 0.1-0.2 | 0 | 0.000 | 0.000 |
| 0.2-0.3 | 0 | 0.000 | 0.000 |
| 0.3-0.4 | 0 | 0.000 | 0.000 |
| 0.4-0.5 | 0 | 0.000 | 0.000 |
| 0.5-0.6 | 0 | 0.000 | 0.000 |
| 0.6-0.7 | 0 | 0.000 | 0.000 |
| 0.7-0.8 | 0 | 0.000 | 0.000 |
| 0.8-0.9 | 0 | 0.000 | 0.000 |
| 0.9-1.0 | 8324 | 0.918 | 0.917 |


## baseline: input choice

No solo-piano bypass: every mixture is separated (bypass recall 0 of 24 solo items).
## yourmt3: by tier and condition

| tier / condition | items | onset F1 | P | R | on+off F1 (key) | on+off F1 (pedal) | on+off+vel F1 | pitch-class F1 | stem uSDR dB | off-grid share | s / 30 s |
|---|---|---|---|---|---|---|---|---|---|---|---|
| real-solo / clean | 12 | 0.828 | 0.834 | 0.825 | 0.409 | 0.550 | 0.153 | 0.836 | — | — | 10.240 |
| real-solo / stem | 12 | 0.832 | 0.840 | 0.828 | 0.414 | 0.554 | 0.157 | 0.841 | — | — | 22.544 |
| real-solo / mixture | 12 | 0.828 | 0.834 | 0.825 | 0.409 | 0.550 | 0.153 | 0.836 | — | — | 12.462 |
| real-band / clean | 8 | 0.894 | 0.910 | 0.880 | 0.376 | 0.558 | 0.110 | 0.899 | — | — | 5.319 |
| real-band / stem | 8 | 0.878 | 0.888 | 0.870 | 0.376 | 0.524 | 0.111 | 0.882 | 21.153 | — | 24.346 |
| real-band / mixture | 8 | 0.624 | 0.646 | 0.604 | 0.266 | 0.355 | 0.089 | 0.639 | — | — | 8.582 |
| pop-solo / clean | 12 | 0.789 | 0.818 | 0.774 | 0.419 | 0.577 | 0.170 | 0.795 | — | — | 3.479 |
| pop-solo / stem | 12 | 0.657 | 0.728 | 0.621 | 0.318 | 0.469 | 0.135 | 0.663 | — | — | 15.187 |
| pop-solo / mixture | 12 | 0.789 | 0.818 | 0.774 | 0.419 | 0.577 | 0.170 | 0.795 | — | — | 3.531 |
| pop-band / clean | 16 | 0.874 | 0.887 | 0.865 | 0.781 | 0.792 | 0.319 | 0.878 | — | — | 3.245 |
| pop-band / stem | 16 | 0.810 | 0.823 | 0.805 | 0.612 | 0.622 | 0.284 | 0.819 | 11.818 | — | 15.157 |
| pop-band / mixture | 16 | 0.779 | 0.787 | 0.774 | 0.608 | 0.612 | 0.269 | 0.786 | — | — | 4.055 |
| legacy / clean | 33 | 0.943 | 0.957 | 0.931 | 0.615 | 0.615 | — | 0.946 | — | — | 3.712 |
| legacy / stem | 33 | 0.822 | 0.857 | 0.806 | 0.422 | 0.422 | — | 0.830 | 10.700 | — | 30.457 |
| legacy / mixture | 33 | 0.876 | 0.897 | 0.861 | 0.512 | 0.512 | — | 0.890 | — | — | 4.255 |

## yourmt3: chosen input by tag (all new tiers)

| tag | items | onset F1 | P | R | on+off F1 (key) | on+off F1 (pedal) | on+off+vel F1 | pitch-class F1 | stem uSDR dB | off-grid share | s / 30 s |
|---|---|---|---|---|---|---|---|---|---|---|---|

## yourmt3: input choice

No solo-piano bypass: every mixture is separated (bypass recall 0 of 24 solo items).

## Hands (splitHands via buildPianoScore vs ASAP score staves)

231 pieces, 644613 notes: per-note agreement **0.881** (median piece 0.899, worst 0.630). Staff, not physical hand: ASAP's two MIDI tracks are the treble and bass staves of the score.

Per-item rows: `2026-10-24-phase2-mixture.csv`. Command: `eval/p2p.py report --chain baseline yourmt3 --name phase2-mixture`
