---
title: Screens, flows and content design
workstream: engineering
last_researched: 2026-11-08
confidence: medium
---

# Screens, flows and content design

What every screen contains, how it is laid out per device, which states it has, and the words it uses, for the "Night Rehearsal" redesign. Tokens and components come from `26-design-system.md`; practice behaviour stays in `12-practice-screen-and-notation.md`; import mechanics in `13-import-onboarding-and-youtube-embed.md` (+ `25` §4 for URL import); plan rules in `23-plans-free-and-paid.md` §5; v1 features in `21-v1-features.md`. Where those docs and this one disagree on **layout, states or copy**, this doc wins; on behaviour, they win.

Rewritten in place in step s31a (2026-11-08) from `redesign/` (report, mockups, `research/product_inventory.md`). Section numbers are unchanged, so code comments citing "27 §3.7.3" still point at the same topic. The Music Stand version is in git (`git show 8d6a3f6:docs/specs/27-screens-flows-and-content.md`).

**Mockups.** Every screen below names its mockup in `redesign/mockups/` (rendered at 1440 / 1180 / 390 in both themes by `scripts/redesign`, step s31c). Visuals follow the mockups (and `26` §4.9 where the design system corrects them); behaviour follows `redesign/report.md` and the behaviour docs. Strings shown in a mockup for a situation the app already has are adopted as that situation's copy and listed in §5.7 as changes; strings in mockups that are sample data (song titles, artists, numbers) are not copy.

## TL;DR
- **Shell:** a top app bar with the wordmark, Library, Settings, a search button that opens the **⌘K / Ctrl K command palette**, the allowance meter and a global **Add song** (primary). Phones move Library · Add song · Settings to a bottom bar. Files can be dropped anywhere in the app.
- **Add song** replaces the Import page: a dialog on desktop and a full-screen sheet on phones (File / Link / Record), with Title and Artist fields. `/import` opens the dialog.
- **Practice opens at once and fills in by stage**: every finished stage leaves a real artefact and unlocks something, starting with loops and slow-down on the original audio (§3.7.3).
- **Practice layout:** song map (sections, waveform, loop band, now-line) · Now column (current and next chord, beat pulse) · notation · inspector with **Loop / Mix / Progress / Fix** · transport dock, with a pass prompt after each pass. Tablets get **Stand view**; phones get the glance view and a **Tools** sheet.
- **Settings = Account · Display & practice · Keyboard & pedal · About**, with a pedal setup wizard.
- **Keys:** speed is `,` / `.` (Shift = 1 %); ↑/↓ never change speed; single-key shortcuts can be switched off.
- **Voice:** a calm coach; uncertainty in frequencies ("about 1 in 3"); no streaks. The message catalogue (§5.6) and the change list (§5.7) are the copy source; §5.7 marks every string whose test expectation changes by design.

## 1. Information architecture
```mermaid
flowchart LR
  subgraph Marketing[Marketing shell]
    H[/ Home] --- HW[/how-it-works] --- PR[/pricing] --- LG[/legal/*]
  end
  subgraph Focus[Focus shell]
    ST[/start onboarding] --> P[/songs/$id/practice]
    P --> ED[/songs/$id/edit desktop]
  end
  subgraph App[App shell]
    LIB[/library] -. Add song dialog .-> P
    SET[/settings/account · display · keyboard · about]
    CMD{{⌘K palette}}
  end
  subgraph Auth[Auth shell]
    AU[/auth/sign-in · sign-up]
  end
  subgraph Bare[Bare shell]
    MC[/billing/$view] --- SYS[unsupported · account-deleted · 404 · error]
  end
  H -->|Try an example song| ST
  H -->|Sign in| AU
  AU --> LIB
  CMD --> P
```

| Shell | Top area | Navigation | Mockup |
|---|---|---|---|
| Marketing | 64 px bar: wordmark · How it works · Pricing · Sign in · **Try an example song** (primary) | Phone: wordmark + Menu; footer links (How it works, Pricing, Terms, Privacy) | `Home.dc.html`, `Pricing.dc.html` |
| App | 64 px bar: wordmark (→ Library) · Library · Settings · search button "Search songs, clips and actions" + `Ctrl K`/`⌘ K` (from `lg`; an icon below) · allowance meter (from `lg`) · **Add song** (primary) · account avatar (initials, 40 px circle) | Phone: 56 px header (page title, search icon, avatar) + 76 px bottom bar **Library · Add song · Settings** | `Library.dc.html`, `Settings-*.dc.html`, `Phone-Library.dc.html` |
| Focus | Practice: 60 px top bar (§3.7.1). Onboarding: 64 px bar with Back · step dots + "Step n of 5" · Skip | None; ⌘K still works when signed in | `Main.dc.html`, `Onboarding.dc.html` |
| Auth | Wordmark; form column (400 px) beside the showcase panel from `lg` | — | `SignIn.dc.html` |
| Bare | Wordmark only; centred column (480 px) | — | — |

- Every top bar is sticky. The app shell accepts a file dropped anywhere ("Drop to add" overlay) and opens Add song with it.
- **Account menu** (avatar): the username (email for a Google-only account) · Settings · Keyboard & pedal · Appearance (Night Rehearsal / Daylight / Follow my device) · Help (How it works, Pricing, Terms, Privacy) · Sign out.
- **Command palette** (§3.12) opens from the search button, ⌘K / Ctrl K anywhere in the app and focus shells, and a button on touch screens.

**Route map**
| Before | After | Notes |
|---|---|---|
| `/library` | `/library` | Adds the Continue card, This week, Worth a revisit; keeps toolbar and URL state. `?add=file|link|record` opens Add song |
| `/import`, `/import?tab=record` | Redirect to `/library?add=file` / `?add=record` | The dialog opens over the library (sheet on phones) |
| `/songs/$id/practice` | same | New `?tab=loop|mix|progress|fix`; keeps `?view`, `?loop`, `?speed` (25–110), `?mix`, `?level` |
| `/songs/$id/edit` | same | Desktop full editor, reached from Fix → "Open full editor" |
| `/settings` → `/settings/profile` | `/settings` → `/settings/account` | |
| `/settings/profile`, `/settings/billing`, `/settings/privacy` | Redirect to `/settings/account#profile`, `#plan`, `#privacy` (query kept: `?checkout=success|cancelled`, `?confirm=delete`) | Account holds Profile, Plan, Privacy, Sign out |
| `/settings/display`, `/settings/keyboard` | same | Display & practice; Keyboard & pedal |
| — | `/settings/about` | New |
| `/start`, `/start/saved`, `/auth/*`, `/billing/$view`, `/unsupported`, `/account-deleted`, 404, error | same | Restyled |

## 2. Key flows (happy paths and where they branch)
| Flow | Steps | Target | Branches |
|---|---|---|---|
| First session | Home → `/start` instrument → level → **Where's your screen?** (reading test) → example plays → loop at 70 % → Felt clean → "Save your progress?" | First slowed loop ≤ 5 min, no account | Skip to "Add my own song" at any step |
| Come back | Open the app → Library → **Resume practice** on the Continue card | First audible pass < 10 s after opening (report) | No progress yet: the most recent song |
| Add a file | Add song (button, ⌘K, or drop) → file → part + analysis → **Start practising** → Practice opens with local playback while upload and analysis continue | Playable ≤ 5 s after the pick | Warning badge, duplicate ("Open it"), cap reached, offline queue |
| Add a link | Add song → Link → paste → part + analysis → Practice opens; first stage "Downloading" | — | Unsupported or failed link → upload instead (`25` §4) |
| Record | Add song → Record → permission → level + count-in → record → **Use this recording** | — | Permission denied |
| Practise | Practice → tap two bars (or a section chip, or "Loop this bar") → speed −/+ → play → rate each pass (C / N, or a held pedal) | Loop made in ≤ 2 actions, median < 3 s; every action confirmed ≤ 100 ms | Ladder on: speed steps up after clean passes |
| Fix an unsure spot | Fix tab (or E, or tap a "?") → J / K through spots → hear an alternative over the loop → **Use** (or "It's right") | ≤ 2 taps to an alternative | Offline: queued edits |
| Set up a pedal | ↑/↓ before setup → PedalHud "Pedal detected? Set it up" → wizard: left, right, choose what they do → test area | A pair in < 30 s | One pedal only |
| Get notified | Getting ready card → **Notify me when it's ready** → browser permission (on that click only) | — | No Web Push (not installed on iOS): button hidden; toasts and title updates remain |
| Upgrade | Lock at the point of action → upgrade sheet → mock checkout → back with Plus | 3 screens | Declined (simulated) |

## 3. Screens
Each spec lists **mockup · purpose · layout · content · primary action · states · step**. Sizes are CSS px (`26` §8); copy keys are in §5.6–§5.7.

