---
title: Accessibility for a music-learning app
workstream: ux
last_researched: 2026-10-20
confidence: medium
---

# Accessibility for a music-learning app

## TL;DR
- Target **WCAG 2.2 Level AA** as the baseline. The criteria that bite hardest here: 2.5.8 target size (24 x 24 CSS px), 2.5.7 dragging alternatives (loop handles, seek bars), 1.4.1 colour not the only cue (note highlighting, confidence shading), 1.4.3 and 1.4.11 contrast (4.5:1 text, 3:1 UI and graphics), 2.2.2 pause/stop/hide for moving content over 5 s (auto-scrolling notation), 1.4.4 text resize to 200%, and 1.2.2 captions for prerecorded video.
- Use a colour-blind-safe palette (Okabe-Ito, eight colours) for strings, fingers, stems, and voices, and always add a second cue (shape, label, line style).
- Music notation is a graphic: provide a **text alternative** (bar-by-bar description) and keep a semantic source (MusicXML/alphaTex/MIDI-like events) available; true screen-reader support for music is an open design area.
- Left-handed players need mirrored fretboard and chord diagrams (convention-based; verify with users). Deaf and hard-of-hearing learners need visual/haptic metronomes and visual onset feedback.
- Provide a reduced-motion mode (page-flip instead of scroll, no flashing, no parallax), respecting `prefers-reduced-motion`.

## Findings

### WCAG 2.2 criteria relevant to Splitune

| SC | Level | Requirement (paraphrased from W3C Understanding pages) | Splitune application |
|---|---|---|---|
| [1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) | A | Non-text content needs an equivalent text alternative; charts and diagrams pair a short alternative with a long description (summary, trends, ideally the data in a table) | Notation/tab/fretboard images need a short label plus a long description or table of the bar/notes |
| [1.2.2 Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) | A | Captions for prerecorded audio in synchronised media | Splitune's own tutorial videos; embedded user-supplied videos depend on the source (see below) |
| [1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) | A | Colour is not the only visual means of conveying information, indicating an action, or distinguishing an element | Correct/incorrect notes, confidence shading, finger colours, stems |
| [1.4.2 Audio Control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html) | A | If audio plays automatically for more than 3 seconds, there must be a way to pause/stop or control volume separate from system volume | Autoplay of previews or demo song on first open; learner-started playback is user-initiated but keep a prominent pause |
| [1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) | AA | 4.5:1 for normal text, 3:1 for large text (18 pt or 14 pt bold) | Lyrics, chord names, tab numerals, labels; dark and light themes |
| [1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) | AA | Text scalable to 200% without loss of content or function | Practice-mode layout must reflow at 200% |
| [1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) | AA | 3:1 for UI component states and for parts of graphics needed to understand content | Notehead outlines, loop markers, now-line, fretboard dots, focus rings |
| [2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) | A | All functionality operable via keyboard (except path-dependent input) | Loop, tempo, mixer all keyboard-operable; pedals are keyboards (`ux/hands-busy-and-device-context.md`) |
| [2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) | A | Moving, blinking, or scrolling content that starts automatically, lasts over 5 s, and runs alongside other content needs pause/stop/hide; essential motion exempt | Auto-scrolling notation and falling notes: playback pause is the control, but also offer a static "bar view". Whether synchronised scrolling is "essential" is debatable; provide the control anyway |
| [2.3.1 Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) | A | No more than three flashes in any one-second period unless below thresholds | Visual metronome: flash at 180 BPM is 3 per second; use a soft pulse/fill rather than full-screen flashes and cap flash rate |
| [2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) | AAA | Motion animation triggered by interaction can be disabled unless essential | Page-turn animations, confetti/celebration, parallax |
| [2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) | AA | A focused component must not be entirely hidden by author-created content | Sticky transport bars and mixer drawers must not cover focused controls |
| [2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) | A | Multipoint or path-based gestures need a single-pointer alternative | Pinch-zoom on notation: add +/- buttons; swipe to seek: add buttons |
| [2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) | AA | Anything done by dragging can be done with a single pointer without dragging | Loop A/B handles, tempo sliders, timeline scrubbing: add tap-to-set and numeric entry |
| [2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) | AA | Pointer targets at least 24 x 24 CSS px (with spacing/equivalent/inline/user-agent/essential exceptions) | All controls; bar cells in dense notation need spacing or a larger touch hit area |
| [2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) | AAA | 44 x 44 CSS px | Target for practice-mode controls (see `ux/hands-busy-and-device-context.md`) |

