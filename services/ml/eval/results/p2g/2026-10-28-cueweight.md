# Prototype 2g — guitar accuracy end to end (2026-10-28)

git `ae85565+dirty` · models: bs-roformer-sw BS-Roformer-SW, guitab-e25 1.1.1-e25 · notes: mir_eval 0.8.2 transcription: onset F1 (±50 ms, ±50 cents) and onset+offset F1 (offset ±max(50 ms, 20% of duration)); pitch-class F1 = onset F1 with octaves folded · tab: notes matched as for onset F1, then **TDR** = share of matched notes on the reference string and fret, **Tab F1** = notes with the right onset, pitch, string and fret (precision over all estimated notes, recall over all reference notes), pooled over items · tab through the shipped `buildTab` (`music-core` CLI, level `as_transcribed`), standard tuning unless a column says otherwise · beats: shipped beats stage on the clean guitar

Variants: `guitabcue0.25` = guitab + its own string probabilities as the DP string cue, weight 0.25; `guitabcue0.5` = guitab + its own string probabilities as the DP string cue, weight 0.5; `guitabcue1` = guitab + its own string probabilities as the DP string cue, weight 1; `guitabcue2` = guitab + its own string probabilities as the DP string cue, weight 2; `guitabcue4` = guitab + its own string probabilities as the DP string cue, weight 4

## GuitarSet-derived (in-sample for Basic Pitch, YourMT3+)

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabcue0.25 · clean | 37 | 0.888 | 0.887 | 0.893 | 0.689 | 0.890 | 0.570 | 0.654 | 0.701 | 0.804 |
| guitabcue0.25 · stem.easy | 37 | 0.883 | 0.892 | 0.880 | 0.651 | 0.886 | 0.561 | 0.649 | 0.687 | 0.794 |
| guitabcue0.25 · mix.easy | 37 | 0.528 | 0.471 | 0.646 | 0.237 | 0.540 | 0.305 | 0.577 | 0.377 | 0.715 |
| guitabcue0.25 · stem.hard | 37 | 0.857 | 0.857 | 0.867 | 0.596 | 0.860 | 0.540 | 0.642 | 0.651 | 0.774 |
| guitabcue0.25 · mix.hard | 37 | 0.416 | 0.342 | 0.609 | 0.140 | 0.430 | 0.224 | 0.533 | 0.270 | 0.641 |
| guitabcue0.5 · clean | 37 | 0.888 | 0.887 | 0.893 | 0.689 | 0.890 | 0.676 | 0.775 | 0.706 | 0.809 |
| guitabcue0.5 · stem.easy | 37 | 0.883 | 0.892 | 0.880 | 0.651 | 0.886 | 0.649 | 0.750 | 0.690 | 0.798 |
| guitabcue0.5 · mix.easy | 37 | 0.528 | 0.471 | 0.646 | 0.237 | 0.540 | 0.338 | 0.641 | 0.379 | 0.718 |
| guitabcue0.5 · stem.hard | 37 | 0.857 | 0.857 | 0.867 | 0.596 | 0.860 | 0.633 | 0.753 | 0.658 | 0.782 |
| guitabcue0.5 · mix.hard | 37 | 0.416 | 0.342 | 0.609 | 0.140 | 0.430 | 0.245 | 0.583 | 0.274 | 0.651 |
| guitabcue1 · clean | 37 | 0.888 | 0.887 | 0.893 | 0.689 | 0.890 | 0.700 | 0.803 | 0.710 | 0.814 |
| guitabcue1 · stem.easy | 37 | 0.883 | 0.892 | 0.880 | 0.651 | 0.886 | 0.685 | 0.792 | 0.694 | 0.802 |
| guitabcue1 · mix.easy | 37 | 0.528 | 0.471 | 0.646 | 0.237 | 0.540 | 0.366 | 0.695 | 0.382 | 0.723 |
| guitabcue1 · stem.hard | 37 | 0.857 | 0.857 | 0.867 | 0.596 | 0.860 | 0.661 | 0.787 | 0.663 | 0.789 |
| guitabcue1 · mix.hard | 37 | 0.416 | 0.342 | 0.609 | 0.140 | 0.430 | 0.261 | 0.621 | 0.276 | 0.656 |
| guitabcue2 · clean | 37 | 0.888 | 0.887 | 0.893 | 0.689 | 0.890 | 0.706 | 0.809 | 0.712 | 0.816 |
| guitabcue2 · stem.easy | 37 | 0.883 | 0.892 | 0.880 | 0.651 | 0.886 | 0.692 | 0.800 | 0.694 | 0.803 |
| guitabcue2 · mix.easy | 37 | 0.528 | 0.471 | 0.646 | 0.237 | 0.540 | 0.375 | 0.712 | 0.385 | 0.731 |
| guitabcue2 · stem.hard | 37 | 0.857 | 0.857 | 0.867 | 0.596 | 0.860 | 0.664 | 0.790 | 0.664 | 0.790 |
| guitabcue2 · mix.hard | 37 | 0.416 | 0.342 | 0.609 | 0.140 | 0.430 | 0.270 | 0.642 | 0.279 | 0.663 |
| guitabcue4 · clean | 37 | 0.888 | 0.887 | 0.893 | 0.689 | 0.890 | 0.710 | 0.814 | 0.712 | 0.816 |
| guitabcue4 · stem.easy | 37 | 0.883 | 0.892 | 0.880 | 0.651 | 0.886 | 0.694 | 0.802 | 0.696 | 0.805 |
| guitabcue4 · mix.easy | 37 | 0.528 | 0.471 | 0.646 | 0.237 | 0.540 | 0.378 | 0.716 | 0.387 | 0.733 |
| guitabcue4 · stem.hard | 37 | 0.857 | 0.857 | 0.867 | 0.596 | 0.860 | 0.665 | 0.791 | 0.667 | 0.793 |
| guitabcue4 · mix.hard | 37 | 0.416 | 0.342 | 0.609 | 0.140 | 0.430 | 0.274 | 0.652 | 0.279 | 0.663 |

