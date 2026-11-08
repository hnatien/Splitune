# Visual and interaction design direction for Splitune: music software and pro creative tools, 2025–2026

Research date: 8 November 2026. Sources are a mix of primary pages (CDM, Linear, Radix, SMuFL spec, MDN, Adrian Roselli, Image-Line manual, NI support) and secondary search summaries. Items marked "(search summary)" come from search-result summaries whose page was not opened, so verify before quoting. Products not covered for lack of budget are listed under Gaps. Repo context checked locally: `apps/web` already depends on `@base-ui/react` 1.9.0 and `tailwindcss` 4.3.3; `packages/ui-tokens/src/fonts.css` self-hosts Inter (variable, 4.1) and Atkinson Hyperlegible Next; `packages/ui-tokens/src/primitives.css` already uses OKLCH.

## 1. What leading music/audio tools look like in 2025–2026, and why (dark vs light, flat vs skeuomorphic, track/stem colour)

### Takeaway
The big DAWs still default to dark, flat, low-chroma chrome where colour belongs to content (clips, tracks, meters). The 2024–2026 change is that they now offer **light, high-contrast, OS-following and contrast-slider variants** and cut visual clutter (Ableton Live 12 is the clearest case). Practice apps (Moises, Songsterr, Soundslice) are converging on dark-mode options, a waveform view, huge chord letters and "the notation is the timeline" interaction. Skeuomorphism survives mainly in plug-in and console skins. Apple's translucent Liquid Glass drew sustained legibility criticism and Apple partly walked it back, which is a warning for a tool read from a music stand.

