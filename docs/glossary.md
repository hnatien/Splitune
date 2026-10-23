---
title: Glossary
workstream: product
last_researched: 2026-10-20
confidence: high
---

# Glossary

Terms a builder will meet across the Splitune research docs: music and notation, MIR and audio ML, evaluation, licensing and legal, and product/UX/learning science. Definitions are short and point to the doc that owns the detail and its citations. Numbers quoted here are taken from those docs, not from fresh sources, so check the owning doc before relying on one.

## How to use
Search for the term (entries are alphabetical within each section), then follow the `path` for evidence and sources; all paths are relative to `docs/`.
Where a term is a vendor or model name, the entry gives its role and licence tag only; the comparison tables live in the linked doc.

## Music and notation

**A–B loop** — Repeating a learner-chosen section between two markers; the core practice-tool primitive, with a non-drag alternative required for accessibility; see `ux/practice-tool-patterns.md`.

**Capo** — Clamp that raises open-string pitch on a guitar; in software, "capo mode" suggests a transposed, easier chord shape set; see `ml/transcription-guitar-and-bass-tabs.md`, `ux/practice-tool-patterns.md`.

**Chord symbol** — Text label for a harmony (e.g. Am7); chord output is judged by root, major/minor, sevenths and inversion vocabularies; see `ml/chords-beats-key-structure.md`.

**Count-in** — Clicks or bars played before a loop or take starts, ideally at the upcoming tempo; see `ux/practice-tool-patterns.md`.

**Downbeat** — The first beat of a bar; needed to place bar lines and align notation to audio; see `ml/chords-beats-key-structure.md`.

**Drum staff / drum grid** — Notation or grid view with one line or row per kit piece; internal drum notes are mapped to General MIDI percussion numbers; see `ml/transcription-drums.md`, `ux/music-display-ui.md`.

**f0 (fundamental frequency) / pitch contour** — The continuous pitch curve of a voice or melody; for singers it is shown instead of (or beside) note blocks because vibrato and glides are lost in notes; see `ml/transcription-vocals-melody.md`.

**Fingering** — Which finger plays a note (piano) or which string/fret position (guitar); video is the only input that can add this information; see `ml/video-and-audio-visual-analysis.md`.

**Formant preservation** — Keeping the vocal timbre character when pitch-shifting, avoiding a "chipmunk" sound; see `ml/playback-time-stretch-pitch-shift.md`.

**Ghost note** — A very quiet drum hit; velocity-aware drum transcription is needed to show it and is treated as v2; see `ml/transcription-drums.md`.

**Guitar Pro formats (.gp3 to .gp8, .gpx, .gp)** — Proprietary tab-and-notation file formats of Guitar Pro; alphaTab reads versions 3 to 8; see `ux/music-display-ui.md`, `market/competitors/guitar-pro.md`.

**Key detection** — Estimating a song's key from audio; no permissive detector with a published benchmark was found, so a chord-histogram estimate is the fallback; see `ml/chords-beats-key-structure.md`.

**Key (musical)** — The tonal centre and scale of a piece; used for transposition and chord-name spelling; see `ml/chords-beats-key-structure.md`.

**MEI (Music Encoding Initiative)** — XML encoding of music notation that Verovio engraves to SVG; see `ux/music-display-ui.md`.

**MIDI** — Event format (note on/off, pitch, velocity, time) used as the lingua franca for transcribed notes; it is a performance record, not readable notation; see `ml/transcription-general.md`.

**MusicXML** — Interchange format for notation scores (.xml, .musicxml, .mxl), readable by alphaTab, OSMD and Verovio; see `ux/music-display-ui.md`, `ml/transcription-general.md`.

**Note event** — Splitune's proposed internal record: MIDI-like pitch/onset/offset plus string, fret, finger, confidence, stem id and model version; see `ux/music-display-ui.md`.

**Octave error** — A transcription or pitch-tracking mistake by a factor of 2 in frequency; a main bass pitfall, aggravated by trackers whose range floor sits above the open low E (41.2 Hz); see `ml/transcription-guitar-and-bass-tabs.md`.