## other sources

| variant · condition | items | onset F1 | onset P | onset R | onset+offset F1 | pitch-class F1 | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabcue0.25 · clean | 20 | 0.768 | 0.826 | 0.736 | 0.328 | 0.772 | 0.369 | 0.504 | 0.464 | 0.633 |
| guitabcue0.25 · stem.easy | 20 | 0.674 | 0.756 | 0.625 | 0.264 | 0.678 | 0.364 | 0.505 | 0.442 | 0.614 |
| guitabcue0.25 · mix.easy | 20 | 0.290 | 0.250 | 0.462 | 0.057 | 0.302 | 0.141 | 0.471 | 0.167 | 0.557 |
| guitabcue0.25 · stem.hard | 20 | 0.643 | 0.712 | 0.610 | 0.257 | 0.649 | 0.333 | 0.498 | 0.407 | 0.609 |
| guitabcue0.25 · mix.hard | 20 | 0.217 | 0.162 | 0.434 | 0.035 | 0.227 | 0.107 | 0.478 | 0.129 | 0.576 |
| guitabcue0.5 · clean | 20 | 0.768 | 0.826 | 0.736 | 0.328 | 0.772 | 0.395 | 0.539 | 0.482 | 0.656 |
| guitabcue0.5 · stem.easy | 20 | 0.674 | 0.756 | 0.625 | 0.264 | 0.678 | 0.378 | 0.524 | 0.454 | 0.630 |
| guitabcue0.5 · mix.easy | 20 | 0.290 | 0.250 | 0.462 | 0.057 | 0.302 | 0.147 | 0.493 | 0.170 | 0.570 |
| guitabcue0.5 · stem.hard | 20 | 0.643 | 0.712 | 0.610 | 0.257 | 0.649 | 0.350 | 0.523 | 0.413 | 0.617 |
| guitabcue0.5 · mix.hard | 20 | 0.217 | 0.162 | 0.434 | 0.035 | 0.227 | 0.111 | 0.496 | 0.130 | 0.579 |
| guitabcue1 · clean | 20 | 0.768 | 0.826 | 0.736 | 0.328 | 0.772 | 0.438 | 0.597 | 0.488 | 0.665 |
| guitabcue1 · stem.easy | 20 | 0.674 | 0.756 | 0.625 | 0.264 | 0.678 | 0.422 | 0.585 | 0.461 | 0.640 |
| guitabcue1 · mix.easy | 20 | 0.290 | 0.250 | 0.462 | 0.057 | 0.302 | 0.156 | 0.522 | 0.172 | 0.573 |
| guitabcue1 · stem.hard | 20 | 0.643 | 0.712 | 0.610 | 0.257 | 0.649 | 0.389 | 0.581 | 0.415 | 0.621 |
| guitabcue1 · mix.hard | 20 | 0.217 | 0.162 | 0.434 | 0.035 | 0.227 | 0.118 | 0.528 | 0.130 | 0.582 |
| guitabcue2 · clean | 20 | 0.768 | 0.826 | 0.736 | 0.328 | 0.772 | 0.458 | 0.624 | 0.486 | 0.663 |
| guitabcue2 · stem.easy | 20 | 0.674 | 0.756 | 0.625 | 0.264 | 0.678 | 0.443 | 0.615 | 0.470 | 0.653 |
| guitabcue2 · mix.easy | 20 | 0.290 | 0.250 | 0.462 | 0.057 | 0.302 | 0.163 | 0.545 | 0.174 | 0.580 |
| guitabcue2 · stem.hard | 20 | 0.643 | 0.712 | 0.610 | 0.257 | 0.649 | 0.402 | 0.601 | 0.422 | 0.630 |
| guitabcue2 · mix.hard | 20 | 0.217 | 0.162 | 0.434 | 0.035 | 0.227 | 0.122 | 0.544 | 0.129 | 0.573 |
| guitabcue4 · clean | 20 | 0.768 | 0.826 | 0.736 | 0.328 | 0.772 | 0.472 | 0.644 | 0.484 | 0.659 |
| guitabcue4 · stem.easy | 20 | 0.674 | 0.756 | 0.625 | 0.264 | 0.678 | 0.460 | 0.639 | 0.471 | 0.654 |
| guitabcue4 · mix.easy | 20 | 0.290 | 0.250 | 0.462 | 0.057 | 0.302 | 0.168 | 0.562 | 0.176 | 0.589 |
| guitabcue4 · stem.hard | 20 | 0.643 | 0.712 | 0.610 | 0.257 | 0.649 | 0.405 | 0.605 | 0.422 | 0.631 |
| guitabcue4 · mix.hard | 20 | 0.217 | 0.162 | 0.434 | 0.035 | 0.227 | 0.123 | 0.550 | 0.128 | 0.569 |