### Cited Findings
**Ableton Live 12 (released 2024; 12.x through 2026)**
- Live 12's UI refresh reworked scrollbars, view controls, outlines, corner radius, padding and spacing so elements align, with "noticeably less visual clutter and distraction". The menu bar moved into the window. — [CDM, Live 12 everything new](https://cdm.link/ableton-live-12-everything-new/)
- New themes take "a different approach to contrast and complementary color" that CDM calls "easier on the eyes". The default theme can follow the system's light/dark setting. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- The default theme has three controls: High-Contrast on/off, Tone (Cool/Neutral/Warm) and Dark/Light (search summary of the 12.1 review). — [Audiofanzine Live 12.1 review](https://en.audiofanzine.com/general-sequencer/ableton/live-12-suite/editorial/reviews/ableton-live-12-1-review.html)
- The high-contrast option sits under Settings → Themes & Colors and "makes everything pop" so things are found quicker (search summary). — [Elephorm](https://www.elephorm.com/formation/ableton-live-12-prise-en-main/personnalisation-de-laffichage-dans-live-12)
- Mixer changes: a small colour stripe along the bottom of each channel (track colour as an identity strip, not a fill), a larger volume handle and a dB readout. The meter gradient was adjusted for easier reading, and meters respond faster so transients are easier to see. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- Live 12 added screen-reader support on macOS and Windows and expanded keyboard navigation, with a user choice for whether Tab switches views or moves between elements. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- Third-party theme makers sell "ultra-dark" and "high-luminance" packs for Live 12; the latter are aimed at bright rooms. — [Isotonik, Infra Light theme](https://isotonikstudios.com/product/infra-light-theme-by-deafman-skws/); [Gumroad, deafmanskwx](https://deafmanskwx.gumroad.com/l/nnozm)

**Bitwig Studio 5**
- Bitwig 5 added Global GUI Contrast settings but keeps one "love-it-or-leave-it" colour scheme. CDM notes that Bitwig lacks the contrast features and OS light/dark awareness recently added in Live 12. Users keep a GitHub collection ("Awesome Bitwig Themes") of community mods. — [CDM, Bitwig themes (2024)](https://cdm.link/2024/07/bitwig-themes/)
- Forum users ask for a dark arrangement background so that "colorful notes and automations would be more easy to read" (search summary). — [KVR forum, Bitwig 5.2](https://www.kvraudio.com/forum/viewtopic.php?p=7431998)

**FL Studio (2025)**
- FL Studio's theme system exposes Saturation ("intensity of color") and Contrast ("relative difference in brightness of various UI elements"), and there are thousands of community themes. — [Image-Line manual, Themes](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/envsettings_themes.htm)
- A 2025 roundup lists "Vectorial UI upgrades", without detail (search summary). — [RouteNote, FL Studio 2025](https://create.routenote.com/blog/?p=19889)
- A December 2025 user complaint says the 2025 theme changes turned the browser into "a wall of orange", making files and folders harder to tell apart (search summary). — [Image-Line forum](https://forum.image-line.com/viewtopic.php?p=2039807)

**Native Instruments Kontakt 8**
- Reviewers call the UI cleaner and brighter than Kontakt 7 and a clear step forward. — [Gear4music review](https://www.gear4music.com/blog/native-instruments-kontakt-8-review/); [MusicRadar review](https://www.musicradar.com/music-tech/plugins/native-instruments-kontakt-8-review); [Sound On Sound](https://www.soundonsound.com/reviews/native-instruments-kontakt-8)
- Long-time users criticise a half-migrated UI ("dogs dinner"), where older editors and the rack sit beside the new look and they have to keep switching to "classic" views. — [NI community, UI/UX feedback](https://community.native-instruments.com/discussion/37014/ui-ux-feedback-your-thoughts); [NI community, roadmap thread](https://community.native-instruments.com/discussion/42276/any-roadmap-on-improved-frontend-backend-for-kontakt-8)
- Kontakt 8.8 reworked the header and added performance modes and zoom controls. — [NI Support, Kontakt 8.8 UI changes](https://support.native-instruments.com/support/solutions/articles/69000879707-kontakt-8-8-user-interface-changes)

**Universal Audio LUNA**
- LUNA 1.9 (July 2025) added Instrument Detection, which analyses incoming audio and automatically names and colour-codes tracks by instrument (search summary). — [MusicRadar, LUNA AI tools](https://www.musicradar.com/music-tech/universal-audios-free-daw-luna-updated-with-ai-powered-tools-including-voice-control-and-instrument-detection); [Mixdown](https://mixdownmag.com.au/news/universal-audio-introduces-ai-powered-features-in-luna-update/)
- LUNA 2 (around October 2025) reportedly reworked the whole UI for high-resolution displays and added a Track Inspector that shows EQ, compressor and sends on the channel (search summary of a German review). — [KVR, LUNA v2](https://www.kvraudio.com/news/universal-audio-updates-luna-daw-to-v2-65108); [bonedo](https://www.bonedo.de/?p=2638133)
- An earlier LUNA update used an API analogue-console look, giving "the sound and feel of a large-format console": skeuomorphism as a product feature. — [MusicRadar](https://musicradar.com/news/universal-audios-luna-update-turns-its-daw-into-an-api-analogue-console)

**Logic Pro (flag: "Logic Pro 11 / Logic for iPad 2" is outdated)**
- Logic Pro for Mac 12 and Logic Pro for iPad 3 have shipped. MusicRadar calls them "solid rather than spectacular" updates. — [MusicRadar review](https://www.musicradar.com/music-tech/daws/experienced-producers-might-feel-uneasy-about-the-focus-being-put-so-heavily-on-ai-and-the-session-players-but-its-still-an-instant-recommendation-apple-logic-pro-for-mac-12-and-logic-pro-for-ipad-3-review)
- Logic Pro 12 introduces "harmonic intelligence" and "Chord ID". That is a direct overlap with Splitune's chord lane, known here only from a CDM article title. — [CDM tag: chord-id](https://cdm.link/tag/chord-id)
- Sound On Sound's 2023 Logic for iPad review asked whether Apple achieved a touch-first UI "without sacrificing pro features". The Control Bar runs along the top and works in either orientation (search summary). — [Sound On Sound, Logic Pro for iPad](https://www.soundonsound.com/reviews/apple-logic-pro-ipad)
- Apple's docs say standard SwiftUI/UIKit/AppKit controls pick up Liquid Glass automatically (search summary). No source found on how Logic 12 looks under it. — [Apple developer, Liquid Glass overview](https://developer.apple.com/tutorials/data/documentation/technologyoverviews/liquid-glass.md)

**Apple Liquid Glass (iOS/iPadOS/macOS 26, September 2025)**
- Legibility drew sustained criticism. Apple made substantial changes after beta testers complained, and a later "Tinted" option in iOS 26.1 beta 4 tones the gloss down. — [9to5Mac](https://9to5mac.com/2025/09/15/ios-26-officially-launches-today-but-some-developers-arent-sure-it-should/); [Gulf News](https://gulfnews.com/technology/companies/apple-yields-tinted-control-in-ios-261-beta-4-tones-down-liquid-glass-after-backlash-1.500315176); [Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)
- Reduce Transparency makes the glass "frostier and more opaque", which helps legibility. Critics also say adaptive light/dark flipping of controls adds distraction. — [MobileSyrup](https://mobilesyrup.com/2025/06/10/how-apple-is-making-sure-liquid-glass-as-legible-as-possible/); [Pixel Envy, On Liquid Glass](https://pxlnv.com/blog/on-liquid-glass/)

**Google Material 3 Expressive (2025)**
- Google says Material 3 Expressive rests on 46 studies with more than 18,000 participants, including eye tracking and emotional-response surveys (secondary reports). — [IxDF, Material Design](https://ixdf.org/literature/topics/material-design); [Android Central](https://www.androidcentral.com/apps-software/android-os/google-leaked-its-own-design-process-for-material-3-expressive)

**Practice apps**
- Moises: in October 2025 the iPad app got a new look, with setlists in the main navigation and a player waveform view "for practice precision". The same changelog lists a new mixer design and a revamped song library (search summary; the page returned 404 when fetched). — [Moises News, latest releases](https://moises.ai/blog/moises-news/improvements-latest-releases)
- Moises's design write-up says that with the chord grid on, "chords take over the screen in large, readable letters". Moises was a 2025 Apple Design Awards finalist (search summary). — [Moises, Apple Design Awards nomination](https://moises.ai/blog/moises-news/apple-design-awards-nomination)
- Songsterr 10 (spring 2025) shipped a "completely rebuilt player with a modern look", added dark mode in 10.0.1, and later added a master volume slider in the mixer and transpose (App Store notes, search summary). — [Songsterr on the App Store](https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291)
- Soundslice: notes light up during playback, clicking a note seeks there, and dragging across notation makes a loop whose edges can be dragged. A Mixer hides parts. A divider between video and notation can be dragged to resize or hide the video, which sits left of or above the music. With no recording, playback falls back to synthetic sound. — [Soundslice features](https://soundslice.com/features/); [Soundslice music practice](https://www.soundslice.com/music-practice/)

**Teenage Engineering (EP-133 K.O. II)**
- The EP-133 uses a "super-segment hybrid display". Its colours and shapes are "reminiscent of LCARS", and Sound On Sound credits the display with a "unique vibe". A user notes it leaves little room for new firmware screens. — [Yanko Design](https://www.yankodesign.com/2023/11/23/teenage-engineering-made-a-tricorder-like-gadget-thats-actually-a-portable-synthesizer/); [Sound On Sound review](https://www.soundonsound.com/reviews/teenage-engineering-ep-133-ko-ii?amp); [Elektronauts thread](https://www.elektronauts.com/t/teenage-engineering-ep-133-k-o-ii/203660?page=75)

**Non-music pro tool reference: Linear (March 2024 redesign)**
- Goals: "reduce visual noise, maintain visual alignment, and increase the hierarchy and density of navigation elements". Themes are generated in LCH from three inputs (base colour, accent colour, contrast) instead of 98 variables. The contrast input allows very high-contrast accessibility themes. Linear cut blue in the chrome for a more neutral look and uses Inter Display for headings. — [Linear, How we redesigned the Linear UI](https://linear.app/now/how-we-redesigned-the-linear-ui)

### Inferences
- **Dark vs light:** "Dark by default" is no longer the whole story. Every major DAW now treats appearance as a parameter set: light/dark, tone, contrast, saturation, OS-follow (Live 12, FL, Bitwig contrast). Splitune should design the token system around a small set of generator inputs (Linear-style: base, accent, contrast, maybe warmth) rather than two hand-tuned themes.
- **Colour belongs to content, not chrome:** Live 12's channel colour stripe, LUNA's automatic per-instrument colour and Linear's de-blued chrome all point the same way. Chrome stays near-neutral; stems and instruments carry hue. Splitune's stems map directly onto this (LUNA's auto colour-coding by detected instrument is the closest precedent).
- **Flat vs skeuomorphic:** Mainstream UIs are flat with refined spacing and alignment. Skeuomorphism appears where it sells a sound (console emulation) or as a brand signature (TE hardware). A practice tool gains little from skeuomorphic controls but can borrow hardware cues (big numerals, segment-like readouts, physical pedal metaphors).
- **Practice-app convergence:** Moises, Songsterr and Soundslice all treat dark mode, large chords, waveform and notation-as-timeline (click to seek, drag to loop) as baseline expectations, not differentiators.
- **Glass and translucency:** The Liquid Glass backlash and Apple's "Tinted" and Reduce Transparency mitigations argue against translucent overlays over waveforms or notation, where what passes behind cannot be controlled. Opaque surfaces are safer for a music-stand tool.
- **Migration lesson:** Kontakt 8 shows that a half-migrated redesign is worse than either old or new. Splitune's ground-up redesign should replace whole screens at once.

### Gaps
- Not researched in this pass: Splice (web/desktop), Spotify and Apple Music players, Arturia (Analog Lab, V Collection), Native Instruments Komplete Kontrol 3, FL Studio Mobile, OP-1 field, and "Native Audio" apps (unclear which product is meant).
- No confirmed source on whether Bitwig 6 (if released) added official themes, or whether an Ableton Live 13 exists by November 2026.
- Logic Pro 12's visual changes and Liquid Glass adoption are undocumented in the sources found. Only the existence of Logic 12 / iPad 3 and Chord ID was confirmed.
- No independent write-up of a Moises full redesign. The claims come from Moises's own blog and changelog.

## 2. Typography for dense pro UIs and music notation

### Takeaway
Inter 4.x (already in the repo) is a sound UI default: tabular figures, slashed zero and an optical-size axis with display cuts. Geist Mono suits time and tempo readouts if a mono is wanted. For notation, Bravura is the most complete SMuFL font, Petaluma gives a handwritten/jazz voice and Leland a classic-engraving voice. Chord symbols combine text-font letters, SMuFL `csym*` quality glyphs and music-font accidentals.

### Cited Findings
- Inter 4.0 is "a major release" with thousands of redesigned glyphs, new OpenType features, six display designs on an optical-size axis and humanist italics. Expect noticeable differences when switching from 3.x. — [rsms/inter releases](https://github.com/rsms/inter/releases)
- Inter 4 includes tabular numbers, slashed zero and contextual alternates. Tabular styling changed from 3.x. — [Debian fonts-inter](https://packages.debian.org/nl/sid/m68k/fonts-inter); [Figma forum, Inter 4.0](https://forum.figma.com/t/update-inter-font-to-newest-version-4-0/92102)
- Linear uses Inter Display for headings "to add character" and Inter for other text. — [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Geist (Vercel with Basement Studio) is OFL 1.1. Geist Mono "prioritizes readability in code and tabular content" and is variable from 100 to 900. — [Vercel, Geist Mono](https://vercel.com/font/geist-mono); [vercel/geist-font](https://github.com/vercel/geist-font)
- Bravura, by Daniel Spreadbury for Dorico, was the first SMuFL-compliant font. It has almost 3,000 glyphs (the whole spec) and is MuseScore's fallback for glyphs missing from other fonts. — [SMuFL fonts](https://www.smufl.org/fonts/); [MuseScore handbook, music fonts](https://handbook.musescore.org/appendix/music-fonts)
- Petaluma is a jazz/handwritten family (Petaluma, Petaluma Text, Petaluma Script), about 1,350 glyphs, SIL OFL. Leland is MuseScore's default, modelled on SCORE's engraving. Finale Maestro became SMuFL with Finale v27 (2021). — [MuseScore handbook](https://handbook.musescore.org/appendix/music-fonts)
- A self-made, unverified forum audit puts SMuFL recommended-repertoire coverage at Bravura 99.86%, Finale Maestro and Finale Engraver 81.92% and Petaluma 46.69%. — [Steinberg forum](https://forums.steinberg.net/t/fully-compatible-smufl-fonts/1041112)
- Font choice changes spacing: a Dorico user saw a large gap between a letter and a flat when switching the music text font from Bravura to Leland. — [Steinberg forum, SMuFL discussion](https://forums.steinberg.net/t/discussion-of-smufl-fonts-with-description-usage/933710)
- SMuFL chord symbols occupy U+E870–U+E87F: csymDiminished (°), csymHalfDiminished (ø), csymAugmented (+), csymMajorSeventh (△), csymMinor, tall and very-tall parentheses and brackets, csymAlteredBassSlash and csymDiagonalArrangementSlash. Letters A–G, quality letters and numbers come from a text font. Accidentals (accidentalSharp/accidentalFlat) come from the music font. — [SMuFL spec, chord symbols](https://smufl.formats.music/latest/tables/chord-symbols.html)
- alphaTab, which Splitune's alphaTex pipeline targets, has a SMuFL fonts guide (page not opened). — [alphaTab SMuFL guide](https://alphatab.net/docs/guides/smufl)
- Moises's chord grid shows chords "in large, readable letters" that take over the screen (search summary). — [Moises ADA nomination](https://moises.ai/blog/moises-news/apple-design-awards-nomination)

### Inferences
- **UI family:** Keep Inter 4.x. Use `font-variant-numeric: tabular-nums` (plus slashed zero where 0/O confusion matters) on every changing number (time, bar:beat, BPM, %, dB, cents), so readouts don't jitter while playing. Use the `opsz` / Inter Display cuts for large readouts (chords, bar number, tempo on stand view). A mono (Geist Mono, JetBrains Mono) is optional; tabular sans is usually enough for time codes and reads better at distance. Atkinson Hyperlegible Next (already shipped) is a sensible opt-in "high legibility" reading font.
- **Tab:** Fret numbers need tabular, highly distinguishable digits (1/7, 3/8, 6/0). If alphaTab renders tab, configure its text font to the UI font with tabular figures, or a mono, and test at stand distance.
- **Chord symbols:** Root letter in the UI font at display size. Accidentals as true ♯/♭ glyphs (music font or Unicode U+266F/U+266D with a font that has them, never "#"/"b"). Quality and extensions smaller and raised (about 60–70% size, baseline-shifted), with ° ø △ from SMuFL `csym*` or Unicode. Slash bass at reduced size after an altered-bass slash. Pick one notation font family (Bravura for completeness, Petaluma for a "lead sheet" personality) and match the chord typography to it.
- **Glanceability at distance (rough calculation, not from a source):** A music stand sits about 60–100 cm from the eyes. 1° of visual angle at 1 m is about 17.5 mm. A comfortable cap height for glance-reading of about 0.4–0.6° is about 7–10 mm. With Inter's cap height near 0.73 em, that is a font size of about 10–14 mm. CSS px differ physically by device: about 0.26 mm at the 96 dpi reference, about 0.19 mm on an iPad at DPR 2 / 132 CSS ppi. So stand-view sizes should be specified physically (mm at the expected distance) and mapped per breakpoint, not fixed in px. Validate with real devices on a stand.

### Gaps
- No source fetched on Söhne, IBM Plex, Space Grotesk, SF Pro or Berkeley Mono in music UIs, or on licensing for web use (Söhne and Berkeley Mono are commercial; SF Pro is licensed for Apple platforms only, from general knowledge, unverified here).
- Finale was reportedly discontinued by MakeMusic in 2024 (general knowledge, not verified here). Whether Finale Maestro stays maintained and distributable is unconfirmed.
- No empirical source found on minimum chord or tab glyph sizes at music-stand distance. The calculation above is an estimate to test.
- No source opened on which SMuFL fonts alphaTab bundles or supports by default.

## 3. Colour: OKLCH tokens, categorical stem palettes, semantic states, contrast (WCAG 2.2 vs APCA)

### Takeaway
Build tokens in OKLCH, which is perceptually uniform, P3-capable and Tailwind v4's native space. Structure roles on a Radix-style 12-step scale. Use WCAG 2.2 (1.4.3 text, 1.4.11 non-text 3:1) as the compliance gate. APCA is useful as a design aid but is not part of the WCAG 3 draft, and WCAG 3's contrast method is undecided as of April 2026. For stems, Okabe-Ito or Paul Tol palettes are a colour-blind-safe start. They pass 3:1 on dark backgrounds but need darker variants on light or paper.

### Cited Findings
- OKLCH is perceptually uniform, so lightness steps look even and gradients avoid a muddy middle. Tailwind v4 moved its palette to OKLCH and to colours outside sRGB (Display P3). Shade values changed (for example red-500 went from #ef4444 to #fb2c36). — [DEV, The mystery of Tailwind colors v4](https://dev.to/matfrana/the-mystery-of-tailwind-colors-v4-hjh); [Steve Kinney, OKLCH colors](https://stevekinney.com/courses/tailwind/oklch-colors); [UX Collective, OKLCH explained](https://uxdesign.cc/oklch-explained-for-designers-dc6af4433611)
- The Radix 12-step scale works like this:
  - Steps 1–2 are app and subtle backgrounds.
  - Steps 3–5 are component backgrounds: normal, hover, pressed/selected.
  - Steps 6–8 are borders: subtle, interactive, strong/focus ring.
  - Steps 9–10 are solid fills and their hover (step 9 is the purest, highest-chroma step).
  - Steps 11–12 are low- and high-contrast text.
  - Steps 11 and 12 are guaranteed APCA Lc 60 and Lc 90 on step 2 of the same scale.
  - Most step-9 colours take white text, except Sky, Mint, Lime, Yellow and Amber, which take dark text.
  - Dark-mode app background is step 1 or 2 of a gray or coloured scale, via a mode-dependent alias.

  — [Radix Colors, Understanding the scale](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Linear generates whole themes in LCH from base, accent and contrast. The contrast input allows very high-contrast accessible themes. Text and neutral icons were darkened in light mode and lightened in dark mode. — [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- **WCAG 3 / APCA status (April 2026):** The April 8, 2026 WCAG 3 Editor's Draft lists contrast as "Exploratory" and says "The contrast algorithm used in WCAG 3 is yet to be determined." APCA was dropped from the WCAG 3 draft in July 2023. WCAG 3 is "perhaps 2030 at the earliest". Designers should keep meeting WCAG 2.2 1.4.3 and 1.4.11 and, if using APCA, pick colours that also pass WCAG 2. APCA's author calls it "draft guidance we are actively testing" and offers BridgePCA, which is designed to pass WCAG 2. — [Adrian Roselli, WCAG3 Contrast as of April 2026](https://adrianroselli.com/2026/04/wcag3-contrast-as-of-april-2026.html)
- Paul Tol's "bright", "high-contrast", "vibrant" and "muted" qualitative schemes are colour-blind safe. His "pale" and "dark" schemes are not distinct enough for data and are meant for text backgrounds or text. — [khroma vignette, Paul Tol's schemes](https://tesselle.r-universe.dev/khroma/doc/tol.html)
- The Okabe-Ito palette (popularised by Bang Wong, Nature Methods 2011) is #E69F00 orange, #56B4E9 sky blue, #009E73 bluish green, #F0E442 yellow, #0072B2 blue, #D55E00 vermillion, #CC79A7 reddish purple and #000000. It is R's default `palette.colors()`. — [ggokabeito manual](https://malcolmbarrett.r-universe.dev/ggokabeito/doc/manual.html); [kuva palettes](https://www.mintlify.com/Psy-Fer/kuva/api/utilities/palettes)
- DAWs expose colour intensity as user settings: FL Studio Saturation and Contrast sliders, Live 12 Tone and High-Contrast, Bitwig Global GUI Contrast. — [Image-Line manual](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/envsettings_themes.htm); [Audiofanzine](https://en.audiofanzine.com/general-sequencer/ableton/live-12-suite/editorial/reviews/ableton-live-12-1-review.html); [CDM Bitwig themes](https://cdm.link/2024/07/bitwig-themes/)
- One accent hue spread across everything hurts wayfinding (FL 2025 "wall of orange" complaint, search summary). — [Image-Line forum](https://forum.image-line.com/viewtopic.php?p=2039807)

### Inferences
- **My computation (WCAG 2 contrast ratios of Okabe-Ito colours, script in session scratchpad):**

  | Colour | White | Paper #F5F1E8 | Dark #121212 | Dark #1C1C1E |
  |---|---|---|---|---|
  | orange | 2.25 | 2.00 | 8.32 | 7.55 |
  | sky blue | 2.31 | 2.05 | 8.12 | 7.37 |
  | bluish green | 3.42 | 3.04 | 5.48 | 4.97 |
  | yellow | 1.32 | 1.17 | 14.17 | 12.87 |
  | blue | 5.19 | 4.60 | 3.61 | 3.28 |
  | vermillion | 3.87 | 3.43 | 4.84 | 4.40 |
  | reddish purple | 3.06 | 2.72 | 6.12 | 5.56 |

  On dark backgrounds all seven hues clear the 3:1 non-text threshold (blue only just). On white or paper, four of them (orange, sky blue, yellow, reddish purple) fail 3:1. The fix is to keep hue (OKLCH h) and lower L for light mode: one stem hue gets per-mode lightness, as Radix's per-mode scales do.
- **Stem palette recipe:** Define each stem (vocals, guitar, bass, drums, piano/keys, other, plus 2 spares) as a fixed OKLCH hue taken from Okabe-Ito / Tol "bright". Generate a small per-stem scale: subtle fill for lanes, solid for waveform and identity strip, text-safe for labels, at constant L within a mode so no stem looks "louder". Always pair colour with a text label and instrument icon (Splitune's "confidence never shown by colour alone" rule extends naturally to stem identity). Check with CVD simulation for deuteranopia, protanopia and tritanopia in both modes.
- **Semantic states** (selected, loop, playhead, record, error, warning, success, low confidence) should take hues not used by stems, or be expressed through shape, outline or pattern, so a red stem never reads as an error. The playhead benefits from a reserved high-contrast neutral or a unique accent rather than a stem hue.
- **Contrast policy:** Gate on WCAG 2.2 AA (4.5:1 text, 3:1 non-text, including waveform-against-lane and loop-handle-against-waveform). Use APCA Lc targets as an extra check for thin and small text in dense panels (Radix's Lc 60/90 text steps are a ready model).
- **Generator inputs:** Following Linear and Live 12, expose base neutral, accent, contrast and warmth (Live's Cool/Neutral/Warm "Tone") as the only theme parameters. A "stand/high-contrast" variant is then a parameter change, not a new theme.

### Gaps
- No source fetched on Material 3 dynamic colour (HCT) or Apple's 2025–26 system colour changes. Their relevance to a branded web tool is likely low.
- Tol's technical note was not checked for dark-background guidance. No published categorical palette was found that is tuned for both dark and light UIs at once. The per-mode lightness approach is an inference to validate.
- The W3C Understanding pages could not be fetched (HTTP 403), so WCAG 2.2 values (for example SC 2.5.8 target size, generally known as 24×24 CSS px minimum; SC 2.5.5 enhanced 44×44) are from general knowledge here and should be verified at w3.org.

## 4. Layout patterns for dense real-time tools on the web (shell vs focus, docked vs sheets, inspectors, responsive 1440→390, command palette, keyboard-first)

### Takeaway
Pro tools are moving to configurable, stackable panels with per-view layout memory (Live 12), quiet chrome with side "meta" panels and multiple views (Linear), and resizable splits between media and notation (Soundslice). On touch, the shift is to fewer, larger controls and modes that hand the screen to one thing, as Moises's chord grid does.

### Cited Findings
- Live 12 can stack Clip Editor, Device View and automation instead of switching, toggle the Mixer inside Arrangement view, and keep separate view configurations for Arrangement and Session. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- Live 12's keyboard navigation lets the user choose whether Tab switches views or moves between elements. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- Linear's layouts use headers for filters and display options, side panels for meta properties, and multiple views (list, board, timeline, split, fullscreen). Navigation controls (back/forward, tabs) are designed to be removable in browsers because the same UI runs in Electron and on the web. — [Linear redesign](https://linear.app/now/how-we-redesigned-the-linear-ui)
- Soundslice: a draggable divider resizes or hides the video, which can sit left of or above notation, and the notation reflows automatically. — [Soundslice features](https://soundslice.com/features/)
- Moises iPad: setlists moved into the main navigation, and the chord grid takes over the screen during playback (search summaries). — [Moises releases](https://moises.ai/blog/moises-news/improvements-latest-releases); [Moises ADA](https://moises.ai/blog/moises-news/apple-design-awards-nomination)
- Logic for iPad keeps a top Control Bar that works in either orientation. A reviewer on a 12.9-inch iPad Pro found it never felt cramped (search summaries). — [Sound On Sound](https://www.soundonsound.com/reviews/apple-logic-pro-ipad); [Kowatek review](https://blog.kowatek.com/?p=29617)
- Kontakt 8.8 added zoom controls, letting users scale a dense UI. LUNA 2's Track Inspector puts EQ, compressor and sends on the selected channel (search summary). — [NI Support](https://support.native-instruments.com/support/solutions/articles/69000879707-kontakt-8-8-user-interface-changes); [bonedo](https://www.bonedo.de/?p=2638133)

### Inferences
- **Two modes, one shell:** a *Library/App shell* (nav, search, import queue) and a *Practice focus mode* that removes app chrome and gives the screen to timeline, lanes and transport. Practice mode should remember its panel layout per device class, as Live 12 keeps per-view settings.
- **Responsive strategy:**
  - 1440+: timeline and lanes (waveform, chords, tab) centre, a docked right inspector (mixer / loop list / speed), a persistent transport bar.
  - 1024 landscape tablet: inspector becomes a collapsible drawer, lanes stay.
  - 768 portrait tablet on a stand: a "stand view" with large chord and tab lanes, minimal waveform overview, big transport and loop controls, pedal hints. Linear's "fullscreen view" and Moises's chord takeover are precedents.
  - 390 phone: one primary lane at a time (chords or tab) with a swipeable lane switcher, a bottom sheet for mixer and speed, and the transport in the thumb zone.
- **Command palette (⌘K / Ctrl+K)** for navigation and rarely used actions (set loop to bars N–M, change tuning, export), with visible shortcut hints in menus and tooltips. Pedal and keyboard bindings get their own visible map. This fits Splitune's "every practice action keyboard/pedal operable" rule.
- **Avoid floating glass HUDs over content.** Use docked, opaque panels and sheets so waveform and notation legibility never depends on what sits behind a control.

### Gaps
- No primary source was fetched for command-palette conventions (Linear, Raycast, Arc, Figma) or for Figma's UI3 panel redesign. The palette recommendation is an inference.
- No source on bottom-sheet conventions in music apps specifically, or measured touch-target sizes in practice apps.

## 5. Motion: playhead and scroll performance, state changes, reduced motion, meters and waveforms

### Takeaway
Audio UIs keep motion functional: the playhead and meters move because the music moves, and everything else should be near-static. The web technique is to drive the playhead from the audio clock (`AudioContext.getOutputTimestamp()` inside `requestAnimationFrame`), with care on Safari. Spring-based expressive motion (Material 3 Expressive) suits UI transitions, not the practice canvas.

### Cited Findings
- Live 12 adjusted the meter gradient "for easier visual reading" and made meters respond faster so transients are easier to see. — [CDM](https://cdm.link/ableton-live-12-everything-new/)
- `AudioContext.getOutputTimestamp()` returns `contextTime` (the position being output, on the `currentTime` clock) and `performanceTime` (when that sample reaches the speakers, on the `performance.now()` clock). MDN's example drives a `requestAnimationFrame` loop from it. It has been broadly available since April 2021. — [MDN, getOutputTimestamp](https://developer.mozilla.org/docs/Web/API/AudioContext/getOutputTimestamp)
- After iOS 15.1, Safari returned unreliable `contextTime` (far smaller than `currentTime`) for at least one developer. — [Apple Developer Forums thread 696356](https://developer.apple.com/forums/thread/696356)
- Drawing in rAF requires knowing how `currentTime` relates to frame time and output latency. — [W3C public-audio list, 2013](https://lists.w3.org/Archives/Public/public-audio/2013JanMar/0189.html)
- Material 3 Expressive motion is described in third-party specs as spring tokens (stiffness, damping, mass) instead of durations, enabling interruptible, chainable motion (secondary source). — [Koder DS, motion physics](https://kds.koder.dev/es-ES/reference/themes-motion-physics.html)
- Liquid Glass critics say adaptive light/dark flipping of controls over content adds distraction. Apple's Reduce Transparency setting makes glass more opaque. — [Pixel Envy](https://pxlnv.com/blog/on-liquid-glass/); [MobileSyrup](https://mobilesyrup.com/2025/06/10/how-apple-is-making-sure-liquid-glass-as-legible-as-possible/)

### Inferences
- **Playhead:** Render the playhead and active-note highlights on a dedicated canvas or compositor layer, moved with `transform` and no layout or paint of the lanes per frame. Compute position from `getOutputTimestamp()` (contextTime plus elapsed since performanceTime) with a `currentTime` fallback where Safari misbehaves. This sits alongside Splitune's AudioWorklet engine.
- **Scrolling vs paging:** Offer (a) continuous scroll with a fixed playhead for the timeline and waveform, and (b) a "page-turn" mode for chords and tab on the stand view: the cursor moves within a system and the view jumps a system or page at a time, like Soundslice's notes lighting up in place. With `prefers-reduced-motion`, default to (b) and replace smooth jumps with instant ones.
- **Meters:** Fast attack with visible peak-hold is a readability feature (Live 12), but in practice mode meters are secondary. Offer a compact or no-meter layout, and never animate decorative glows or pulses on the beat unless the user turns on a visual metronome.
- **UI transitions** (sheets, panel docking, selection) can use short spring or ease-out motion (about 150–250 ms). Loop-region changes should snap visibly to bars, using motion to confirm the snap, not to decorate.

### Gaps
- No primary source fetched for `prefers-reduced-motion` or WCAG 2.2 SC 2.3.3 (Animation from Interactions) and 2.2.2 (Pause, Stop, Hide); the W3C pages returned 403. They should be cited from w3.org or MDN directly.
- No source found describing how specific DAWs (Live, Logic) implement playhead follow and scroll modes. The paging recommendation is an inference drawn partly from notation players.

## 6. Waveform and timeline rendering conventions

### Takeaway
The useful conventions are a filled, mirrored waveform with RMS (body) and peak (outline or lighter) layers, optional frequency-coloured views (DJ-style 3-band), a bar ruler dominant over beat ticks, and loops shown as a tinted region with draggable edges. For a practice tool the waveform is navigation and context, and the musical lanes (chords, tab, sections) carry the meaning.

### Cited Findings
- Rekordbox 6 offers three waveform modes: blue, RGB and 3-band, where 3-band splits the waveform into lows, mids and highs (search summary). — [Elephorm, Rekordbox 6 waveform modes](https://www.elephorm.com/formation/maitriser-rekordbox-6/comprendre-les-differents-modes-daffichage-de-la-waveform-dans-rekordbox-6)
- DJ users want frequency-coloured (RGB) waveforms as in Serato and Rekordbox, and ask for them in other tools. — [DJ.Studio feedback](https://feedback.dj.studio/p/colored-waveforms-option-rgb-spectrum-like-seratorekordbox); [VirtualDJ forum](https://virtualdj.com/forums/259824/General_Discussion/I_truly_hope_that_Virtual_DJ_will_update_with_new_waveform_styles..html)
- WaveLab can overlay an RMS loudness view on the waveform or Rainbow view, with adjustable transparency. — [Steinberg WaveLab 12, Loudness overlay](https://steinberg.help/wavelab_pro/v12/en/wavelab/topics/audio_files_editing/loudness_overlay_c.html)
- FL Studio's Wave Candy computes RMS over a 300 ms moving window to smooth transient peaks. — [Image-Line, Wave Candy](https://www.image-line.com/fl-studio-learning-content/fl-studio-online-manual/html/plugins/Wave%20Candy.htm)
- Audacity offers "Show RMS in Waveform", and a user complained when an update made the waveform a solid colour (search summary). — [Audacity forum](https://forum.audacityteam.org/t/waveform-is-now-a-solid-colour-after-update/117776)
- Soundslice treats notation as the timeline: click a note to seek, drag across notes to loop, drag loop edges to resize. — [Soundslice features](https://soundslice.com/features/)
- Moises added a waveform view to the iPad player "for practice precision" (search summary). — [Moises releases](https://moises.ai/blog/moises-news/improvements-latest-releases)

### Inferences
- **Waveform style:** A mirrored, filled waveform in two tones of the stem's hue: an RMS body at the solid step and peaks at a lighter, lower-alpha step, drawn on a neutral lane. A "mixed" overview shows the summed mix in neutral. Per-stem lanes use stem colour at equal OKLCH lightness. A DJ-style 3-band colouring could be an optional analysis view, but it clashes with stem colour coding, so it should not be the default.
- **Grid hierarchy:** Section bands (Intro / Verse / Chorus, labelled) above a bar ruler (bar numbers in tabular figures, strongest lines), with beat ticks subordinate (lighter, shorter) and sub-beats only at zoom. Downbeats can thicken. Low-confidence beats or bars are marked with dashed lines or a hatch pattern plus a tooltip, never by colour alone.
- **Loop region:** A tinted overlay spanning all lanes with strong bar-snapped handles that are keyboard- and pedal-adjustable. Outside the loop, slightly dim the lanes (reduce contrast, not hue) so the loop reads at a glance from the stand.
- **Playhead:** A 2 px line in a reserved colour with a small head on the ruler, plus a faint "now" highlight on the active chord and tab beat, so it stays findable at distance.
- **Precompute peaks** server-side (finalize stage) at several resolutions for zoom levels, so the browser never decodes full audio to draw overviews.

### Gaps
- No fetched source documents DAW conventions for beat-grid weights, bar-ruler design, section-marker styling or loop shading (Live, Logic, Bitwig). These recommendations are synthesised from general practice and should be validated against screenshots and the products themselves.
- No source on the perceptual effectiveness of RMS+peak vs plain peak waveforms for musicians.

## 7. Design systems worth borrowing from for a web pro tool in 2026

### Takeaway
Splitune already uses Base UI (`@base-ui/react` 1.9.0) and Tailwind 4.3. That matches where the ecosystem moved: Base UI reached 1.0 in December 2025, and shadcn/ui made it the default primitive layer in mid-2026 while keeping Radix supported. React Aria remains the most complete and accessibility- and i18n-rigorous option (50+ components incl. date and colour pickers), at the cost of a different API. Radix Colors' 12-step semantics are worth borrowing for token roles regardless of the component library.

### Cited Findings
- Base UI v1.0.0 (11 December 2025) renamed the package to `@base-ui/react` and ships 35 accessible components. — [InfoQ, Base UI v1](https://infoq.com/news/2026/02/baseui-v1-accessible/); [LavX News](https://news.lavx.hu/article/mui-releases-base-ui-1-with-35-accessible-components)
- React Aria has 50+ components, including six date and seven colour components, which Base UI lacks. It has been stable since 2023 and Adobe's products depend on it. A Base UI maintainer says React Aria has "quite a different API", and others note its many context providers make mixing with other libraries hard (vendor-style comparison). — [Untitled UI, Base UI vs React Aria](https://www.untitledui.com/blog/base-ui-vs-react-aria)
- shadcn/ui made Base UI the default for new projects (reported from 3 July 2026) while keeping Radix fully supported. Components ship for both (secondary summaries; the official changelog was not opened). Base UI was reported at 1.8.0 in September 2026. — [HextaUI, shadcn Base UI vs Radix](https://hextaui.com/blog/shadcn-base-ui-vs-radix); [PkgPulse 2026 guide](https://www.pkgpulse.com/guides/shadcn-ui-vs-base-ui-vs-radix-components-2026); [shadcnblocks changelog](https://www.shadcnblocks.com/changelog/new-feature-base-ui-support)
- Radix Colors' role-based 12-step scale comes with APCA text guarantees (Lc 60 and 90). — [Radix Colors](https://www.radix-ui.com/colors/docs/palette-composition/understanding-the-scale)
- Repo check (local): `apps/web/package.json` has `@base-ui/react` 1.9.0 and `tailwindcss` 4.3.3, which is newer than the 1.8.0 reported in September 2026.

### Inferences
- **Keep Base UI as the primitive layer.** It is current and stable, matches shadcn's direction and is already integrated. Re-skinning is a token and style problem, not a library swap.
- **Borrow selectively from React Aria** for components Base UI lacks that a practice tool may need: number fields with locale-aware formatting, colour pickers for custom stem colours, and drag-and-drop or `useMove`-style hooks for loop handles. Wrap them in Splitune's `app/ui` so the design system stays single-sourced. Beware the mixing friction noted above.
- **Borrow Radix Colors' role semantics** (bg, component bg ×3, borders ×3, solids ×2, text ×2) as the token naming skeleton, generated in OKLCH by Splitune's own generator (base, accent, contrast, warmth).
- **Custom components a pro tool needs** that no headless library provides: timeline and lanes, transport, loop handles, stem strip, meters, chord grid. These are the core of the design system and need their own state stories (Storybook + axe, per repo rules).

### Gaps
- Ark UI not researched. Radix Primitives' maintenance cadence in 2026 is unverified beyond shadcn's continued support.
- The official shadcn changelog and Base UI release notes were not opened. The dates and versions above come from secondary summaries plus the local package.json.

## 8. Three distinct, coherent visual directions for Splitune

### Takeaway
Three coherent options: **A. "Night Studio"** (dark, content-coloured, DAW-adjacent), **B. "Paper Score"** (light, ink-on-paper, notation-first) and **C. "Stage Instrument"** (high-contrast, hardware-inspired, big-numeral glanceability). B is the most distinctive and the most legible on a stand in daylight, A suits long dim-room sessions, and C has the strongest glance reading at distance. Because every leading tool now offers appearance parameters, the realistic choice is one brand direction whose token generator also yields the other luminance mode. These are inferences built on the cited findings above.

### Cited Findings
- Bright-room demand is real: high-luminance Live 12 theme packs are sold specifically for bright rooms. — [Isotonik](https://isotonikstudios.com/product/infra-light-theme-by-deafman-skws/)
- Dark-mode options are expected in practice apps (Songsterr 10.0.1 added dark mode), and big chord letters are a practice-app pattern (Moises). — [Songsterr App Store](https://apps.apple.com/us/app/songsterr-tabs-chords/id399211291); [Moises ADA](https://moises.ai/blog/moises-news/apple-design-awards-nomination)
- Hardware-display aesthetics read as distinctive (TE EP-133 "unique vibe", LCARS-like) but leave little room for added information. — [Sound On Sound EP-133](https://www.soundonsound.com/reviews/teenage-engineering-ep-133-ko-ii?amp); [Elektronauts](https://www.elektronauts.com/t/teenage-engineering-ep-133-k-o-ii/203660?page=75)
- Translucent, content-dependent surfaces drew legibility criticism (Liquid Glass). — [Infinum](https://infinum.com/blog/apples-ios-26-liquid-glass-sleek-shiny-and-questionably-accessible/)
- Theme-from-few-inputs generation (LCH base, accent, contrast) makes variants cheap. — [Linear](https://linear.app/now/how-we-redesigned-the-linear-ui)
- The repo already has a "Music Stand" design system (docs 26–28) with Inter, Atkinson Hyperlegible Next and OKLCH primitives (local check of `packages/ui-tokens`).

### Inferences
**A. Night Studio (dark studio)**
- *Look:* Near-black, slightly warm or neutral surfaces (OKLCH L≈0.16–0.22, very low chroma). Chrome is neutral and stems carry colour (Okabe-Ito/Tol hues at high L). One reserved accent for playhead and selection. Inter with tabular figures. Thin dividers instead of boxes. Live-12-style density on desktop.
- *Pros:* Comfortable for long evening sessions and dim rooms. Waveforms and stem colours pop, and the categorical palette passes 3:1 easily (see section 3 table). Familiar to DAW users, which lowers the learning cost.
- *Cons:* Tablets on a stand in daylight show reflections, and dark UIs wash out. Notation (traditionally black on white) inverted to light-on-dark is less familiar to readers. Low brand distinctiveness, since it looks like every DAW plus Moises.
- *Stand legibility:* Good in dim light, weaker in daylight. Needs the high-contrast parameter.

**B. Paper Score (paper / editorial)**
- *Look:* Warm off-white "paper" (OKLCH L≈0.96–0.98, low chroma, warm hue), ink-black notation and chord symbols set like a lead sheet (SMuFL font, proper ♯ ♭ ° ø △), with restrained colour: stems as darker, ink-like hues (lower L), shown as margin strips and lane tints, not big fills. Typographic hierarchy does most of the work (large chord letters, bar numbers in tabular figures). Opaque surfaces, no glass. A matching "Night Paper" mode (dim warm gray, not pure black) from the same generator.
- *Pros:* Best fit for reading chords and tab on a music stand in normal room light, and closest to how learners already read sheet music and tab (Soundslice-like notation-first). Distinctive against the sea of dark DAWs and Moises. Calm for long sessions, and colour is reserved for meaning.
- *Cons:* Bright at night unless Night Paper is good. Okabe-Ito hues need darkening on paper (four of seven fail 3:1 on #F5F1E8, see section 3), which narrows the stem palette's range. Waveforms look less dramatic. Risk of feeling "academic" without a strong accent.
- *Stand legibility:* Best overall. Long sessions: good, if Night Paper and a warmth control exist.

**C. Stage Instrument (hardware / console)**
- *Look:* Bold, flat, high-contrast blocks. Segment- or mono-style numerals for bar, tempo and loop readouts (tabular figures at display size). Large touch and pedal targets. Stems as solid colour keys or "pads". Transport styled like hardware buttons with clear on/off states, and generous spacing. Inspired by hardware principles (glance-first readouts, physical states) without copying TE's proprietary look.
- *Pros:* Strongest glanceability at 60–100 cm. Natural fit for pedal control and the stand view. High brand distinctiveness and personality.
- *Cons:* Novelty can tire over long sessions. The density ceiling makes it hard to fit mixer, lanes and inspector on desktop. Bold colour blocks compete with notation. Risk of reading as derivative of TE or LCARS. Accessibility of colour-block states needs care (shape and label, not colour only).
- *Stand legibility:* Excellent for readouts, mixed for notation. Long sessions: weaker.

**Synthesis for the decision (my recommendation, an inference):**
- Choose B (Paper Score) as the brand direction and light default for practice. Notation, chords and tab are the product's core, and the stand-in-daylight case favours it.
- Use the same token generator for a first-class dark mode (A's qualities), selectable and OS-following, as Live 12 does.
- Borrow C's ideas only as a layout mode ("Stand view": big tabular numerals, giant transport, pedal hints), not as the visual language.
- This keeps one coherent identity while covering dim rooms and distance reading. Validate with stand-distance tests on iPad portrait and landscape and a laptop at about 80 cm, in daylight and at night.

### Gaps
- No user research on Splitune's own audience (lighting conditions, devices, session lengths) was available. The direction choice should be validated with quick prototypes of all three on a real stand.
- No empirical source compared light vs dark UIs for sheet-music or tab reading at distance. The legibility rankings above are reasoned, not measured.