**Onset / offset / frame** — Onset is when a note starts, offset when it ends, a frame is one short analysis slice of audio; piano-style models predict per-pitch onset, frame and offset posteriors; see `ml/transcription-general.md`.

**Piano roll** — Time-by-pitch grid of note bars; also the "falling notes" view for piano learners; see `ux/music-display-ui.md`.

**Quantization (rhythm)** — Snapping performed note times to a metrical grid so notation is readable; a separate stage after beat tracking, not part of note detection; see `ml/transcription-general.md`.

**Sustain pedal** — Piano pedal that extends notes; transcription offsets are scored much higher when extended by pedal than for key release (about 85–93% vs 37–82%); see `ml/transcription-piano.md`.

**Tablature (tab)** — Notation showing string and fret instead of pitch; the dominant guitar/bass convention (a practice convention, not shown to be better by controlled study); see `ux/music-display-ui.md`.

**Time signature / meter** — Beats per bar and beat unit; inferred alongside key during MIDI-to-score conversion; see `ml/transcription-general.md`.

**Transposition** — Shifting a song's key for a capo, easier chords or vocal range; implemented with pitch-shifting; see `ml/playback-time-stretch-pitch-shift.md`, `ml/transcription-vocals-melody.md`.

**Tuning** — Open-string pitches of an instrument; detecting alternate tuning and capo is research-grade and fret assigners can condition on it; see `ml/transcription-guitar-and-bass-tabs.md`.

**Voice (notation) / voice separation** — Splitting simultaneous lines into staves, hands and voices for readable scores; research code only; see `ml/transcription-piano.md`.

## MIR and audio ML

**All-In-One (`allin1`)** — MIT-code model returning beats, downbeats, tempo and labelled sections in one pass; it runs Demucs internally and is trained only on Harmonix; see `ml/chords-beats-key-structure.md`.

**AMT (automatic music transcription)** — Converting audio to symbolic notes; the family of piano, guitar, drum, vocal and multi-instrument tasks; see `ml/transcription-general.md`.

**Artifacts (separation)** — Audible distortions (musical noise, smearing) a separator adds to a stem; particularly bad for the 6-stem piano source; see `ml/source-separation.md`.

**AudioShake** — Commercial separation vendor; won MDX'21 leaderboard B (8.33 dB) and is embedded on-device in djay Neural Mix; see `ml/source-separation-model-comparison.md`, `ml/deployment-and-inference.md`.

**AudioWorklet** — Web Audio API thread for custom real-time DSP such as the stretch engine; see `ml/playback-time-stretch-pitch-shift.md`.

**Basic Pitch** — Spotify's Apache-2.0, roughly 17k-parameter note transcriber with pitch bends, shipped as Python and an npm package; the MVP default for guitar stems; see `ml/transcription-general.md`.

**Beat / downbeat tracking** — Estimating beat and bar-start times from audio; basis for tempo maps, quantization and loops; see `ml/chords-beats-key-structure.md`.

**Beat This!** — Beat/downbeat tracker with MIT code and weights, no DBN postprocessing; the recommended beat tracker; see `ml/chords-beats-key-structure.md`.

**Bleed** — Energy from other instruments leaking into a separated stem (or into a recording); causes phantom instruments and hurts transcription; see `ml/source-separation.md`, `ml/instrument-recognition.md`.

**BS-RoFormer** — Band-split RoPE transformer separator from ByteDance SAMI; SDX'23 winner (9.97 dB global SDR); code is permissive, strong weights are not; see `ml/source-separation.md`.

**Chord recognition (ACE)** — Automatic chord estimation; roughly 77–84% weighted recall for major/minor and barely improved since 2016, so treat as an editable draft; see `ml/chords-beats-key-structure.md`.

**CoreML** — Apple's on-device ML runtime; used by djay Neural Mix and available for Basic Pitch; see `ml/deployment-and-inference.md`.