## By style (stem.hard; the sources column says which tier)

| variant | style | sources | items | onset F1 | onset P | onset R | Tab F1 easiest | TDR easiest | Tab F1 as_played | TDR as_played |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabcue0.25 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.827 | 0.776 | 0.535 | 0.663 | 0.602 | 0.746 |
| guitabcue0.25 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.849 | 0.863 | 0.848 | 0.402 | 0.484 | 0.595 | 0.716 |
| guitabcue0.25 | solo_bends | idmt-smt-guitar | 3 | 0.706 | 0.630 | 0.822 | 0.232 | 0.337 | 0.330 | 0.478 |
| guitabcue0.25 | two_guitars | guitarset | 4 | 0.764 | 0.862 | 0.693 | 0.607 | 0.788 | 0.667 | 0.867 |
| guitabcue0.25 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |
| guitabcue0.5 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.827 | 0.776 | 0.589 | 0.730 | 0.606 | 0.750 |
| guitabcue0.5 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.849 | 0.863 | 0.848 | 0.545 | 0.656 | 0.613 | 0.737 |
| guitabcue0.5 | solo_bends | idmt-smt-guitar | 3 | 0.706 | 0.630 | 0.822 | 0.266 | 0.385 | 0.316 | 0.459 |
| guitabcue0.5 | two_guitars | guitarset | 4 | 0.764 | 0.862 | 0.693 | 0.633 | 0.822 | 0.666 | 0.865 |
| guitabcue0.5 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |
| guitabcue1 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.827 | 0.776 | 0.608 | 0.753 | 0.610 | 0.756 |
| guitabcue1 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.849 | 0.863 | 0.848 | 0.604 | 0.727 | 0.616 | 0.742 |
| guitabcue1 | solo_bends | idmt-smt-guitar | 3 | 0.706 | 0.630 | 0.822 | 0.290 | 0.420 | 0.337 | 0.488 |
| guitabcue1 | two_guitars | guitarset | 4 | 0.764 | 0.862 | 0.693 | 0.656 | 0.853 | 0.671 | 0.871 |
| guitabcue1 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |
| guitabcue2 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.827 | 0.776 | 0.611 | 0.757 | 0.610 | 0.756 |
| guitabcue2 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.849 | 0.863 | 0.848 | 0.613 | 0.738 | 0.622 | 0.749 |
| guitabcue2 | solo_bends | idmt-smt-guitar | 3 | 0.706 | 0.630 | 0.822 | 0.316 | 0.459 | 0.357 | 0.517 |
| guitabcue2 | two_guitars | guitarset | 4 | 0.764 | 0.862 | 0.693 | 0.661 | 0.859 | 0.675 | 0.877 |
| guitabcue2 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |
| guitabcue4 | comping | guitar-techs,guitarset,guitarset-hex | 23 | 0.790 | 0.827 | 0.776 | 0.610 | 0.756 | 0.612 | 0.759 |
| guitabcue4 | single-line | guitar-techs,guitarset,idmt-smt-guitar | 25 | 0.849 | 0.863 | 0.848 | 0.615 | 0.740 | 0.625 | 0.752 |
| guitabcue4 | solo_bends | idmt-smt-guitar | 3 | 0.706 | 0.630 | 0.822 | 0.310 | 0.449 | 0.337 | 0.488 |
| guitabcue4 | two_guitars | guitarset | 4 | 0.764 | 0.862 | 0.693 | 0.671 | 0.871 | 0.679 | 0.882 |
| guitabcue4 | vibrato | guitar-techs | 2 | 0.000 | 0.000 | 0.000 | 0.000 | - | 0.000 | - |