### Colour-blind-safe palettes
- **Okabe-Ito.** Designed by Masataka Okabe and Kei Ito to be unambiguous for colour-blind and non-colour-blind viewers, with vivid colours easy to name and printing similarly on paper and screen ([Okabe & Ito, Color Universal Design](https://jfly.uni-koeln.de/color/)). Their page describes the palette in prose (for example vermilion in place of red, bluish green in place of green, reddish purple in place of violet) and does not list all RGB values. Hex values from a lab reference page that links to Okabe and Ito: black `#000000`, orange `#E69F00`, sky blue `#56B4E9`, bluish green `#009E73`, yellow `#F0E442`, blue `#0072B2`, vermilion `#D55E00`, reddish purple `#CC79A7` ([Siegal Lab colour palette](https://siegal.bio.nyu.edu/color-palette/)). The names there are descriptive labels the page does not give itself.
- **Contrast is separate.** The Okabe-Ito set guarantees distinguishability by hue/lightness for common deficiencies, but yellow `#F0E442` on white fails the 3:1 non-text contrast threshold (WCAG requires measured contrast; calculate before use). Use dark outlines or put the palette on neutral dark backgrounds, and check every pair with a contrast tool.
- **Android's own guidance** says to use cues other than colour such as shape, size, text, patterns, or haptic/audio feedback ([Android accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles)).
- **Notation-specific guidance (recommendations):**
  - Strings: colour plus string number on the first note and a different dash pattern for the two lowest strings.
  - Fingers: colour plus finger number badges.
  - Correct/incorrect: tick/cross icon and label, not only green/red.
  - Confidence: solid versus dashed outlines and an "uncertain" icon (shared rule with `ux/music-display-ui.md`).
  - Stems in the mixer: coloured plus icon plus text label.
  - ColorBrewer is an alternative source for sequential/diverging scales (for progress heatmaps), but I did not open its documentation.

### Screen-reader considerations for music content
- **What WCAG requires.** Provide a text alternative for non-text content, with a long description for complex graphics ([Understanding 1.1.1](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html)). Techniques cited there: ARIA labels/`alt` for short alternatives, `aria-describedby` or an adjacent description for long ones.
- **Practical approach (recommendations; no music-specific accessibility study opened).**
  - Render notation as SVG with a `role="img"` container and an off-screen or expandable text description per bar: "Bar 5, beats 1-4: G major chord, down-down-up-up-down, quarter = 80."
  - Provide the same data as a table (bar, beat, note/chord, string/fret) that screen reader users can navigate with table commands.
  - Announce the current bar during playback via a polite live region only on bar change, throttled, and user-toggleable, since constant announcements would conflict with listening and playing. Never announce at note rate.
  - Make all transport controls proper buttons with names, states (`aria-pressed` for mute/solo), and values (`aria-valuetext` such as "80 percent, 96 BPM") for tempo sliders.
  - Export to MusicXML (which encodes chord symbols, tablature, and percussion semantics ([MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/))) so users can open the score in braille-music or accessible score tools. I did not research braille-music conversion tools; flagged as an open question.
- **Blind and low-vision learners.** The audio-first nature of Splitune (isolated stems, slow-down, loops) is intrinsically accessible, so the product's learning loop can work without any visuals if the controls and pass feedback are spoken or sonified. Consider a **sonified feedback mode** (tones for correct/missed) rather than relying on screen reading. Large-print music exists as Modified Stave Notation for partially sighted musicians ([MuseScore tutorial](https://musescore.org/en/tutorials/modified-stave-notation)); support a custom notation scale up to at least 200%.

### Left-handed players
- A left-handed guitarist typically plays a mirrored instrument. **Fretboard and chord diagrams** must therefore be mirrorable (nut on the right, strings in mirrored order); **tab** itself names strings and frets and normally need not change. These conventions come from design reasoning, not a source I opened; validate with left-handed players and guitar teachers before locking the data model. Keyboards are not mirrored.
- For video-derived hand analysis (see `ml/video-and-audio-visual-analysis.md`), the model must not assume fretting hand = left. Add an instrument-level `handedness` setting that flips fretting-hand overlays, finger numbering, and camera guidance.
- Provide the setting during onboarding (`ux/onboarding-retention-motivation.md`) and in the display settings (`ux/music-display-ui.md`).
- Songs whose source video shows a right-handed player will have mirrored hand positions relative to a left-handed learner; offer a mirrored video view as an optional aid (flip horizontal) when displaying a video, since mirrored viewing is a common teaching convenience (inference).

### Hearing-impaired learners and visual metronome
- Guitar Pro has a visual metronome that flashes on each beat and can also flash during the countdown; setting the metronome volume to 0 gives a visual-only click ([Guitar Pro tempo and metronome](https://www.guitar-pro.com/docs/gp8/audio/playback/tempo-metronome)). Match that and add **haptic beat** via vibration on devices that support it (recommendation).
- Keep flashes within WCAG 2.3.1 limits (no more than three per second unless below threshold) ([Understanding 2.3.1](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html)): at tempos above 180 BPM, flash on every second beat or switch to a bar-level pulse.
- Offer **visual feedback for pitch and onset** (tuner needle, timing deviation bar) so deaf and hard-of-hearing learners can use scoring without relying on audio cues. Whether such learners are in Splitune's target market is a product question; the design cost is low.
- Provide visible captions/lyrics for any narrated Splitune content and avoid audio-only prompts (count-in has a visual counterpart).

### Captions and video
- WCAG 1.2.2 requires captions for prerecorded audio in synchronised media (Level A) ([Understanding 1.2.2](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html)). For user-supplied YouTube videos, caption availability is controlled by the uploader and platform; surface the platform's caption toggle where the player supports it and see `legal/youtube-copyright-and-platform-policy.md` for what is allowed with embedded video.
- Splitune's own tutorials and onboarding clips should ship with captions. Soundslice lists a "Subtitles" help topic in its player docs, so subtitle support alongside synchronised video is established practice ([Soundslice player help](https://www.soundslice.com/help/en/player/)).

### Reduced motion and photosensitivity
- The CSS `prefers-reduced-motion` media feature reports the user's OS-level preference, with values `no-preference` and `reduce`, and is Baseline "widely available" since January 2020; MDN notes large scaling/panning animations can trigger discomfort for people with vestibular disorders ([MDN prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion)). Native equivalents exist on iOS and Android (not researched here).
- Under `reduce`, Splitune should: switch from continuous scrolling to page-flip by bar group; replace falling-notes motion with a static roll plus a moving playhead; remove celebratory animations; disable parallax/zoom; keep any beat indication to a small non-flashing pulse.
- WCAG 2.3.3 (AAA) is the standard reference for disabling interaction-triggered animation ([Understanding 2.3.3](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html)); implement it even though AAA.

## Implications for Splitune
- Put accessibility **tokens** in the design system from the start: the Okabe-Ito set with measured contrast values, 24/44 px target-size tokens, a reduced-motion switch, and a second-cue rule for all colour semantics.
- Use a **renderer-agnostic note model** with per-note semantic metadata so the same data can drive SVG, text descriptions, tables, MusicXML export, and sonified feedback.
- Add **non-drag alternatives** for every drag interaction at design time. This is the most likely AA failure in a loop/timeline UI.
- Include **handedness** in the user profile schema early (affects fretboard rendering, ML overlays, and onboarding).
- Test with at least a screen reader (VoiceOver, TalkBack, NVDA), colour-vision simulators, 200% text scaling, and a keyboard-only/pedal-only run before beta.

## Open questions
- Do blind musicians prefer MusicXML-to-braille workflows or bar-by-bar text? Interview 3-5 blind/low-vision musicians and a braille-music specialist.
- Is auto-scrolling notation covered by 2.2.2 when scrolling is essential to the activity? Argue conservatively; provide pause and static view.
- Exact mirrored-chord-diagram conventions among left-handed guitarists; verify with users and teachers.
- Do major devices expose haptic metronome APIs consistently (web Vibration API support is limited on iOS)? Check platform docs when platform is chosen.
- ColorBrewer and Apple/Material accessibility docs were not opened; confirm any contrast or motion claims drawn from them before use.
- Accessibility of embedded YouTube iframe players (keyboard traps, caption control) needs testing.

## Sources
- [WCAG 2.2 Understanding 1.1.1 Non-text Content](https://www.w3.org/WAI/WCAG22/Understanding/non-text-content.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.2.2 Captions (Prerecorded)](https://www.w3.org/WAI/WCAG22/Understanding/captions-prerecorded.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.4.1 Use of Color](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.4.2 Audio Control](https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.4.3 Contrast (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/contrast-minimum.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.4.4 Resize Text](https://www.w3.org/WAI/WCAG22/Understanding/resize-text.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 1.4.11 Non-text Contrast](https://www.w3.org/WAI/WCAG22/Understanding/non-text-contrast.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.1.1 Keyboard](https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.2.2 Pause, Stop, Hide](https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.3.1 Three Flashes or Below Threshold](https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.3.3 Animation from Interactions](https://www.w3.org/WAI/WCAG22/Understanding/animation-from-interactions.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.4.11 Focus Not Obscured (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.5.7 Dragging Movements](https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.5.8 Target Size (Minimum)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — tier 2, accessed 2026-10-20
- [WCAG 2.2 Understanding 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG22/Understanding/target-size-enhanced.html) — tier 2, accessed 2026-10-20
- [Okabe & Ito, Color Universal Design](https://jfly.uni-koeln.de/color/) — tier 1, accessed 2026-10-20
- [Siegal Lab colour palette (Okabe-Ito hex values)](https://siegal.bio.nyu.edu/color-palette/) — tier 3, accessed 2026-10-20
- [Android accessibility principles](https://developer.android.com/guide/topics/ui/accessibility/principles) — tier 2, accessed 2026-10-20
- [MusicXML 4.0](https://www.w3.org/2021/06/musicxml40/) — tier 2, accessed 2026-10-20
- [MuseScore: Modified Stave Notation](https://musescore.org/en/tutorials/modified-stave-notation) — tier 2, accessed 2026-10-20
- [Guitar Pro 8: Tempo and metronome](https://www.guitar-pro.com/docs/gp8/audio/playback/tempo-metronome) — tier 2, accessed 2026-10-20
- [Soundslice help: player index](https://www.soundslice.com/help/en/player/) — tier 2, accessed 2026-10-20
- [MDN: prefers-reduced-motion](https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion) — tier 2, accessed 2026-10-20