**CREPE** — MIT-code pitch tracker (about 22M parameters), robust but slow; see `ml/transcription-vocals-melody.md`.

**Demucs / HT-Demucs** — Meta's open separators (hybrid transducer-transformer v4); best-documented open model, about 1 dB behind SOTA, repo archived 1 Jan 2025; see `ml/source-separation.md`, `ml/deployment-and-inference.md`.

**`htdemucs_6s`** — Open 6-stem Demucs variant; 3.07 dB guitar and 1.60 dB piano on MoisesDB; see `ml/source-separation.md`.

**Instrument recognition / tagging** — Classifying which instruments are present, at clip or frame level; mature at clip level, unsolved at frame level for pop; see `ml/instrument-recognition.md`.

**LiteRT (ex-TensorFlow Lite) / TFLite** — Google's on-device inference runtime for Android, iOS and web; see `ml/deployment-and-inference.md`.

**madmom** — JKU beat/chord/onset library; code is usable but its model files are CC-BY-NC-SA-4.0; see `ml/chords-beats-key-structure.md`.

**MDX-Net / MDX23C** — Separation architectures from the Music Demixing Challenge line (MDX23C is KUIELab's TFC-TDF U-Net v3); bundled in Ultimate Vocal Remover; see `ml/source-separation.md`.

**Mel-Band RoFormer** — Variant of BS-RoFormer with mel-scale band splitting; community checkpoints lead on vocals; see `ml/source-separation-model-comparison.md`.

**MERT** — Self-supervised music audio encoder; weights are CC-BY-NC-4.0, so avoid commercially; see `ml/instrument-recognition.md`.

**MT3 / YourMT3+** — Multi-instrument token-based transcribers (Google; YourMT3+ is the extension); strong on benchmarks, weak on real pop and on guitar zero-shot (32% on GuitarSet); see `ml/transcription-general.md`.

**Multi-instrument vs specialist transcription** — Plan is specialist models on separated stems, with a multi-instrument model as second opinion; see `ml/transcription-general.md`.

**NNLS Chroma / Chordino** — GPL Vamp-plugin chord estimator; copyleft constraint; see `ml/chords-beats-key-structure.md`.

**On-device inference** — Running models on the learner's phone or browser; proven commercially only with custom-optimised models; speed, not model size, is the blocker; see `ml/deployment-and-inference.md`.

**ONNX Runtime** — Cross-platform inference engine (server, mobile, browser via WASM/WebGPU); see `ml/deployment-and-inference.md`.

**Onsets and Frames** — Magenta's piano transcription CNN-RNN; 95.2% Fno on MAESTRO; see `ml/transcription-general.md`, `ml/transcription-piano.md`.

**Open-Unmix** — Reference open separator; `umxl` weights are CC-BY-NC-SA-4.0; see `ml/source-separation-model-comparison.md`.

**PANNs** — AudioSet-trained audio taggers (MIT code, CC-BY-4.0 weights, frame-level variants); see `ml/instrument-recognition.md`.

**PESTO** — LGPL-3.0 streaming pitch tracker with under 10 ms latency, suited to live mic feedback; see `ml/transcription-vocals-melody.md`.

**Phase vocoder (PV)** — Frequency-domain time stretching that handles harmonic content well but smears transients ("phasiness"); see `ml/playback-time-stretch-pitch-shift.md`.

**Pitch-shifting** — Changing pitch without changing speed; implemented as resampling plus inverse time-stretch; see `ml/playback-time-stretch-pitch-shift.md`.

**PM2S** — MIT-code CRNN that predicts beats, quantized onsets, time/key signature and hand part from performance MIDI; see `ml/transcription-general.md`.

**RMVPE** — Apache-2.0 vocal pitch tracker that works on the full mix (MIR-1K RPA 95.42); see `ml/transcription-vocals-melody.md`.

**ROSVOT** — MIT-code singing-voice note transcriber for accompanied/noisy audio; see `ml/transcription-vocals-melody.md`.

**RTF (real-time factor)** — Processing time divided by audio duration; 0.037 measured for separation plus analysis on an RTX 4090, 0.1 assumed on an L4; see `ml/deployment-and-inference.md`.

**Rubber Band** — Time-stretch/pitch library; R3 "Finer" engine is best quality, GPL-2.0-or-later with paid commercial licences; see `ml/playback-time-stretch-pitch-shift.md`.

**SCNet** — Lighter sparse-compression separator family; SCNet XL is the best 4-stem model trained on MUSDB only; see `ml/source-separation-model-comparison.md`.

**Signalsmith Stretch** — MIT polyphonic time-stretch/pitch library with an official WASM/AudioWorklet build; the default engine, best around 0.75x–1.5x so test at 0.5x; see `ml/playback-time-stretch-pitch-shift.md`.

**Source separation** — Splitting a mix into component sources (vocals, drums, bass, other, optionally guitar/piano); see `ml/source-separation.md`.

**Spleeter** — Deezer's MIT-code and MIT-weights separator, about 3 dB behind SOTA (about 6.5 dB 4-stem average, 2019); see `ml/source-separation-model-comparison.md`.

**Stem** — One separated component of a mix (e.g. isolated bass); legally a recapture of the sound recording; see `ml/source-separation.md`, `legal/youtube-copyright-and-platform-policy.md`.

**String/fret assignment** — Mapping note pitches to playable string and fret positions; transformer assigners beat Guitar Pro heuristics (73.6% vs 62.3% match); see `ml/transcription-guitar-and-bass-tabs.md`.

**Structure segmentation** — Labelling song sections (intro, verse, chorus) for loop suggestions; see `ml/chords-beats-key-structure.md`.

**SwiftF0** — MIT-code, tiny, ONNX pitch tracker; floor of 46.9 Hz misses open low E; see `ml/transcription-vocals-melody.md`, `ml/transcription-guitar-and-bass-tabs.md`.

**TabCNN** — CNN guitar tablature estimator; out-of-domain string disambiguation falls from 0.899 to 0.695 TDR; see `ml/transcription-guitar-and-bass-tabs.md`.

**Time-stretching** — Changing speed without changing pitch; the slow-down primitive of every practice tool; see `ml/playback-time-stretch-pitch-shift.md`.

**Transkun** — MIT-code piano transcriber (onset F1 98.3 on MAESTRO v3 for V2); weights licence unstated and data is non-commercial; see `ml/transcription-piano.md`.

**WASM / WebGPU** — WebAssembly (full-coverage browser inference) and the experimental GPU path in ONNX Runtime Web; see `ml/deployment-and-inference.md`.

**Whisper / WhisperX** — Whisper (MIT code and weights) transcribes lyrics from a separated vocal stem; WhisperX (BSD-2-Clause) does forced alignment for word timing; singing accuracy of alignment unverified; see `ml/transcription-vocals-melody.md`.

**WSOLA (waveform-similarity overlap-add)** — Cheap time-domain stretching used by Chromium's `preservesPitch`; fine for speech, doubtful for dense music at 0.5x; see `ml/playback-time-stretch-pitch-shift.md`.

## Evaluation metrics and datasets

**Beat F-measure** — Beat tracking score at ±70 ms; Beat This! GTZAN beat F1 89.1, downbeat 78.3; see `ml/chords-beats-key-structure.md`.

**COn / COnP / COnPOff** — Singing metrics: correct onset, plus pitch, plus offset; ROSVOT 77.0 noisy in-domain, 47.4 on MIR-ST500; see `ml/transcription-vocals-melody.md`.

**cSDR** — Chunk-level SDR from `museval`: median of 1-s chunks, then median over tracks; used in MUSDB18 papers; see `ml/datasets-metrics-and-licensing.md`.

**Domain shift (benchmark vs YouTube)** — Accuracy loss from clean benchmark audio to lossy, loud, live or phone-recorded input; see `ml/transcription-piano.md`, `ml/source-separation.md`.

**E-GMD / Groove MIDI** — Drum datasets with velocity (CC-BY-4.0); E-GMD-only models generalise poorly to real mixes; see `ml/transcription-drums.md`.

**GuitarSet** — Annotated solo guitar dataset (supervised SOTA about 91% onset F1); CC-BY-4.0 on Zenodo, but the datasets doc flags a conflicting mirdata listing; see `ml/transcription-guitar-and-bass-tabs.md`, `ml/datasets-metrics-and-licensing.md`.

**Harmonix Set** — 912 Western pop songs with beat/downbeat/section annotations; sole training data for All-In-One; see `ml/chords-beats-key-structure.md`.

**HR.5F** — Boundary hit-rate F-measure at 0.5 s for segmentation (All-In-One .660 on Harmonix); see `ml/chords-beats-key-structure.md`.

**Listening test** — Human preference evaluation; SDX'23 showed it can contradict SDR ranking, so Splitune needs its own on YouTube-style audio; see `ml/source-separation.md`.

**MAESTRO** — Disklavier piano transcription dataset, CC-BY-NC-SA-4.0; saturated benchmark that overstates real-world accuracy; see `ml/transcription-piano.md`.

**mAP (mean average precision)** — Ranking metric for tagging; used for OpenMIC and AudioSet; see `ml/instrument-recognition.md`.

**mir_eval** — Reference MIR evaluation library; defaults: note onset ±50 ms, pitch ±50 cents, offset tolerance max(20% of note, 50 ms), velocity 0.1 after rescaling, beat F-measure ±70 ms ignoring first 5 s; see `ml/datasets-metrics-and-licensing.md`.

**MoisesDB** — Multitrack separation dataset with guitar and piano stems; non-commercial; see `ml/source-separation.md`, `ml/datasets-metrics-and-licensing.md`.

**MUSDB18-HQ** — Standard 4-stem separation benchmark and training set; non-commercial; see `ml/datasets-metrics-and-licensing.md`.

**MVSep Multisong** — Community benchmark used for open checkpoints (e.g. vocals 10.9–12.3 dB); private and unaudited; see `ml/source-separation-model-comparison.md`.

**Note F-measure (onset / onset+offset / velocity)** — F1 over notes matched by the `mir_eval` tolerances; onset-only is highest, adding offsets drops piano SOTA to about 82–94%; see `ml/datasets-metrics-and-licensing.md`, `ml/transcription-general.md`.

**OpenMIC-2018** — 20-class instrument-presence dataset of 10-s clips, CC-BY-4.0; best supervised models about 0.84–0.855 mAP; see `ml/instrument-recognition.md`.

**RPA (raw pitch accuracy)** — Share of voiced frames within 50 cents; at least 95% for CREPE/RMVPE on clean vocals; see `ml/transcription-vocals-melody.md`.

**SALAMI** — Structure-annotation dataset; annotations CC0-1.0 but audio is not included; see `ml/chords-beats-key-structure.md`, `ml/datasets-metrics-and-licensing.md`.

**SDR (signal-to-distortion ratio)** — Energy ratio of target to distortion in dB for separation; differences under about 0.3 dB are noise and it correlates poorly with listener preference; see `ml/datasets-metrics-and-licensing.md`, `ml/source-separation.md`.

**SI-SDR** — Scale-invariant SDR; 0.1 dB differences are not meaningful; see `ml/datasets-metrics-and-licensing.md`.

**Slakh2100** — Synthesised multitrack dataset, CC-BY-4.0, commercially friendly but synthetic; see `ml/datasets-metrics-and-licensing.md`.

**Sound Demixing Challenge (MDX'21, SDX'23)** — Challenge series for separation; MDX'21 leaderboard A won by Hybrid Demucs (7.33 dB), B by AudioShake (8.33 dB); SDX'23 by SAMI-ByteDance (9.97 dB); no 2024–25 edition found; see `ml/source-separation.md`.

**uSDR (global SDR)** — Whole-signal SDR averaged per song; used by MDX'21 and SDX'23, so not comparable with cSDR; see `ml/datasets-metrics-and-licensing.md`.

**WCSR (weighted chord symbol recall) / chord symbol recall** — Duration-weighted fraction of time the predicted chord matches, under a named vocabulary (root, majmin, sevenths); see `ml/datasets-metrics-and-licensing.md`, `ml/chords-beats-key-structure.md`.

## Licensing and legal

**§ 512 safe harbor** — DMCA shield for hosts that designate an agent, take down on notice and terminate repeat infringers; see `legal/youtube-copyright-and-platform-policy.md`.

**Apache-2.0 / MIT / BSD** — Permissive code licences; the usual tags on model code (Basic Pitch, Beat This!, Whisper); see `ml/datasets-metrics-and-licensing.md`.

**CC-BY-4.0** — Attribution-only Creative Commons licence; commercially friendly datasets such as OpenMIC-2018, GuitarSet, Slakh, E-GMD; see `ml/datasets-metrics-and-licensing.md`.

**CC-BY-NC(-SA/-ND)** — Non-commercial Creative Commons variants (MUSDB18, MAESTRO, madmom models, ADTOF); the default rule is not to ship weights trained on NC data without clearance; see `ml/datasets-metrics-and-licensing.md`.

**Content ID** — YouTube's rights-matching system; not researched in these docs, so no claims are made here; see `legal/youtube-copyright-and-platform-policy.md` for the platform-policy context.

**Copyleft (GPL / AGPL / LGPL / MPL)** — Licences with sharing obligations: GPL (Rubber Band, Chordino), AGPL (Essentia), LGPL (Verovio, PESTO, SoundTouch; awkward for static linking on iOS), MPL-2.0 (alphaTab, file-level copyleft); see `ml/playback-time-stretch-pitch-shift.md`, `ux/music-display-ui.md`.

**Derivative work** — A work based on another; Moises and Spotify terms treat extracting stems or modifying content as unauthorised derivative creation; see `legal/youtube-copyright-and-platform-policy.md`.

**DMCA agent / takedown policy** — Registered agent with the U.S. Copyright Office ($6, three-year expiry) plus a takedown and repeat-infringer policy, required for safe harbor if users upload content; see `legal/youtube-copyright-and-platform-policy.md`.

**Fair use** — U.S. defence (17 U.S.C. § 107) that private, personal use leans on; case law on AI training is unsettled (e.g. the 2025 Bartz v. Anthropic order); see `legal/youtube-copyright-and-platform-policy.md`.

**Licence conflicts across sources** — Several projects state inconsistent licences (YourMT3 GPL-3.0 vs Apache-2.0, Basic Pitch stray GPL mention, Essentia NC-SA vs NC-ND); treat as unresolved until counsel confirms; see `ml/transcription-general.md`, `ml/instrument-recognition.md`.

**Licence layers: code vs weights vs training data** — Each must be recorded separately; an MIT repo says nothing about checkpoints or data rights; see `ml/datasets-metrics-and-licensing.md`.

**Sound recording vs musical work (two copyrights)** — Label/performer rights in the recording versus publisher/songwriter rights in the composition; stems implicate the first (§ 114(b)), tabs the second; see `legal/youtube-copyright-and-platform-policy.md`.

**SPDX identifier** — Standard licence short name (MIT, Apache-2.0, GPL-3.0, CC-BY-NC-4.0) used to record licences exactly; see `ml/datasets-metrics-and-licensing.md`.

**Stream ripping / § 1201 anti-circumvention** — Bypassing YouTube's access controls to download media risks 17 U.S.C. § 1201 claims (Yout v. RIAA pending; FLVTO about $83M default judgment); see `legal/youtube-copyright-and-platform-policy.md`.

**TDM exception (EU)** — Directive (EU) 2019/790 Art. 4 text-and-data-mining allowance, void where rightholders reserve rights by machine-readable means; relevant to training data; see `legal/youtube-copyright-and-platform-policy.md`, `ml/datasets-metrics-and-licensing.md`.

**YouTube API Services Terms / Developer Policies** — Prohibit caching or storing audiovisual content and separating or isolating audio (§III.E.1, §III.I.7); see `legal/youtube-copyright-and-platform-policy.md`.

**YouTube IFrame Player API** — Embedded player with `setPlaybackRate`, `seekTo` and looping; no overlays, no muting for alternate audio, no charging to watch in the embed (§III.F.3.a); see `legal/youtube-copyright-and-platform-policy.md`.

## Product, UX and learning science

**Aha moment** — Hearing your part isolated from a chosen song then playing along slowed; internal targets: isolated part within 60 s, first loop within 5 min (recommendations, not benchmarks); see `ux/onboarding-retention-motivation.md`.

**alphaTab** — MPL-2.0 JavaScript library reading Guitar Pro 3–8, MusicXML and alphaTex; renders tab, drums and notation with a cursor and playback; the leading renderer candidate; see `ux/music-display-ui.md`.

**alphaTex** — alphaTab's text notation format; a candidate generation and export target; see `ux/music-display-ui.md`.

**Auto-pause / play once then wait** — Patterns that stop playback for feedback so the learner need not reach for the screen; see `ux/hands-busy-and-device-context.md`.

**Chunking** — Learning small segments as single units; underlies loop-the-hard-bit; see `ux/learning-science-principles.md`.

**Cognitive load / split attention** — Working-memory cost of divided or redundant displays; keep one primary representation at a time; see `ux/learning-science-principles.md`, `ux/music-display-ui.md`.

**Confidence indicator / tap-to-fix / report wrong note** — UI answer to imperfect transcription: show certainty, allow edits and one-tap overrides; see `ux/music-display-ui.md`, `users/user-journeys-and-flows.md`.

**Deliberate practice** — Targeted, error-focused repetition; explains about 21% of musical skill variance in a 2014 meta-analysis; see `ux/learning-science-principles.md`.

**Differentiation gap** — No surveyed product takes a learner-chosen performance, isolates the instrument, gives level-matched notes and wraps practice tools; see `market/competitor-landscape.md`.

**Feature matrix** — Comparison of 22 products over 16 capabilities, cells marked unverified rather than guessed; see `market/feature-matrix.md`.

**Foot pedal / page turner** — Bluetooth devices (AirTurn, PageFlip) that act as keyboards; bind Up/Down/Left/Right/PageUp/PageDown/Space/Enter and allow remapping since mode-to-key mappings conflict by model; see `ux/hands-busy-and-device-context.md`.

**Gamification** — Game elements such as points and badges; evidence is positive but context-dependent with novelty effects; see `ux/learning-science-principles.md`.

**Hands-busy context** — Learner is holding an instrument while using the app, so controls need pedal, keyboard or very large targets; see `ux/hands-busy-and-device-context.md`.

**Interleaving** — Alternating pieces or skills in practice; evidence for music is weak (N=10, mostly non-significant); see `ux/learning-science-principles.md`.

**JTBD (jobs to be done)** — Framing product work by the outcome users hire it for; the core job is going from "I want to play that song" to "I can play my part"; see `users/jobs-to-be-done.md`.

**Knowledge of results (KR) vs knowledge of performance (KP)** — KR says right or wrong (a score); KP says how it differed (late, flat, muted); diagnostic KP is the high-value feedback; see `ux/learning-science-principles.md`.

**Latency budget** — About 10 ms round trip is what musicians generally need and 20 ms is Android's "pro audio" maximum; see `ux/practice-tool-patterns.md`.

**Listen-and-score (mic feedback)** — Real-time judgement of the learner's playing from a microphone; highest-risk feature, no published accuracy for phone-mic polyphonic playing, needs calibration and override; see `ux/practice-tool-patterns.md`.

**MVP (minimum viable product)** — The first shippable scope; for ML, per-instrument models on separated stems with draft output and editing; see `ml/transcription-drums.md`, `ml/transcription-guitar-and-bass-tabs.md`.

**Okabe-Ito palette** — Eight colour-blind-safe colours for strings, fingers, stems and voices, always paired with a second cue; see `ux/accessibility.md`.

**OSMD (OpenSheetMusicDisplay)** — BSD-3-Clause MusicXML renderer; see `ux/music-display-ui.md`.

**Persona** — Evidence-grounded user archetype (six defined, drummer medium-low and singer low confidence); see `users/personas.md`.

**Progressive results** — Return beats, chords and sections (seconds) before stems (tens of seconds) while processing; see `ml/deployment-and-inference.md`, `users/user-journeys-and-flows.md`.

**Self-determination theory (SDT)** — Motivation theory: autonomy, competence, relatedness; supports learner-chosen songs and informational feedback; see `ux/learning-science-principles.md`.

**Spaced practice** — Distributing practice over sessions; mean effect 0.46 over massed in a 63-study meta-analysis; see `ux/learning-science-principles.md`.

**Speed trainer** — Practice tool that raises tempo in steps over loop repeats; step sizes are defaults to A/B test; see `ux/practice-tool-patterns.md`.

**Streak** — Consecutive-days counter; prefer forgiving streaks or weekly goals since one missed day has little effect on habit formation; see `ux/onboarding-retention-motivation.md`.

**Target size** — Minimum control size: WCAG 2.2 AA 24x24 CSS px, AAA 44x44; Apple 44x44 pt; Google 48x48 dp with about 8 dp spacing; see `ux/accessibility.md`, `ux/hands-busy-and-device-context.md`.

**Tempo reached at clean-pass criterion** — Proposed skill metric for difficulty adaptation instead of minutes practised; see `ux/onboarding-retention-motivation.md`.

**Trust in output** — Most evidenced unmet need: accurate tabs/chords and clean stems matter more than missing features; see `users/jobs-to-be-done.md`, `users/voice-of-customer-pain-points.md`.

**Usage-metered pricing** — Free tiers capped by usage (minutes, tickets, tabs) because server inference is the cost; per-song cost should stay well below about $0.20 (inference); see `market/pricing-and-business-models.md`.

**Verovio** — LGPL notation engraver from MEI and MusicXML to SVG; see `ux/music-display-ui.md`.

**VexFlow** — MIT low-level notation rendering library; see `ux/music-display-ui.md`.

**WCAG 2.2** — Web accessibility standard; Level AA is the baseline, notable criteria 2.5.8 (target size), 2.5.7 (dragging alternatives), 1.4.1, 1.4.3 and 1.4.11 (contrast 4.5:1 text, 3:1 UI), 2.2.2 (auto-scroll); see `ux/accessibility.md`.

## Sources

No new URLs were opened for this glossary. Definitions are drawn from these docs (paths relative to `docs/`):

- `ml/chords-beats-key-structure.md`
- `ml/datasets-metrics-and-licensing.md`
- `ml/deployment-and-inference.md`
- `ml/instrument-recognition.md`
- `ml/playback-time-stretch-pitch-shift.md`
- `ml/source-separation-model-comparison.md`
- `ml/source-separation.md`
- `ml/transcription-drums.md`
- `ml/transcription-general.md`
- `ml/transcription-guitar-and-bass-tabs.md`
- `ml/transcription-piano.md`
- `ml/transcription-vocals-melody.md`
- `ml/video-and-audio-visual-analysis.md`
- `legal/youtube-copyright-and-platform-policy.md`
- `market/competitor-landscape.md`
- `market/feature-matrix.md`
- `market/pricing-and-business-models.md`
- `market/competitors/guitar-pro.md`
- `users/jobs-to-be-done.md`
- `users/personas.md`
- `users/user-journeys-and-flows.md`
- `users/voice-of-customer-pain-points.md`
- `ux/accessibility.md`
- `ux/hands-busy-and-device-context.md`
- `ux/learning-science-principles.md`
- `ux/music-display-ui.md`
- `ux/onboarding-retention-motivation.md`
- `ux/practice-tool-patterns.md`