## By tuning (stem.hard, `easiest`): standard-tuning tab vs the reference tuning and capo

| variant | tuning | items | onset F1 | Tab F1 std | Tab F1 ref tuning | unplayable std | unplayable ref tuning |
|---|---|---|---|---|---|---|---|
| guitabcue0.25 | capo | 2 | 0.874 | 0.234 | 0.253 | 0.006 | 0.012 |
| guitabcue0.25 | drop_d | 3 | 0.822 | 0.607 | 0.635 | 0.001 | 0.001 |
| guitabcue0.25 | full_step_down | 2 | 0.869 | 0.000 | 0.621 | 0.002 | 0.002 |
| guitabcue0.25 | half_step_down | 2 | 0.847 | 0.000 | 0.806 | 0.000 | 0.000 |
| guitabcue0.25 | off_a440 | 4 | 0.926 | 0.667 | 0.667 | 0.007 | 0.007 |
| guitabcue0.25 | standard | 44 | 0.755 | 0.534 | 0.534 | 0.020 | 0.020 |
| guitabcue0.5 | capo | 2 | 0.874 | 0.461 | 0.513 | 0.006 | 0.012 |
| guitabcue0.5 | drop_d | 3 | 0.822 | 0.647 | 0.679 | 0.001 | 0.001 |
| guitabcue0.5 | full_step_down | 2 | 0.869 | 0.000 | 0.631 | 0.002 | 0.002 |
| guitabcue0.5 | half_step_down | 2 | 0.847 | 0.000 | 0.808 | 0.000 | 0.000 |
| guitabcue0.5 | off_a440 | 4 | 0.926 | 0.844 | 0.844 | 0.007 | 0.007 |
| guitabcue0.5 | standard | 44 | 0.755 | 0.611 | 0.611 | 0.020 | 0.020 |
| guitabcue1 | capo | 2 | 0.874 | 0.669 | 0.675 | 0.006 | 0.012 |
| guitabcue1 | drop_d | 3 | 0.822 | 0.671 | 0.716 | 0.001 | 0.001 |
| guitabcue1 | full_step_down | 2 | 0.869 | 0.000 | 0.705 | 0.002 | 0.002 |
| guitabcue1 | half_step_down | 2 | 0.847 | 0.000 | 0.814 | 0.000 | 0.000 |
| guitabcue1 | off_a440 | 4 | 0.926 | 0.870 | 0.870 | 0.007 | 0.007 |
| guitabcue1 | standard | 44 | 0.755 | 0.643 | 0.643 | 0.020 | 0.020 |
| guitabcue2 | capo | 2 | 0.874 | 0.682 | 0.682 | 0.006 | 0.012 |
| guitabcue2 | drop_d | 3 | 0.822 | 0.682 | 0.731 | 0.001 | 0.001 |
| guitabcue2 | full_step_down | 2 | 0.869 | 0.000 | 0.718 | 0.002 | 0.002 |
| guitabcue2 | half_step_down | 2 | 0.847 | 0.000 | 0.814 | 0.000 | 0.000 |
| guitabcue2 | off_a440 | 4 | 0.926 | 0.872 | 0.872 | 0.007 | 0.007 |
| guitabcue2 | standard | 44 | 0.755 | 0.649 | 0.649 | 0.020 | 0.020 |
| guitabcue4 | capo | 2 | 0.874 | 0.682 | 0.682 | 0.006 | 0.012 |
| guitabcue4 | drop_d | 3 | 0.822 | 0.686 | 0.731 | 0.001 | 0.001 |
| guitabcue4 | full_step_down | 2 | 0.869 | 0.000 | 0.725 | 0.002 | 0.002 |
| guitabcue4 | half_step_down | 2 | 0.847 | 0.000 | 0.814 | 0.000 | 0.000 |
| guitabcue4 | off_a440 | 4 | 0.926 | 0.870 | 0.870 | 0.007 | 0.007 |
| guitabcue4 | standard | 44 | 0.755 | 0.650 | 0.650 | 0.020 | 0.020 |