### 3.1 Home `/` (marketing) — `Home.dc.html` · s36
- **Purpose:** the promise in one screen and the way to the example song.
- **Hero** (two columns, wrap under 980 px): badge "Free to try, no account needed" (primary badge); display headline **"Bring any song. Practise just your part."** (`text-display`, balanced); lead (19 px, muted) "Splitune pulls your instrument out of the mix, writes out the chords and tab, and loops any bar at any speed. Where it isn't sure of a note, it tells you."; **Try an example song** (primary, 56 px) + Sign in (secondary, 56 px); note "Guitar and bass today. Piano and drums are in early access." Right: an inert still of the practice screen (Now column with C, next G, beat dots; two bars of tab with the sounding digit, one unsure digit and the playhead; a pass-prompt row), built from the real kit components with fixture data, `role="img"` with the label "The practice screen, looping bars 25 to 28 at 75 percent".
- **What it does** (band on `--card`, three columns): "Hear your part on its own" (stem level bars), "Loop it slow, then climb" (speed ladder), "Tab that admits when it's unsure" (sure and unsure digits, alternatives "Am7 · about 1 in 3", "C/A · about 1 in 5").
- **Made for the music stand** (`text-3xl`, six items with icons): Hands stay on the strings · Readable from where you sit · A count-in that follows the band · Stand view for tablets · Works offline · Progress without nagging.
- **How a session goes** (four cards with amber-ink numbers 1–4): Bring a song · Pick your part · Loop the hard bars · Speed up as it gets clean.
- **Closing CTA:** "Free is a real practice app" + "Every practice tool is free. Plus adds more analyses each month." + Try an example song (primary) + See pricing.
- **Honesty gates** (the home page never promises what isn't built; report): until the step in brackets ships, the claim is replaced by the current wording in §5.7: "Every stem has its own fader." (s40b; until then "Turn your part up, mute it to play along, or hear the original."), the speed-ladder sentence (s37), "beat lights" (s42), "Stand view for tablets" (s43). Pricing has the same gates.
- **States:** static; LCP is the headline (≤ 2.5 s, `10` §9).

### 3.2 How it works, Pricing, Legal — `Pricing.dc.html` · s36
- **How it works** (no mockup): the existing page restyled on the new tokens; the four steps with stills built from the kit (no scroll-driven motion); the accuracy note uses frequency wording ("Most notes come out right; about 1 in 8 is marked unsure, so you know where to listen").
- **Pricing:** status banner across the top (`--accent` well) "Demo mode — no real charges. Payments are simulated."; centred title **"Every practice tool is free"** (`text-5xl`) + lead "Plus adds more full analyses each month: your part isolated, a mixer for every stem, and tab." (mixer phrase gated on s40b); two cards: **Free** ("A real practice app, not a trial.", "No charge", three checks, Try an example song) and **Plus** ("For learning a new song every week.", Monthly / Yearly segmented control with neither emphasised, price from the API, four checks, **Get Plus** primary, "Cancel anytime in one tap. Failed analyses never count."); **Compare** table (Feature · Free · Plus). No countdowns, no "most popular" badge, never a card field (`25` §2).
- **Legal:** 72 ch reading column, table of contents, last-updated date.

### 3.3 Onboarding `/start` (focus shell) — `Onboarding.dc.html` (step 3) · s36
Header: Back · step dots (done and current `--signal`, current a pill) + "Step n of 5" · Skip. Content column 1120 px.

| Step | Content | Primary | Notes |
|---|---|---|---|
| 1 Instrument | Large cards Guitar, Bass, Piano, Drums, Something else; Piano and Drums show "Coming soon — try guitar or bass" until they have example songs | Card tap | |
| 2 Level | Just started · A few songs · Coming back | Card tap | Sets defaults (`13` §1) |
| 3 **Where's your screen?** | Display title (48) + "We'll size chords and tab so you can read them from where you play. You can change this any time."; three radio cards with line drawings: **Desk** "Laptop or desktop, about half a metre away", **Music stand** "Tablet on a stand, about 75 cm away", **Floor** "Phone on the floor or a chair, a metre or more"; sample card "Can you read this from where you play?" / "Step back to your playing spot. If the numbers are hard to read, make them bigger." with the Reading size slider (80–140 %) and the live sample (chords Am and F at `--read-chord-sheet` × 1.6, tab "0 2 2 1 0" at `--read-tab`) | **Continue** (primary, 48) · Skip for now | Choosing applies the preset live; the slider's value becomes the Reading size |
| 4 Your first song | Example song card (title, part, length), **Play your part** | Play | Autoplay only after the tap |
| 5 Loop it | The practice screen with two coach marks at most: "We've looped bars 5–8 at 70 %. Play along." | — | Coach marks never cover the transport |
| 6 Save | After the first completed pass: sheet "Save your progress?" with the sign-up form; "Not now" keeps practising | Create account | Never mid-pass |

### 3.4 Auth `/auth/*` (auth shell) — `SignIn.dc.html` · s36
Username and password only (`25` §1).
- **Sign in:** h1 "Sign in" · "Welcome back. Enter your username and password." · Username · Password (error under the field with an icon: `auth.wrong_credentials`) · **Sign in** (primary, 48, full width) · "or" divider · Continue with Google (only when configured) · "New to Splitune? **Create an account**. No email needed." · "By continuing, you agree to our Terms and Privacy policy."
- **Create an account:** as today ("Pick a username and a password. No email needed.", hints, `auth.username_taken`), same layout.
- **Showcase** (from `lg`, `--card` panel): display (44) "Your loops, speeds and fixes stay with every song." · three points with check icons: "Pick up on the same bar, at the same speed, on any device." / "See how your clean speed grows on each clip." / "Chords and notes you correct are kept for good." · an inert sheet: chord Am, loop badge "Loop · bars 5–8 · pass 4", a four-rung speed ladder.
- Both continue at `?next=` (same-origin paths only).

### 3.5 Library `/library` (app shell, home) — `Library.dc.html`, `Phone-Library.dc.html`, `States.dc.html` (empty) · s34 (layout), s39 (progress data)
- **Desktop** (container 1260, padding 28/24/48, sections 28 apart):
  1. **Pick up where you left off** (card spanning two columns, `--muted` → `--card` diagonal gradient): eyebrow + "· yesterday, 24 min"; song title (h1); "{artist} · {part} · clip **{clip}**, bars 25–28"; badges: "Ladder at 75 % → 100 %" (primary), "Best clean 80 %", "Yesterday's first clean pass: 70 %"; a 30-day sparkline of the best clean speed (text alternative "Best clean speed rose from 60 to 80 percent over 9 sessions"); **Resume practice** (secondary, 56: Add song in the bar stays the view's one primary, 26 §4.5; owner, s34).
  2. **This week** card: seven day dots (filled amber with opacity by minutes, outlined when not practised; label "Practised on 4 of the last 7 days"), day letters, and three stats in mono: "1 h 20 practised", "23 clean passes", "+10 % on {clip}". No streak count, no missed-day wording.
  3. **Worth a revisit**: h3 + "Clips you haven't played for a while. A cold first pass shows what stuck."; rows (card): stem tile, clip name, "{song} · 6 days ago · best 65 %", chevron. Clips not played for 5 days or more with a best clean tempo, up to three.
  4. **Songs · {n}**: filter field "Filter by title" (220), instrument chips (All · Guitar · Bass · Piano · Drums · Vocals · Something else), sort/status menu button ("Last practised ▾": Sort by Last practised / Added / Title; Show All / Ready / Partial / Analysing / Failed), Grid/List segmented control; grid of `SongCard`s (`minmax(280px, 1fr)`). All filters stay in the URL; 24 per page with "Show more".
- **Song card:** stem tile ("Gt"), title (16/650, two lines max) + "{artist} · {part} · {length}"; More menu ("More for {title}": Rename, Analyse again / Analyse with stems + tab, Delete song); a 28 px waveform preview; status badge + meta line; while analysing a 4 px progress bar and "{stage} · about {n} min left". Badge and meta by state: Ready (success) "Practised yesterday · best 80 % on bars 25–28" · Analysing n/m (primary) "You can loop it already" · Queued "Processing machine offline. Starts automatically." · Partial "Chords and beat ready, stems used a backup model" (the reason) · Chords only "Add stems + tab with a Full analysis" · Failed (destructive) reason + "This didn't use an analysis." + Try again · Stems expired + Re-create stems · Uploading {pct} · Upload not finished. The whole card opens Practice.
- **Before s39** (no progress data yet): the Continue card shows the most recently opened song with its best clean tempo and that tempo's bars (from the songs list; the list carries no clip name, so the clip is left out), without the sparkline and the "first clean pass" badge; This week and Worth a revisit are hidden.
- **Phone:** header "Library" + search + avatar; a compact Continue card (song, "{clip} · bars 25–28 · ladder at 75 %", a 52 px round play link); a This week row (seven 22 px dots + total time); instrument chips (36 tall); list rows (tile, title, meta, badge, ≥ 60 px); bottom bar. Secondary actions in the More menu, no swipe gestures.
- **Header extras:** worker-offline banner when songs are queued.
- **States:** §4.

### 3.6 Add song (was Import) — `AddSong.dc.html`, `Phone-Add.dc.html` · s34
- **Container:** desktop Dialog (max 940, `rounded-4xl`) over the dimmed library; phone full-screen sheet with a 56 px header ("Add a song" + Close) and a 48 px tab row. Opens from Add song, ⌘K, `?add=`, `/import`, or a dropped file.
- **Tabs** File · Link · Record (with icons; the last one used is remembered).
- **File:** after a pick, a file card (`--muted`): file tile, name, "7.4 MB · 3:12" (mono), Remove; the waveform preview (44 px, local decode; "Preview after upload" over ~200 MB); warning badges that don't block ("Sounds like a live recording. Separation may be rougher.", quiet, distorted, mostly silent, speech) with a triangle icon; blocking errors inline (too long, too large, unreadable); the duplicate notice "You already have this song." with **Open it** / Add anyway. Then **Title** (prefilled from the file name) and **Artist (optional)** ("Who plays it"). Then a drop row: "Drop another file here, or **choose a file**" · "MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 min". Before a pick the drop zone fills the left column.
- **Link:** "Link to a video or song" (placeholder "https://"), Paste, "Also download the video" switch (on), hint "Works with YouTube and most video sites. Songs up to 20 minutes."
- **Record** (phone mockup): explainer before the browser prompt; then a card with the "Recording" badge (destructive dot), the mono timer (48), the Input level meter, an 84 px round Stop button (destructive outline), Count-in and Click switches; hint "Using a headset? Turn off its noise reduction for the cleanest take."; review with playback and Record again.
- **Right column / below:** **Your part**: six radio cards with a stem swatch (Guitar, Bass, Piano, Drums, Vocals, Something else), default from the profile; a **Hand** button (Right / Left; the profile's handedness). A **Tuning** button appears with V12 (tuning presets); until then it is not shown. **Analysis**: radio cards **Full** "Your part isolated, a mixer for every stem, plus tab. About 5 min." (mixer phrase gated on s40b; the minutes come from median stage times or are left out) with "Welcome · free" when unused, and **Lite** "Beat and chords, under a minute. No stems or tab." with "{left} of {limit} left". Phone: chips for the part and a two-item segmented control "Full · free once" / "Lite · {left} left".
- **Footer:** "It opens right away. Loops and slow-down work while we analyse." · Cancel · **Start practising** (primary, 48; "Use this recording" on Record, "Add and analyse" on Link).
- **"Works best with / Has trouble with"** (report; not in a mockup): a disclosure link in the footer text row opening a popover: works best with studio recordings, one guitar or bass part, steady tempo; has trouble with live recordings, heavy distortion, several guitars, speech over music. s34 places it with the owner's check at G4.
- **States:** cap reached on the chosen type (inline lock with the exact limit and reset date + See Plus; Lite still offered), Welcome available ("Your first full analysis is free — your part isolated, plus tab." · Use it now), offline (queues), unsupported or too long, uploading continues in the background after the dialog closes (progress in the library card and practice status).

### 3.7 Practice `/songs/$songId/practice` (focus shell)
Behaviour per `12`; this section fixes regions, sizes, states and copy. Steps: s35 (core), s37 (Loop/ladder), s38 (Fix), s39 (Progress), s40b (Mix), s41b (sections), s42 (beat pulse), s43 (phone, Stand view, pedal wizard).

#### 3.7.1 Regions (desktop, fine pointer, ≥ 1180 px) — `Main.dc.html`
```
┌ Top bar 60 ─────────────────────────────────────────────────────────────────────────────┐
│ ‹ Library │ Title / "Artist · Guitar · A minor · 96 BPM"   [Tab|Notes|Chords]   (? Auto-transcribed · 6 unsure) Aa ⌨ ⋯ │
├ Song map ───────────────────────────────────────────────────────────────────────────────┤
│ [Intro][Verse 1][Pre][Chorus]…  section chips (22)                                      │
│ ▁▂▅▇▅▂ waveform 40 · loop band · unsure hatch · now-line                               │
│ 1    9    17    25 …  ruler 14                                                          │
├ Now 264 ─────┬ Notation (flex) ───────────────────────────────┬ Inspector 380 ───────────┤
│ NOW · BAR 26 │ ⌐ Loop · bars 25–28 · pass 2 of 2 at 75 % ¬    │ Loop  Mix  Progress  Fix 6│
│ C  [shape]   │ TAB  F        C         G         Am?           │                           │
│ ■ ● ◉ ○      │      bars with rhythm stems, playhead, ? marks   │  (active tab)             │
│ NEXT · in 2  │                                                  │                           │
│ G   bar 27   │   [ Pass 2 at 75 % — how was it?  Felt clean C · Not yet N ]                 │
│ THEN Am? F C │                                                  │                           │
│ Level · Capo │                                                  │                           │
├ Transport dock 96 ──────────────────────────────────────────────────────────────────────┤
│ ⏮ ▶ ⏭  26.3 / 92 · 1:04 / 3:50 │ [Loop · bars 25–28 / pass 2 · rest 1 beat]  − 75 % · 72 BPM · → 100 +    ⏱ 𝄐 [Your part loud / 5 stems · click on] 🔊━━ │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
- **Top bar (60):** "‹ Library" (ghost sm; "Exit" for visitors) · divider · title (16/650) over the part line (13, muted): "{artist} · {part} · {key} · {bpm} BPM" (key spelled in the song's own key; "key after chords" while unknown) · centred **view switch** (segmented; per instrument §3.7.5; shown once a notation and chords both exist) · **legend chip** (dashed: "?" in `--unsure` + "Auto-transcribed · {n} unsure") · Display ("Display and reading", icon `Aa`) · Keyboard & pedal (icon) · More (⋯: Keyboard shortcuts, Open full editor (desktop, signed in), Keyboard & pedal settings, Save offline (V10), Export (V11, when built)).
- **Song map:** section chips (s41b; tap loops that section; current section on = amber wash; absent when there are no sections, never fake chips), the overview (your part's waveform, or the song's before stems; unplayed / played / in-loop bars; unsure hatch; loop band with draggable 2 px edges and keyboard nudging; now-line), the ruler (bar numbers every 8 bars; seconds before the beat is known). Tap seeks to the bar's start. Zoom stays off.
- **Now column (264):** "Now · bar 26 · beat 3" (eyebrow); the current chord at `--read-chord-current` with its shape diagram (84 × 110; mirrored for left-handed players; piano: a voicing keyboard; drums: the bar.beat counter "2 e &"); `BeatPulse` (static until s42); divider; "Next · in 2 beats" + next chord at `--read-chord-next` + "bar 27"; "Then" + up to five chips (unsure ones dashed "Am ?"); at the bottom a card with two rows, **Level** "As played ▾" and **Capo** "None · standard tuning ▾" (guitar only; bass and drums show Level only). "No chord" shows "N.C.".
- **Notation canvas:** systems of four bars (Page mode), 92 px apart; TAB clef; bar numbers, chord names over the bars, rhythm stems and beams under the tab (always), the current-bar wash, the sounding digit, the playhead, the loop wash and the loop bracket over the looped system with its badge "Loop · bars 25–28 · pass 2 of 2 at 75 %"; bottom-left key "3 unsure · 0 sounding" (samples of the marks). Tap two bars to loop them (tap the same bar twice for one bar).
- **Pass prompt:** a floating sheet centred 20 px above the dock, only after a pass while a loop is active and "Ask how each pass went" is on: "Pass {n} at {speed} — how was it?" · **Felt clean** (primary, check icon, `C`) · Not yet (`N`), both 64 tall (`26` §8; the mockup draws 40). It never covers the focused element (2.4.11) and leaves with the next pass.
- **Inspector (380):** tabs Loop · Mix · Progress · Fix (badge with the unsure count) (§3.7.4). Remembers the last tab per device; `?tab=` opens one.
- **Transport dock (96, `--card`):** the main practice controls are 64 × 64 (`26` §8; the mockup draws 52): Restart ("Restart loop" while looping, else "Back a bar") · **Play/Pause** (64, amber) · Next bar · position (mono 22 "26.3" + faint "/ 92", 13 "1:04 / 3:50"; tap toggles bar.beat ↔ time) · divider · loop pill (64 tall, "Loop · bars 25–28" / "pass 2 · rest 1 beat"; off "No loop" / "tap two bars, or a section"; opens Loop) · speed group (boxed − 64, readout "75 %" / "72 BPM · → 100" (ladder goal) opening the speed panel, boxed + 64) · spacer · Count-in (64, on = amber wash; "Count-in, 1 bar, on") · Click (metronome, 52; secondary, `26` §8) · mix preset pill (52) ("Your part loud" / "5 stems · click on"; opens Mix) · volume (slider 150 + icon; below 1280 px the mix pill shows only its icon and volume moves into a popover). Disabled controls say why ("Mix" / "after your part is isolated").
- **Region behaviour by width (fine pointer):** ≥ 1180 all five regions; 1024–1179 the inspector becomes a right drawer opened by a "Tools" button in the top bar (and by the loop pill / mix pill); < 1024 the Now column becomes a 72 px strip above the notation (current chord, beats, next chord) as well.
- `PedalHud` sits at the notation's top right (§3.7.4).

#### 3.7.2 Other layouts
| Layout | When | Arrangement | Mockup |
|---|---|---|---|
| **Stand view** | Coarse pointer, shortest side > 640 (tablets): **the default practice layout on tablets** (owner decision D4, G1); also a choice in ⋯ on desktop | Header 64 (back, title 18, loop badge, "Pedal connected" badge when a pedal is set up, speed readout 28, Display) · Now panel 400 (eyebrow 14, chord 200 + shape, beats 26, next 100) · one tab system that always fits on screen (tab and chords at the resolved preset: 36 / 40 at Music stand; the mockup's 26 / 28 are V15) with "Page 7 of 46 · turns on the downbeat of bar 28" · dock 120 with four 88 px buttons: Restart loop / "Left pedal", **Pause** (primary) / "Right pedal", Felt clean / "Hold right pedal", Not yet / "Hold left pedal" (hints follow the learned mapping). Portrait stacks two systems and turns half a page; landscape shows a slice of the next bar at the right edge. ⋯ → "All tools" switches to the full layout (inspector in a drawer) | `Stand.dc.html` |
| Phone portrait (**glance**) | Coarse, ≤ 640 wide | Header 56 (back 44, title + "Guitar · A minor", Display 44) · overview map 30 + view switch **Glance · Tab · Chords** (38) · Now (Floor preset by default): eyebrow and bar.beat at the Floor reading sizes (24 / 40; the mockup's 12 is V15), chord 150 at 390 + shape, beats 20, divider, "Next · in 2 beats" + 64 chord + "Then" chips (at `--read-chord`, as many whole chips as fit, on their own row when needed; `26` §6.3 phone fit rule; the Tab view uses the same rule's tab sizing) · pass prompt card (two 64 px buttons; mockup 48) · transport: loop button "Bars 25–28 · pass 2" (64 tall, amber wash) + speed − / "75 %" / + (64; mockup 44); Restart (64) · **Play 72** · Next bar (64) · **Tools** (52) | `Phone-Practice.dc.html` |
| Phone **Tools** sheet | Tools button | Bottom sheet (690 of 844, grabber, "Tools" + Close 44): **Speed** (− 64 / "75 %" mono 30 + "72 BPM" / + 64, mockup 52; chips 50 · 75 · 85 · 100; Speed ladder card with switch "+{step} % after {n} clean passes, up to {goal} %"); three 76 px tiles **Count-in 1 bar** · **Click on** · **Vibrate on beat** (pressed = amber wash); **Mix**: preset chips, rows "Guitar · your part" and "Band" with a fader and an M painted 44 in a 48 box, link "All 5 stems" (opens the Mix tab as a sheet); **Level** / **Capo** buttons (48). Every control steps; nothing needs a drag. Lazy-loaded | `Phone-Tools.dc.html` |
| Phone landscape | Coarse, ≤ 640 tall | 48 px header; one tab system sized and scrolled by the phone fit rule (`26` §6.3: digits fit the box height, never below 18 px; the strip scrolls by bar, only when the next bar would leave the view); compact 32 px ruler with the loop band; one transport row of 64 px controls | — |
| Desktop narrow | Fine pointer < 1180 | See §3.7.1 region behaviour | — |
| With video (URL import) | The song has a downloaded video | Floating player over the notation's bottom-right, closed by default, opened from ⋯ (Larger / Smaller / Hide) | — |
| `stage` appearance | Stored `stage` | The layout of the device at no less than Music-stand sizes (`26` §2) | — |

#### 3.7.3 Progressive states (`13` §4) — `Practice-Ready.dc.html`
Practice opens as soon as local playback works. Every finished stage leaves a real artefact and unlocks something; nothing is faked.

| Stage (label) | Artefact shown | Unlocks |
|---|---|---|
| Local upload, or "Downloading" (link) | Waveform from the local file | Play, speed, time-based loops |
| "Reading the audio" | Duration, channels, "sounds like a studio recording" | — |
| "Finding the beat" | "84 BPM in 4/4, starts on a pickup bar"; bar ruler; beat grid | Bar loops, count-in, click, beat pulse |
| "Listening for instruments" | "Guitar, bass, drums, vocals" and the part question | Change the part before separation |
| "Isolating your part", "Preparing the stems" | Separating detail, then stem waveforms | Mix tab and presets |
| "Working out the chords" | Chords, key, sections (when scheduled) | Now column, Chords view, Level & capo, section chips |
| "Transcribing your part", "Building the tab" | "Every note, with how sure we are"; "Fingerings you can actually play" | Tab / Notes, Fix tab |

- **Getting ready card** (560 px `.sheet` centred over a faint empty staff while the notation is empty): h2 "Getting your part ready"; "You can practise already: the beat is found, so loops, slow-down and count-in work on the original song." (wording follows what is unlocked); "Analysing your song" + ETA "about 4 min left" over the overall bar (`role="progressbar"`, `aria-valuetext` = the running stage); the stage list (status dot, name, detail line, "Done" / "62 % · ~2 min" / "Waiting"); the part card (`--muted`): "We hear guitar, bass, drums and vocals." / "Is guitar the part you play?" with **Yes, guitar** (primary) and Pick another; **Notify me when it's ready** (secondary; s44, only where Web Push exists) and "Back to the library" (ghost).
- **What works now** card (300): rows with a state badge (Ready success · Soon primary · Later neutral) and "In about 2 min": Loop and slow down · Count-in and metronome · Mixer · Chords and sections · Tab.
- **Top bar while analysing:** primary badge with a spinner "Analysing 5 of 8 · about 4 min left" in place of the view switch; song map placeholder "Sections appear when the chords are ready" (only when sections are scheduled); dock Mix pill disabled "Mix" / "after your part is isolated".
- **ETA:** weighted by typical stage times (separation the largest share); a padded range when uncertain ("about 3–5 min"); it changes only when a stage finishes and never sits at 99 %; hidden if a remaining stage has no timing yet.
- **Arrivals** are announced quietly once ("Tab is ready — Show") and never re-lay out the notation under the playhead; the polite live region announces stage milestones only.
- **Piano and drums** fill in the same way (beats, stems, chords) and only the notes arrive last.
- **Failures:** soft-dependency failures leave a usable partial song with the reason in plain words and two choices (Retry · "Practise with chords"); a failed analysis shows the failure card (§3.11); "Processing machine offline. Your song is queued and starts automatically." appears once, with the next step, never as a stalled bar. Every stage can be cancelled from ⋯ ("Stop analysing").
- **Pick another** opens the part chooser and re-runs the analysis for the chosen part from separation on (the existing analysis route with the new instrument); s35 stops and reports if the API can't take a part for a re-run.

#### 3.7.4 Inspector tabs and overlays
- **Loop** (`Main.dc.html`; s35, ladder s37): heading "Bars 25–28" (h2) + section badge "Chorus"; **From bar** / **To bar** steppers (‹ 25 ›: one bar per step; "Earlier start", "Later start", "Earlier end", "Later end"); a row of small buttons **Next phrase** (shift by the loop's length), **×2**, **÷2**; "Fine-tune edges" disclosure with the ‹ › sixteenth-note nudges ("‹ › move that edge by a sixteenth note."). **Speed ladder** card (s37): icon, "Speed ladder", switch; the rungs (done rungs carry a 1 px `--signal` edge, `26` §12.3); defaults per `12` §5: up one step after **3** clean passes (owner decision D3, G1; the "clean passes" chip changes it), back down after 2 misses; summary "Up 5 % after {n} clean passes. Clean pass 2 of 2 at 75 % moves you to 80 %."; chips **Start 70 %**, **Goal 100 %**, **Step 5 %**, **{n} clean passes**, **More** (Back down after {n} misses · Count-in before each pass · At the goal: Keep looping / Stop), each opening a stepper. **Between repeats**: Rest (None · 1 beat · 1 bar), Count-in (Off · 1 bar · 2 bars), switch "Ask how each pass went before the next". **Saved clips**: "Save this loop" (ghost sm, name field), rows with Rename and Delete (s37). Before the beat is found: "Bar loops are ready once the beat is found." Clear loop at the bottom.
- **Mix** (`Practice-Mix.dc.html`; s35 with today's channels, s40b all stems): presets as a 2 × 2 radio grid: **Your part loud** "Learn it: {part} up, band down" · **Minus-one** "Play it: your part muted" · **Original** "The song as recorded" · **Rhythm only** "Bass and drums, nothing else" (only when both stems exist); stem rows in mixer order, "Your part" first with its badge, "Rough" badge where the separation is poor; **Helpers**: Click (level + switch), Hear the chords ("A soft synth plays what we transcribed"; s40b); Reset mix · "Use as default for {part}". Until s40a/s40b the rows are the stems that exist (your part, drums and bass when kept, "Band" for the mix-minus); the dock's mix pill counts only real stems. A limiter at unity: no preset pushes the master above 0 dBFS.
- **Progress** (`Practice-Piano.dc.html`; s39, lazy): eyebrow "Clip" + clip name (h2) + "bars 1–8 · left hand only"; card **Last 30 days** "speed of clean passes" with the chart (solid amber: best clean pass of the session; dashed: "First clean pass, cold: what really stuck") and its text alternative; three stat cards: "55 %" cold start today · "9 / 14" clean passes · "18 min" today; **Sessions** rows ("Today · 18 min · 14 passes · best 60 %"); a **Warm up with yesterday's hard bars** chip at the top on the first session after a day away (report; not in a mockup); **Weekly goal** switch "Optional. No streaks, no reminders unless you ask." With no clip selected: the song's clips with their best clean tempo.
- **Fix** (`Practice-Fix.dc.html`; s38): choosing the tab (or E, or tapping a "?") enters **Fix mode**: the top bar centre becomes an `--unsure-surface` pill "Fixing · every change saves as you go" + Undo + **Done** (primary); the song map shows only the overview, the hatch and the selection band (`--unsure-surface`); the notation washes the selected bars and rings the selected note; key line "3 Unsure: we'd guess wrong about 1 time in 3 · 7 Edited by you · J K next / previous unsure spot". The tab: **Spot 2 of 6 · bar 27–28** (h3) + progress in `--unsure` + previous/next; **chord card** ("Bar 28 · chord", Hear bar): the guess (40, dashed unsure) + "Our first guess. Wrong about 1 time in 3 for bars like this."; "Other likely chords": rows "Am7 · about 1 in 3" with "Hear Am7 over the loop" and **Use**; "Type a chord, e.g. Am7" + "Split at beat 3"; **note card** ("Bar 27 · note 4", Hear the tab): chip "D4 · string 2, fret 3 ?", "or play it as" + alternative chips, String and Fret steppers, **It's right**, Delete note, Report wrong; **beat fixes** "Metronome off the beat?" Half tempo · Double tempo · Move downbeat (after a fix, "Re-barred {n} bars" with Undo); **Your edits** ("Changed a note · bar 31 · just now · Revert"). Dock in Fix mode (80): Play (64; mockup 52) "Play bars 27 to 28", "Bars 27–28", "Plays the selected bars on repeat while you fix", segmented **Listen to: Original · Your part · Tab synth · Both** (48 boxes), speed − "50 %" + (64; mockup 40). Toast "Edit saved · bar 31, string 3 → fret 2" + Undo. "Replace all in this song" and "Show original" (report; not in a mockup) are placed by s38 at G4. The copy says "Your fixes are saved for this song" and never implies the model learns from them.
- **Display popover** (Aa): Appearance (Night Rehearsal · Daylight · Follow my device), Where is your screen? (Automatic · Desk · Music stand · Floor) + Reading size, Hyperlegible font, Show uncertainty, Notation follows the music (Page by page · Scrolling · Off), Playhead (Line · Block · Bar), Reduce motion. The same controls as Settings → Display & practice.
- **Legend popover** (`26` §5), **Level & capo popover**, **Piano options**, **Melody options**: as today, restyled.
- **PedalHud:** toast-style chip at the notation's top right, ≤ 100 ms: icon + "{source} · {action}" ("Left pedal · From the top of the loop", "Key , · Speed 70 %"); 1.2 s; polite.
- **Count-in:** the beat number at display size (150) in `--primary-ink`, centred on the notation, with "Count-in · beat 3 of 4" under it; a static number under reduced motion.
- **Shortcuts overlay** (`?`, desktop): the key table with "Learn key" per row.

#### 3.7.5 Instruments
| Instrument | View switch (default first) | Now column | Inspector notes | Mockup |
|---|---|---|---|---|
| Guitar | Tab · Notes · Chords | Chord + shape, Level and Capo | — | `Main.dc.html`, `Practice-Mix.dc.html` (Chords: a "Shapes in this song" row of chord boxes, Level Simple / As played, "Capo none · sounds in A minor", the chord sheet with section names and bar ranges at the left, four bars a line, beat slashes, the current beat's slash amber) |
| Bass | Tab · Notes · Chords | Chord, Level (Root notes / As played) | — | — |
| Piano | Chart · Notes · Staff, plus a **Hands** segmented control (Both · Left · Right; the other hand drawn at 45 %, audio unchanged) | Above the roll: "Now · bar 6" + chord 40 + beats + "Next · in 3 beats" + chord; legend "L left hand · R right hand (quiet)" | **Wait for me** (MIDI keyboard badge; V5) in the dock where Web MIDI exists | `Practice-Piano.dc.html` |
| Drums | Grid · Staff · Chords, plus **Level** (Main groove · Simplified · As played) in the top bar | Above the grid: "Bar 10" + "2 e &" (mono 40) + beats 22; the letter key line | Mix: today the drum stem and the band; per-drum channels ("Kick only", "Drums minus snare") and "Focus the lane I'm learning" need deeper separation and are later scope (not s32–s45). The hint card "Both feet busy? Start and stop with a MIDI pad or the space bar, and turn on 2 bars of count-in." | `Practice-Drums.dc.html` |
| Vocals | Melody · Chords | The phrase strip (as built) | — | — |
| Something else | Chords | Chord | — | — |

### 3.8 Edit `/songs/$songId/edit` (desktop)
The full editor, reached from Fix → "Open full editor": the notation (wide, scroll) and an inspector built from the same Fix components (chord and note cards, beat fixes, Your edits with Revert), undo/redo, "Hear original". Touch devices are redirected to Practice in Fix mode. Restyled in s38.

### 3.9 Settings `/settings/*` (app shell) — `Settings-Account.dc.html`, `Settings-Display.dc.html`, `Settings-Pedal.dc.html` · s36 (sections), s42 (sound delay), s43 (pedal wizard)
Layout: container 1180, left nav (220: Account · Display & practice · Keyboard & pedal · About; a list on phones) and the section (h1, sections 28–30 apart, separated by hairlines). Each field saves on its own with "Saving…" / "Saved" / "Couldn't save. Try again." (no global save).
- **Account:** **Profile** — Name, Username (read-only), Main instrument (segmented: Guitar · Bass · Piano · Drums · Vocals · Something else), "How long have you played?" (Just started · A few songs · Coming back). **Plan** — h3 + "Demo billing" badge; card: plan name (h2), Welcome status ("Your Welcome analysis is still unused."), allowance meter "Lite analyses · 3 of 5 left · resets 1 Dec", **See Plus** (primary) on Free; on Plus the renewal line, full-analysis meter, Cancel Plus / Resume Plus, Manage plan; checkout return messages. **Privacy** — "Help improve transcriptions" switch ("Share the chords and notes you correct, never your audio. Off by default."); the data export card (states as built: Prepare my data → preparing → "Your file is ready" + **Download my data** / Prepare a new file, failed, unavailable, worker offline); **Delete my account** card (`--destructive-surface` edge): "Removes every song, stem, loop and edit. This can't be undone." + **Delete account** (destructive outline) → AlertDialog → re-check "Confirm it's you" when the session is old. Then **Sign out** (ghost).
- **Display & practice** (badge "Saved on this device"): **Appearance** — exactly three radio cards with themed miniatures (owner decision D2, G1; `stage` is a valid stored id with no card, `26` §2): Night Rehearsal "Dark. Easy on the eyes in dim rooms." · Daylight "Light. Best in a bright room or outdoors." · Follow my device "Switches with your system setting."; Increase contrast (Follow system · On · Off). **Reading** — Where is your screen? (Automatic · Desk · Music stand · Floor); Reading size card (slider 80–140 % step 10, value, hint, live sample "Am" + "3 5 7 10"); Hyperlegible font ("Wider letters and clearer digits for low vision"); Show uncertainty ("Dashed outline and ? on notes and chords we're unsure of"); Left-handed ("Mirrors chord shapes and the fretboard"; stored on the account as today). **Motion** — "Notation follows the music" (Page by page · Scrolling · Off); Reduce motion (Follow system · On · Off; "Page turns instead of scrolling, the playhead steps by beat"). **Practice defaults** — Starting speed (stepper, 25–110 %), Speed ladder ("+5 % after {n} clean passes", default 3, "Up to 100 %, on for new loops"; s37), Count-in (Off · 1 bar · 2 bars), Rest between repeats (None · 1 beat · 1 bar). **Sound delay** card (s42): "Tap along with 8 clicks and we'll line up the beat lights, the playhead and your sound. Bluetooth headphones usually play about 0.2 s late; wired ones are best for playing along." + badge "Now +180 ms · measured with Bluetooth headphones" + **Tap along to measure** (primary, 48) + a manual stepper (−150 to +500 ms, 10 ms) under "Set it by hand"; a wireless warning when `outputLatency` suggests Bluetooth.
- **Keyboard & pedal:** intro "Control practice without taking your hands off the instrument. Pedals are saved on this device."; the **pedal wizard** card (s43): "Pedal setup · step 2 of 3", "Now press your right pedal", "Left pedal: got it. It sends ↑, which most pedals send out of the box, so we won't use it for speed.", captured-key badges, Start over · I only have one pedal, the two-pedal illustration, and step 3's presets: **Restart loop · Play/pause** ("Recommended for most practice"), **Not yet · Felt clean** ("Rate passes with your foot"), **Back a bar · Next bar** ("Step through a tricky passage"), with "Holding a pedal for half a second does a second action, so two pedals can cover four."; before setup the card reads "Have a pedal? Set it up". **Keys**: "Single-key shortcuts" switch with "Turn single keys off if you use speech input or switch control. Ctrl shortcuts keep working."; the table Action · Keys · Pedal · **Learn key** (rows in `12` §8 order); the test area (dashed) "Try a key or pedal here" / "Click here, then press. Last: PageDown → Next bar" + Reset to the defaults.
- **About** (no mockup): app version and build date; the transcription models and their versions (from the analysis model ids); font licences (Instrument Sans, JetBrains Mono, Bravura, Atkinson Hyperlegible Next: SIL OFL 1.1, with the texts); a link to the provenance register; "Personal mode: payments are simulated; analyses run on the owner's machine."

### 3.10 Billing (bare shell; personal mode `25` §2) · s36
No new mockups: the upgrade sheet (bottom drawer: "Plus gives you", Monthly / Yearly choice cards, "Cancel anytime in one tap.", Not now / **Continue to checkout**), mock checkout (banner, plan summary, **Simulate successful payment** / Simulate declined card / Cancel; no card fields ever), mock portal and return states are restyled on the new tokens with the Pricing card style.

### 3.11 System pages, banners, dialogs and toasts — `States.dc.html` · s36
| Item | Content | Action |
|---|---|---|
| Unsupported browser (bare) | h3 "Splitune can't run in this browser" + "It's missing AudioWorklet, which plays your stems in sync. Try a recent Chrome, Edge, Firefox or Safari." (the missing feature named in plain words) + the supported-versions line under Details | Copy link · "Your library is still available" |
| Analysis failed (card in practice and the library) | Icon + h3 by reason ("We couldn't find a steady beat") + the reason's sentence + "This didn't use an analysis." | **Try again** (primary) · the reason's alternative ("Practise with time-based loops") |
| Worker offline banner | "Processing machine offline. Your song is queued and starts automatically." | — |
| Offline banner | "You're offline. Songs you've opened keep working." | — |
| Update ready | "A new version is ready. It waits until you stop playing." | Reload (never during playback) |
| Rough-part banner (practice) | "Your part didn't separate cleanly, so the tab may be rougher." | Show chords instead |
| In-app browser | "Open in your browser for audio and uploads." + platform hint | Copy link · Dismiss |
| iOS install hint (app shell) | "Install Splitune: tap Share, then Add to Home Screen." | Dismiss |
| Screen can't stay on | `practice.screen_tip` | Close |
| Playback interrupted | "Playback paused by another app or a call." | Tap to resume |
| 404 | Mono "404" + "We couldn't find that page." + "The link may be old or mistyped." | Go to library |
| Error boundary | "Something went wrong on this screen." + error id (copyable) | Reload · Go to library |
| Confirm dialog | h3 "Delete “{title}”?" + "Its stems, loops, passes and edits will be removed. This can't be undone." | Cancel · **Delete song** (destructive solid) |
| Rename dialog | "Rename song", Title field ("Enter a title.") | Cancel · Save |
| Delete account | `delete.account_confirm`, then "Confirm it's you" | Cancel · Delete account |
| Toasts | "Edit saved" + Undo · "Renamed." · "Song deleted." · "Analysis started." · "Thanks — this helps" · error "An edit couldn't be saved, so it was undone." (`role="alert"`) | — |
| Empty library | §4 | — |

### 3.12 Command palette (app and focus shells) — `States.dc.html` · s34
`Dialog` with a 52 px field "Search songs, clips and actions" (17 px) + `Esc`; results grouped **Songs**, **Clips** ("Chorus riff · Northbound Lights · bars 25–28"), **Actions**; the typed text bold in results; ↑/↓ move, Enter runs (its `Kbd` shown on the selected row). Actions: Add song · Loop bars {a}–{b} (typed "loop 17-20") · Loop the next {section} (with sections) · switch view (Tab, Notes, Chords…) · Night Rehearsal / Daylight / Follow my device · Set up a pedal · Display and reading · Settings sections · Sign out. Each action shows its key where it has one. Add song has no global chord: ⌘/Ctrl N is reserved by browsers (the mockup's "Ctrl N" is dropped). Lazy-loaded.

## 4. States catalogue
| Screen | Empty | Loading | Partial | Error | Offline |
|---|---|---|---|---|---|
| Library | Drop-style panel: "Bring the first song you want to learn" / "Drop a file anywhere on this page, paste a link, or record it." · **Add song** · Try an example | Skeleton Continue card + 6 skeleton song cards | Cards with stage progress ("You can loop it already") | Inline "We couldn't load your library." Retry (cached cards stay) | Cached songs shown; others dimmed with "Needs connection" (V10) |
| Library filters | "No songs match. Try another search or filter." · Clear filters | — | — | — | — |
| Add song | Drop zone | "Reading the file…" on the file card | Upload continues after closing (library card + practice status) | Per §5.6 | "You're offline. We'll start the upload when you're back." (queues) |
| Practice | — | Skeleton of the regions (top bar, song map, Now, notation, inspector, dock); "Loading your song…" after 1 s | §3.7.3 | Per-layer inline reasons; failure card | Cached stems play; uncached "This song isn't saved for offline yet." |
| Practice inspector | Loop: "No loop yet — tap two bars, or a section"; Progress: "Mark a pass as Felt clean to see your progress here."; Fix: "Nothing marked unsure in this song." | Skeleton rows | Mix before stems: "The mixer opens once your part is isolated." | Inline | Read-only notes where a tab needs the network |
| Settings | — | Field skeletons | — | Inline per field | Read-only with notice ("You're offline. These settings need a connection." on Privacy) |
| Command palette | "No matches. Try a song title or "loop 17-20"." | — | — | — | Songs only from the cache |
| Edit | "Select a bar to edit it." | Skeleton | — | Inline | Edits queue ("Saved on this device") |

## 5. Content design
### 5.1 Voice
**A calm coach who knows music.** Plain words, short sentences, real numbers, honest about uncertainty, encouraging without hype. Errors follow "what happened, what it means, what you can do".

| Do | Don't |
|---|---|
| "Unsure: we'd guess wrong about 1 time in 3" | "Our AI perfectly transcribes any song!" |
| "Pass 2 at 75 % — how was it?" | "🔥 You're on fire! Don't break your streak!" |
| "You've used this month's 5 Lite analyses. They reset on 1 Dec." | "Oops! Limit reached. Upgrade now!" |
| "Pick up where you left off" · "A cold first pass shows what stuck." | "You haven't practised in 3 days." |
| "Your fixes are saved for this song." | "Your fixes train our AI." |

### 5.2 Terminology (use exactly these words in UI)
| Term | Meaning | Avoid |
|---|---|---|
| Song | An added track in the library | Track, file, project |
| Add song | Bringing a song in (file, link, recording) | Import, upload (as a verb in buttons) |
| Part | The instrument the learner practises ("your part") | Target, stem (in user copy) |
| Stem | One separated layer in the mixer | Channel, track |
| Band | Everything except your part (the mix-minus) | Backing, mix-minus |
| Mix | The balance of stems; presets "Your part loud", "Minus-one", "Original", "Rhythm only" | Levels |
| Loop · Clip | The repeating range · a saved, named loop | A–B, cycle, region |
| Section | A named part of the song ("Chorus"); "Part A/B/C" when unnamed | Segment |
| Pass · clean pass | One time through the loop · one marked Felt clean | Rep, attempt |
| First clean pass | The speed of the first clean pass in a session, the "cold" pass | Warm-up score |
| Speed · Speed ladder | Playback rate as % of the original · stepping the speed up after clean passes | Tempo (except the BPM readout), trainer |
| Analysis | Full or Lite processing; "Welcome analysis" for the free first Full | Credit, token, job |
| Auto-transcribed | Machine-made notation | AI-generated, perfect |
| Sure · Probably · Unsure | Confidence levels | Error, wrong, low-confidence |
| Edited by you · Fix | A corrected mark · correcting the transcription | Override |
| Night Rehearsal · Daylight | The themes | Dark mode, light mode (in copy) |
| Stand view | The tablet layout for a music stand | Stage mode |
| Pedal | A page-turner pedal | Foot switch, HID |

### 5.3 Style rules
- Sentence case for everything, including buttons and titles. Product names keep their case (Splitune Plus); the wordmark is lowercase, the name in copy is "Splitune".
- Buttons are verbs naming the outcome: "Start practising", "Delete song", "Tap along to measure", "Resume practice" — never "Submit", "OK", "Yes" (a confirming answer names the thing: "Yes, guitar").
- Numerals always; non-breaking space before units: "70 %", "84 BPM", "−3 dB" (U+2212), "0:45", "1:02:10"; "1 h 20" for practice time. Speed as % first, BPM second; the ladder goal as "→ 100".
- Bars: 1-based in UI and URLs ("bars 17–20", en dash); "Pickup" for bar −1; beats 1-based ("Bar 12, beat 3"); bar.beat as "26.3".
- **Uncertainty as frequency:** "about 1 in 3", "about 1 in 5", "we'd guess wrong about 1 time in 3"; never a percentage or a decimal probability. Round to 1 in 2 / 3 / 4 / 5 / 10 / 20.
- Dates: "1 Dec", "1 Dec 2027" when not this year; relative up to 7 days ("yesterday", "3 days ago").
- No exclamation marks except success the user caused ("You're on Plus!"), at most one per screen. No emoji.
- Errors never blame and never show raw codes; technical detail behind "Details".
- Accessible names match visible labels (WCAG 2.5.3); icon-only buttons use the verb ("Play", "Restart loop"); state goes into the name ("Count-in, 1 bar, on").
- Joined clauses: prefer two short sentences over an em-dash join ("Processing machine offline. Your song is queued…"); the em dash stays in fixed phrases ("Pass 2 at 75 % — how was it?", "Demo mode — no real charges.").

### 5.4 Message formula
**What happened** (one sentence) + **what it means for you** (optional) + **what you can do** (action buttons). Example: "We couldn't find a steady beat. Bar loops won't line up, but time-based loops work. This didn't use an analysis. [Try again] [Practise with time-based loops]".

### 5.5 Motivation and progress UI
- Show competence evidence: best clean tempo per clip, the 30-day chart, **the first clean pass next session** (the honest retention measure), "+10 % on Chorus riff" this week.
- Seven day dots for the last seven days (Library, phone library): filled for days practised, outlined otherwise; never a streak number, never "missed".
- Goals are optional and weekly (the Weekly goal switch is off by default); no daily quota.
- No streak counters, leaderboards, badges, confetti, loss-framed notifications or red notification dots. Missed days are never mentioned.
- Notifications only when asked, and neutral: "Paper Boats is ready to practise." (s44).

### 5.6 Message catalogue (source of truth; Paraglide keys `area.situation`)
`apps/web/app/copy-keys.test.ts` checks these keys and their exact copy. **Status:** — unchanged · **changed** (the test expectation and `en.json` change by design; old copy in §5.7) · **new** (joins the test's `CATALOGUE` in the step named, when that step adds the key).

| Key | Copy | Actions | Status |
|---|---|---|---|
| `import.unreadable` | We couldn't read this file. It may be damaged or in a format we don't support. | Try another file · Record yourself | — |
| `import.too_long` | Songs up to 20 minutes are supported. This one is {duration}. | Choose another file | — |
| `import.too_large` | Files up to 500 MB are supported. | Choose another file | — |
| `import.speech` | This sounds like speech, so results may be poor. | — (badge) | — |
| `import.live` | Sounds like a live recording. Separation may be rougher. | — (badge) | **changed** |
| `import.duplicate` | You already have this song. | Open it · Add anyway | — |
| `import.offline` | You're offline. We'll start the upload when you're back. | — | — |
| `import.url_unsupported` | We can't import from this link. Try uploading the audio file instead. | Upload a file | — |
| `import.url_failed` | We couldn't download this video (it may be private, removed or blocked in your region). | Upload a file | — |
| `import.url_broken` | Link import is temporarily broken. Upload a file instead. | Upload a file | — |
| `record.permission_denied` | Splitune needs your microphone to record. You can allow it in your browser's site settings. | Try again | — |
| `analysis.queued_offline` | Processing machine offline. Your song is queued and starts automatically. | — | **changed** |
| `analysis.eta` | About {minutes} min left | — | — |
| `analysis.stems_unavailable` | Stems are unavailable right now; chords and beat are ready. This didn't use an analysis. | Retry later | — |
| `analysis.failed` | We couldn't analyse this song. This didn't use an analysis. | Try again · Details | — |
| `analysis.wrong_instrument` | Is {instrument} the part you play? | Yes, {instrument} · Pick another | **new** (s35; the old doc listed it, `en.json` never had it) |
| `practice.chords_only` | We're not confident in the note-level tab for this song — showing chords. | Show tab anyway | — |
| `practice.notes_unsure` | We're not confident in the notes for this song. | — | — |
| `practice.rough_stem` | This stem may contain bits of other instruments. | — | — |
| `practice.legend` | Auto-transcribed — may contain errors (v{model}) | Show uncertainty | — |
| `practice.stems_expired` | The stems for this song were removed after 180 days unused. Your loops and edits are safe. | Re-create stems | — |
| `practice.not_offline` | This song isn't saved for offline yet. | — | — |
| `practice.beat_off` | Metronome off the beat? | Half tempo · Double tempo · Move downbeat | — |
| `practice.pass_prompt` | Pass {pass} at {speed} — how was it? | Felt clean · Not yet | **changed** |
| `practice.best_tempo` | Best clean pass: {pct} % | — | — |
| `practice.screen_tip` | This browser can't keep your screen on. If it turns off while you play, choose a longer auto-lock time in your device's display settings. | Close | — |
| `plan.cap_lite` | You've used this month's {limit} Lite analyses. They reset on {date}. You can keep practising every song you already have. | See Plus · Not now | — |
| `plan.welcome_available` | Your first full analysis is free — your part isolated, plus tab. | Use it now | — |
| `plan.cap_full` | Full analyses are part of Plus. You've used your free Welcome analysis. | See Plus · Use Lite instead | — |
| `plan.allowance` | {left} of {limit} Lite left · resets {date} | — | **changed** |
| `billing.demo` | Demo mode — no real charges. Payments are simulated. | — | **changed** |
| `billing.declined` | The (simulated) payment was declined. Nothing was charged. | Try again | — |
| `billing.cancelled_at_period_end` | Plus stays active until {date}. Then you'll be on Free — nothing you've made is removed. | Resume Plus | — |
| `auth.wrong_credentials` | That username and password don't match. | — | — |
| `auth.username_taken` | That username is taken. Try another. | — | — |
| `system.offline` | You're offline. Songs you've opened keep working. | — | **changed** |
| `system.unsupported` | It's missing {missing}. Try a recent Chrome, Edge, Firefox or Safari. | Copy link · Your library is still available | **changed** |
| `system.in_app_browser` | Open in your browser for audio and uploads. | Copy link | — |
| `system.error` | Something went wrong on this screen. | Reload · Go to library | — |
| `library.empty` | Bring the first song you want to learn | Add song · Try an example | **changed** |
| `library.empty_body` | Drop a file anywhere on this page, paste a link, or record it. | — | **new** |
| `delete.song_confirm` | Delete “{title}”? | Delete song · Cancel | **changed** |
| `delete.song_confirm_body` | Its stems, loops, passes and edits will be removed. This can't be undone. | — | **new** |
| `delete.account_confirm` | Delete your account and everything in it? This can't be undone. | Delete account · Cancel | — |
| `analysis.heard` | We hear {instruments}. | — | **new** |
| `analysis.notify` | Notify me when it's ready | — | **new** (s44) |
| `practice.pedal_detected` | Pedal detected? Set it up | Set it up | **new** (s35) |
| `practice.fix_saved_note` | Your fixes are saved for this song. | — | **new** (s38) |
| `shortcuts.single_keys_hint` | Turn single keys off if you use speech input or switch control. Ctrl shortcuts keep working. | — | **new** (s36/s43) |

Pipeline `reasons` codes (`05`) map to `analysis.reason.{code}` keys with the same formula; unknown codes fall back to `analysis.failed`. A reason that needs a card title adds `analysis.reason.{code}_title` (first: `beats_not_found_title` "We couldn't find a steady beat", with the action `analysis.time_loops` "Practise with time-based loops").

**Codes from the contracts → keys.** The UI renders by code only; `ErrorEnvelope.message` is for logs, never shown as-is.

| Contract code | Key | Copy |
|---|---|---|
| `ViewReason.notes_unavailable` | `practice.reason.notes_unavailable` | Note-level tab isn't available for this song — showing chords. |
| `ViewReason.notation_not_supported` | `practice.reason.notation_not_supported` | Tab for this instrument isn't supported yet — showing chords. |
| `ViewReason.rough_stem_low_conf` | `practice.reason.rough_stem_low_conf` | Your part didn't separate cleanly, so the tab is unreliable — showing chords. |
| `ViewReason.low_confidence` | `practice.chords_only` | (above) |
| `invalid_input` | `error.invalid_input` | Some details aren't right. Check the highlighted fields. |
| `unauthenticated` | `error.unauthenticated` | Your session has ended. Sign in again to continue. |
| `forbidden`, `not_found` | `error.not_found` | We couldn't find that. It may have been deleted. |
| `conflict` | `error.conflict` | This changed somewhere else. Reload to see the latest version. |
| `file_too_large` · `too_long` · `unsupported_media` | `import.too_large` · `import.too_long` · `import.unreadable` | (above) |
| `url_unsupported` · `url_download_failed` | `import.url_unsupported` · `import.url_failed` | (above) |
| `analysis_cap_reached` | `plan.cap_lite` / `plan.cap_full` / `plan.cap_full_plus` by `details.type` | (above) |
| `rate_limited` | `error.rate_limited` | Too many tries in a short time. Try again in {seconds} s. |
| `pipeline_unavailable` | `analysis.queued_offline` | (above) |
| `internal_error` | `system.error` | (above) |
| `rights_warranty_required`, `taken_down` | — | Dormant in personal mode (`25` §8) |

### 5.7 Copy changes for the redesign (by area; the owning step changes `en.json` and the tests)
Current = `apps/web/messages/en.json` at `8d6a3f6`. Keys in §5.6 marked **changed** also change `copy-keys.test.ts`'s `CATALOGUE`. "Retire" = the key's last use goes; the step deletes it.

| Key | Current | New | Step |
|---|---|---|---|
| `import.live` | This sounds like a live recording. Parts may separate less cleanly — we'll mark rough results. | Sounds like a live recording. Separation may be rougher. | s34 |
| `analysis.queued_offline` | Processing machine offline — your song is queued and will start automatically. | Processing machine offline. Your song is queued and starts automatically. | s34 |
| `analysis.wrong_instrument` (new key) | — | Is {instrument} the part you play? | s35 |
| `practice.pass_prompt` | How was that pass? | Pass {pass} at {speed} — how was it? | s35 |
| `plan.allowance` | {left} of {limit} Lite analyses left · resets {date} | {left} of {limit} Lite left · resets {date} | s34 |
| `billing.demo` | Demo mode — no real charges. | Demo mode — no real charges. Payments are simulated. | s36 |
| `system.offline` | You're offline. You can keep practising songs you've opened. | You're offline. Songs you've opened keep working. | s36 |
| `system.unsupported` | Your browser can't run Splitune's audio engine ({missing}). | It's missing {missing}. Try a recent Chrome, Edge, Firefox or Safari. | s36 |
| `system.update_ready` | A new version is ready. | A new version is ready. It waits until you stop playing. | s36 |
| `library.empty` | Your library is empty. Import a song you want to learn, or start with an example. | Bring the first song you want to learn | s34 |
| `delete.song_confirm` | Delete “{title}”? Its stems, loops and edits will be removed. This can't be undone. | Delete “{title}”? (body moves to `delete.song_confirm_body`) | s34 |
| `nav.import`, `library.import_song` | Import · Import a song | Add song (new `nav.add_song`; retire both) | s34 |
| `import.title` | Import a song | Add a song | s34 |
| `import.full_body` · `import.lite_body` | Your part isolated, plus tab · Beat and chords, fast | Your part isolated, a mixer for every stem, plus tab. (mixer phrase from s40b) · Beat and chords, under a minute. No stems or tab. | s34 |
| `import.drop_prompt` (after a pick) | Drop an audio or video file, or | Drop another file here, or (new `import.drop_another`) | s34 |
| `import.formats` | MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 minutes | MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 min | s34 |
| `import.record_explainer` | Your browser will ask for the microphone. Turn off noise reduction on headsets for the cleanest take. | unchanged before the prompt; while recording the hint `import.headset_hint` "Using a headset? Turn off its noise reduction for the cleanest take." (new) | s34 |
| `import.import_anyway` · `import.import_and_analyse` | Import anyway · Import and analyse | Add anyway · Add and analyse | s34 |
| new | — | `import.title_label` "Title", `import.artist_label` "Artist", `import.optional` "(optional)", `import.artist_placeholder` "Who plays it", `import.opens_now` "It opens right away. Loops and slow-down work while we analyse.", `import.welcome_badge` "Welcome · free", `import.left_badge` "{left} of {limit} left", `import.hand` "Hand", `import.recording` "Recording", `import.works_best` (disclosure) | s34 |
| `mixer.backing` | Backing | Band | s35 |
| `mixer.presets` gloss keys `practice.preset_gloss_*` | Your part louder than the rest · Your part muted — you play it · The song as it was recorded | Learn it: {part} up, band down · Play it: your part muted · The song as recorded; new `mixer.preset_rhythm` "Rhythm only" + "Bass and drums, nothing else" | s35 / s40b |
| `practice.legend_short` | Auto-transcribed · v{model} | Auto-transcribed · {count} unsure ("Auto-transcribed" alone when nothing is marked) | s35 |
| new | — | `analysis.eta_inline` "about {minutes} min left" (after a "·": library cards, the analysing badge); `{minutes}` may be a range "3–5" | s34 |
| `practice.loop_off` | No loop — tap two bars | No loop (pill) + `practice.loop_off_hint` "tap two bars, or a section" (new); the HUD keeps "No loop — tap two bars" as `practice.hud_no_loop` (new) | s35 |
| `practice.now_bar`, `practice.next_in_beats` | Now · bar {bar} · Next · in {count} beats | Now · bar {bar} · beat {beat} (new `practice.now_bar_beat`); Next unchanged | s35 |
| `practice.pass_question` | How was pass {pass}? | retire (the prompt carries the pass) | s35 |
| `practice.stage_hint`, `practice.try_stage`, `appearance.stage` | Practising in the dark? Try Stage. · Try Stage · Stage | retire (`26` §2) | s35 / s36 |
| `appearance.dark` · `appearance.light` · `appearance.system` | Dark · Light · System | Night Rehearsal · Daylight · Follow my device; card hints `appearance.dark_hint` "Dark. Easy on the eyes in dim rooms.", `appearance.light_hint` "Light. Best in a bright room or outdoors.", `appearance.system_hint` "Switches with your system setting." (new) | s34 (the three labels, for the account menu and ⌘K, D2; owner) / s36 (hints) |
| `settings.score`, `settings.score_hint`, `settings.score_paper`, `settings.score_match` | Score · … | retire (no score surface) | s36 |
| `practice.tab_layout`, `practice.tab_layout_page`, `practice.tab_layout_scroll` | Tab layout · Page by page · Scrolling | `practice.follow` "Notation follows the music" · Page by page · Scrolling · new `practice.follow_off` "Off" | s35 |
| `settings.handedness`, `settings.right_handed`, `settings.handedness_hint` | Handedness · Right-handed · … | Left-handed switch in Display & practice with "Mirrors chord shapes and the fretboard" (`settings.left_handed_hint`, new); retire the radio pair | s36 |
| `settings.level_few_songs` · `settings.level_returning` | I can play a few songs · Coming back after a break | A few songs · Coming back; label `settings.level` → "How long have you played?" | s36 |
| `settings.profile`, `settings.billing`, `settings.privacy` (nav) | Profile · Plan & billing · Privacy | Section headings inside Account; nav `settings.account` "Account", `settings.about` "About" (new) | s36 |
| `settings.sound_delay_hint` | Bluetooth headphones play sound late. If the score runs ahead of what you hear, raise this until they match. | Tap along with 8 clicks and we'll line up the beat lights, the playhead and your sound. Bluetooth headphones usually play about 0.2 s late; wired ones are best for playing along. (+ `settings.tap_along` "Tap along to measure", `settings.sound_delay_now` "Now {ms} · measured with {output}") | s42 |
| `privacy.training_hint` | Let Splitune use the corrections you make to improve future analyses. Off unless you turn it on, … | Share the chords and notes you correct, never your audio. Off by default. | s36 |
| `privacy.delete_body` | Removes your account and everything in it: songs, stems, loops, edits and practice history. A Plus plan ends … | Removes every song, stem, loop and edit. This can't be undone. | s36 |
| `shortcuts.slower` · `shortcuts.faster` | Slower (5 %) · Faster (5 %) | Slower by 5 % · Faster by 5 % (keys `,` `.`) | s35 |
| `shortcuts.restart` · `shortcuts.learn` | Restart loop or back a bar · Learn this pedal | Restart loop · back a bar · Learn key | s43 |
| `shortcuts.settings_intro` | These keys work on the practice screen. Learned pedals are saved on this device. | Control practice without taking your hands off the instrument. Pedals are saved on this device. | s43 |
| `shortcuts.test_hint` | Click here, then press a key or your pedal. | Click here, then press. (+ `shortcuts.test_last` "Last: {key} → {action}") | s43 |
| new | — | `shortcuts.next_unsure` "Next unsure spot" (J), `shortcuts.previous_unsure` "Previous unsure spot" (K), `shortcuts.palette` "Command palette", `shortcuts.single_keys` "Single-key shortcuts", pedal-wizard keys `pedal.*` (setup, step, press left/right, got it, one pedal, start over, three presets with hints, hold rule) | s35 / s43 |
| `auth.showcase_title` · `auth.showcase_point_1…3` | Learn the song one part at a time. · Add a song and hear… · Follow the chords… · Loop a few bars… | Your loops, speeds and fixes stay with every song. · Pick up on the same bar, at the same speed, on any device. · See how your clean speed grows on each clip. · Chords and notes you correct are kept for good. | s36 |
| `home.headline` · `home.subhead` | Learn the songs you love, one loop at a time. · Bring a song. Splitune isolates your part… | Bring any song. Practise just your part. · Splitune pulls your instrument out of the mix, writes out the chords and tab, and loops any bar at any speed. Where it isn't sure of a note, it tells you. | s36 |
| `home.proof_*`, `home.stand_*`, `home.session_*` | (Music Stand home copy) | The §3.1 copy: proof titles "Hear your part on its own", "Loop it slow, then climb", "Tab that admits when it's unsure" with their bodies; stand items "Hands stay on the strings", "Readable from where you sit", "A count-in that follows the band", "Stand view for tablets", "Works offline", "Progress without nagging"; session steps; retire `home.stand_stage_*`, `home.proof_isolate_point_2` ("Separate faders…") until s40b | s36 |
| `pricing.title` and card keys | Pricing · Splitune Plus · … | Every practice tool is free; card leads and bullets from §3.2; compare rows "Loops, clips and the speed ladder", "Slow down to 25 % without changing pitch", "Count-in, metronome and beat lights", "Mixer, chords, tab and fixes", "Keyboard, pedal and Stand view", "Full analyses", "Lite analyses", "Export and offline downloads" | s36 |
| `start.screen_hint` · `start.screen_stand_hint` · `start.screen_floor_hint` | We'll size chords and tab… · Tablet on a music stand, about 75 cm away · Phone on the floor or a chair, a metre or more away | add "You can change this any time." · Tablet on a stand, about 75 cm away · Phone on the floor or a chair, a metre or more; new `start.read_title` "Can you read this from where you play?", `start.read_hint` "Step back to your playing spot. If the numbers are hard to read, make them bigger.", `start.skip_for_now` "Skip for now" | s36 |
| new (library) | — | `library.pick_up` "Pick up where you left off", `library.resume` "Resume practice", `library.this_week` "This week", `library.week_label` "Practised on {n} of the last 7 days", `library.revisit` "Worth a revisit", `library.revisit_hint` "Clips you haven't played for a while. A cold first pass shows what stuck.", `library.filter_title` "Filter by title", `library.can_loop` "You can loop it already", `library.add_stems` "Add stems + tab with a Full analysis", `library.queued_offline` "Processing machine offline. Starts automatically." | s34 / s39 |
| new (practice) | — | Getting ready (`practice.getting_ready` "Getting your part ready", `practice.practise_already`, `practice.what_works_now` "What works now", unlock rows, `practice.sections_after_chords` "Sections appear when the chords are ready"), stage detail lines (`stage.detail.*`), loop tab (`practice.next_phrase`, `practice.fine_tune`, ladder keys `ladder.*`), Fix keys (`fix.*`: "Fixing · every change saves as you go", "Spot {n} of {total} · bar {bars}", "Our first guess. Wrong about 1 time in {n} for bars like this.", "Other likely chords", "about 1 in {n}", "Use", "It's right", "or play it as", "Listen to", "Tab synth", "Plays the selected bars on repeat while you fix", "Your edits", "Revert", "Edited by you", "Unsure: we'd guess wrong about 1 time in {n}"), Progress keys (`progress.*`), Tools sheet keys (`tools.*`: "Tools", "Vibrate on beat", "All {n} stems"), Stand view keys (`stand.*`: "Pedal connected", "Page {n} of {total} · turns on the downbeat of bar {bar}", "Hold right pedal", "Hold left pedal") | s35–s43 |

## Carried over from the Music Stand builds (behaviour that stays)
- Auth as built (username + password, `CredentialsForm`, field errors, `?next=`), privacy states, billing screens and the plan locks at the point of action (steps 10, 14, 15) keep their behaviour and copy except §5.7.
- Onboarding steps, `StepDots`, `ChoiceCard`, `CoachMark` placement rules and the save sheet (step 13).
- Practice: glance view "Pickup" before the first downbeat; PedalHud answers for unavailable actions ("No loop — tap two bars", "Stems aren't ready yet"); the analysing placeholder as a focusable region; the chord-only fallbacks per instrument and "Show tab/notes anyway"; piano chart, falling notes, guitar Notes, vocal Melody and drum Grid behaviours (steps 17c–25; `12` implementation notes).
- The visual-regression clock and fixtures (`28` §4).

## Open questions
- G5: the default theme for Practice and Stand view after the music-stand test.
- G4 (owner, on devices): the placement of "Works best with", "Replace all in this song", "Show original" and "Warm up with yesterday's hard bars", which have no mockup.
- "Pick another" (part change after tagging): s35 built it on today's routes (`songs.update` for the part, then `analyses.create`), a whole new analysis that costs an allowance and leaves the running one going. Whether it can re-run from separation (and cancel the old run) needs an API change; open.

## Sources
`redesign/report.md` (IA, practice regions, keymap, progressive processing, settings, system states, acceptance criteria), `redesign/research/product_inventory.md` (every current screen, state and string), `redesign/research/stem_practice_players.md`, `redesign/research/notation_learning_apps.md`, `redesign/research/practice_science_ergonomics.md`, `redesign/research/ai_confidence_processing_ux.md`; the 25 mockups in `redesign/mockups/` (2026-11-08). Earlier sources stay valid: `research/users/user-journeys-and-flows.md`, `research/ux/onboarding-retention-motivation.md`, `research/ux/learning-science-principles.md`, [Atlassian voice and tone](https://atlassian.design/foundations/content/voice-tone), [GOV.UK error messages](https://design-system.service.gov.uk/components/error-message/), [Apple HIG: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio).