## Tuning in the tab (`easiest`): standard vs the applied suggestion vs the truth

Semitone-detuned stems are the hard-band stems played back 100/200 cents lower: their true tuning is half/full step down (drop D items become drop C#/C). Applied right = the suggestion buildTab used equals the true tuning; applied wrong on standard = a non-standard tuning used on a standard-tuned excerpt.

| variant | condition | true tuning | items | Tab F1 std | Tab F1 suggested | Tab F1 true | unplayable std | unplayable suggested | applied right | applied wrong on standard |
|---|---|---|---|---|---|---|---|---|---|---|
| guitabcue0.25 | stem.hard | drop_d | 3 | 0.607 | 0.607 | 0.635 | 0.001 | 0.001 | 0 | 0 |
| guitabcue0.25 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.621 | 0.002 | 0.002 | 0 | 0 |
| guitabcue0.25 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.806 | 0.000 | 0.000 | 0 | 0 |
| guitabcue0.25 | stem.hard | standard | 50 | 0.539 | 0.539 | 0.540 | 0.018 | 0.018 | 0 | 0 |
| guitabcue0.25 | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.650 | 0.005 | 0.005 | 0 | 0 |
| guitabcue0.25 | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.771 | 0.021 | 0.021 | 0 | 0 |
| guitabcue0.25 | detune-100 | half_step_down | 50 | 0.000 | 0.000 | 0.501 | 0.022 | 0.022 | 0 | 0 |
| guitabcue0.25 | detune-100 | other | 2 | 0.000 | 0.000 | 0.524 | 0.014 | 0.014 | 0 | 0 |
| guitabcue0.25 | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.690 | 0.005 | 0.005 | 0 | 0 |
| guitabcue0.25 | detune-200 | full_step_down | 50 | 0.000 | 0.000 | 0.497 | 0.027 | 0.027 | 0 | 0 |
| guitabcue0.25 | detune-200 | other | 4 | 0.000 | 0.000 | 0.595 | 0.003 | 0.003 | 0 | 0 |
| guitabcue0.5 | stem.hard | drop_d | 3 | 0.647 | 0.647 | 0.679 | 0.001 | 0.001 | 0 | 0 |
| guitabcue0.5 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.631 | 0.002 | 0.002 | 0 | 0 |
| guitabcue0.5 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.808 | 0.000 | 0.000 | 0 | 0 |
| guitabcue0.5 | stem.hard | standard | 50 | 0.628 | 0.628 | 0.629 | 0.018 | 0.018 | 0 | 0 |
| guitabcue0.5 | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.674 | 0.005 | 0.005 | 0 | 0 |
| guitabcue0.5 | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.736 | 0.021 | 0.021 | 0 | 0 |
| guitabcue0.5 | detune-100 | half_step_down | 50 | 0.000 | 0.000 | 0.588 | 0.022 | 0.022 | 0 | 0 |
| guitabcue0.5 | detune-100 | other | 2 | 0.000 | 0.000 | 0.550 | 0.014 | 0.014 | 0 | 0 |
| guitabcue0.5 | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.696 | 0.005 | 0.005 | 0 | 0 |
| guitabcue0.5 | detune-200 | full_step_down | 50 | 0.000 | 0.000 | 0.567 | 0.027 | 0.027 | 0 | 0 |
| guitabcue0.5 | detune-200 | other | 4 | 0.000 | 0.000 | 0.636 | 0.003 | 0.003 | 0 | 0 |
| guitabcue1 | stem.hard | drop_d | 3 | 0.671 | 0.671 | 0.716 | 0.001 | 0.001 | 0 | 0 |
| guitabcue1 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.705 | 0.002 | 0.002 | 0 | 0 |
| guitabcue1 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.814 | 0.000 | 0.000 | 0 | 0 |
| guitabcue1 | stem.hard | standard | 50 | 0.663 | 0.663 | 0.664 | 0.018 | 0.018 | 0 | 0 |
| guitabcue1 | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.691 | 0.005 | 0.005 | 0 | 0 |
| guitabcue1 | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.740 | 0.021 | 0.021 | 0 | 0 |
| guitabcue1 | detune-100 | half_step_down | 50 | 0.000 | 0.000 | 0.627 | 0.022 | 0.022 | 0 | 0 |
| guitabcue1 | detune-100 | other | 2 | 0.000 | 0.000 | 0.596 | 0.014 | 0.014 | 0 | 0 |
| guitabcue1 | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.732 | 0.005 | 0.005 | 0 | 0 |
| guitabcue1 | detune-200 | full_step_down | 50 | 0.000 | 0.000 | 0.607 | 0.027 | 0.027 | 0 | 0 |
| guitabcue1 | detune-200 | other | 4 | 0.000 | 0.000 | 0.658 | 0.003 | 0.003 | 0 | 0 |
| guitabcue2 | stem.hard | drop_d | 3 | 0.682 | 0.682 | 0.731 | 0.001 | 0.001 | 0 | 0 |
| guitabcue2 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.718 | 0.002 | 0.002 | 0 | 0 |
| guitabcue2 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.814 | 0.000 | 0.000 | 0 | 0 |
| guitabcue2 | stem.hard | standard | 50 | 0.669 | 0.669 | 0.669 | 0.018 | 0.018 | 0 | 0 |
| guitabcue2 | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.693 | 0.005 | 0.005 | 0 | 0 |
| guitabcue2 | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.735 | 0.021 | 0.021 | 0 | 0 |
| guitabcue2 | detune-100 | half_step_down | 50 | 0.000 | 0.000 | 0.630 | 0.022 | 0.022 | 0 | 0 |
| guitabcue2 | detune-100 | other | 2 | 0.000 | 0.000 | 0.589 | 0.014 | 0.014 | 0 | 0 |
| guitabcue2 | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.738 | 0.005 | 0.005 | 0 | 0 |
| guitabcue2 | detune-200 | full_step_down | 50 | 0.000 | 0.000 | 0.612 | 0.027 | 0.027 | 0 | 0 |
| guitabcue2 | detune-200 | other | 4 | 0.000 | 0.000 | 0.659 | 0.003 | 0.003 | 0 | 0 |
| guitabcue4 | stem.hard | drop_d | 3 | 0.686 | 0.686 | 0.731 | 0.001 | 0.001 | 0 | 0 |
| guitabcue4 | stem.hard | full_step_down | 2 | 0.000 | 0.000 | 0.725 | 0.002 | 0.002 | 0 | 0 |
| guitabcue4 | stem.hard | half_step_down | 2 | 0.000 | 0.000 | 0.814 | 0.000 | 0.000 | 0 | 0 |
| guitabcue4 | stem.hard | standard | 50 | 0.670 | 0.670 | 0.670 | 0.018 | 0.018 | 0 | 0 |
| guitabcue4 | detune-100 | drop_c_sharp | 3 | 0.000 | 0.000 | 0.686 | 0.005 | 0.005 | 0 | 0 |
| guitabcue4 | detune-100 | full_step_down | 2 | 0.000 | 0.000 | 0.735 | 0.021 | 0.021 | 0 | 0 |
| guitabcue4 | detune-100 | half_step_down | 50 | 0.000 | 0.000 | 0.632 | 0.022 | 0.022 | 0 | 0 |
| guitabcue4 | detune-100 | other | 2 | 0.000 | 0.000 | 0.599 | 0.014 | 0.014 | 0 | 0 |
| guitabcue4 | detune-200 | drop_c | 3 | 0.000 | 0.000 | 0.737 | 0.005 | 0.005 | 0 | 0 |
| guitabcue4 | detune-200 | full_step_down | 50 | 0.000 | 0.000 | 0.607 | 0.027 | 0.027 | 0 | 0 |
| guitabcue4 | detune-200 | other | 4 | 0.000 | 0.000 | 0.658 | 0.003 | 0.003 | 0 | 0 |

## Detuned stems (hard-band stem re-pitched by tape speed; onset F1, all items)

| variant | stem.hard | detune+20 | detune-20 | detune+35 | detune-35 | detune+50 | detune-50 | detune-100 | detune-200 |
|---|---|---|---|---|---|---|---|---|---|
| guitabcue0.25 | 0.782 | 0.766 | 0.747 | 0.747 | 0.746 | 0.235 | 0.560 | 0.774 | 0.767 |
| guitabcue0.5 | 0.782 | 0.766 | 0.747 | 0.747 | 0.746 | 0.235 | 0.560 | 0.774 | 0.767 |
| guitabcue1 | 0.782 | 0.766 | 0.747 | 0.747 | 0.746 | 0.235 | 0.560 | 0.774 | 0.767 |
| guitabcue2 | 0.782 | 0.766 | 0.747 | 0.747 | 0.746 | 0.235 | 0.560 | 0.774 | 0.767 |
| guitabcue4 | 0.782 | 0.766 | 0.747 | 0.747 | 0.746 | 0.235 | 0.560 | 0.774 | 0.767 |

## Quantization (stem.hard, `easiest`, standard tuning)

Residual-flagged = share of tab events whose onset is > 60 ms from the grid (1/16, or swung 1/8); error = median |quantized onset - reference onset| over matched notes.

| variant | style | residual-flagged | quantized onset error ms |
|---|---|---|---|
| guitabcue0.25 | comping | 0.031 | 17.5 |
| guitabcue0.25 | single-line | 0.103 | 20.0 |
| guitabcue0.25 | solo_bends | 0.614 | 73.4 |
| guitabcue0.25 | two_guitars | 0.015 | 18.8 |
| guitabcue0.25 | vibrato | 0.895 | nan |
| guitabcue0.5 | comping | 0.031 | 17.5 |
| guitabcue0.5 | single-line | 0.103 | 20.0 |
| guitabcue0.5 | solo_bends | 0.614 | 73.4 |
| guitabcue0.5 | two_guitars | 0.015 | 18.8 |
| guitabcue0.5 | vibrato | 0.895 | nan |
| guitabcue1 | comping | 0.031 | 17.5 |
| guitabcue1 | single-line | 0.103 | 20.0 |
| guitabcue1 | solo_bends | 0.614 | 73.4 |
| guitabcue1 | two_guitars | 0.015 | 18.8 |
| guitabcue1 | vibrato | 0.895 | nan |
| guitabcue2 | comping | 0.031 | 17.5 |
| guitabcue2 | single-line | 0.103 | 20.0 |
| guitabcue2 | solo_bends | 0.614 | 73.4 |
| guitabcue2 | two_guitars | 0.015 | 18.8 |
| guitabcue2 | vibrato | 0.895 | nan |
| guitabcue4 | comping | 0.031 | 17.5 |
| guitabcue4 | single-line | 0.103 | 20.0 |
| guitabcue4 | solo_bends | 0.614 | 73.4 |
| guitabcue4 | two_guitars | 0.015 | 18.8 |
| guitabcue4 | vibrato | 0.895 | nan |

## Bends (stem.hard, ≥ 50 cents, matched notes)

| variant | reference bends | detected | hits | precision | recall |
|---|---|---|---|---|---|
| guitabcue0.25 | 48 | 0 | 0 | - | 0.000 |
| guitabcue0.5 | 48 | 0 | 0 | - | 0.000 |
| guitabcue1 | 48 | 0 | 0 | - | 0.000 |
| guitabcue2 | 48 | 0 | 0 | - | 0.000 |
| guitabcue4 | 48 | 0 | 0 | - | 0.000 |

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

## Time per 30 s of audio (this machine, median)

- `guitabcue0.25` separation (bs_roformer_sw): 4.6 s
- `guitabcue0.5` separation (bs_roformer_sw): 4.6 s
- `guitabcue1` separation (bs_roformer_sw): 4.6 s
- `guitabcue2` separation (bs_roformer_sw): 4.6 s
- `guitabcue4` separation (bs_roformer_sw): 4.6 s

Per-item rows: `2026-10-28-cueweight.csv`. Command: `eval/p2g.py report --variant guitabcue0.25 guitabcue0.5 guitabcue1 guitabcue2 guitabcue4 --name cueweight`
