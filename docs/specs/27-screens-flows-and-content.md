---
title: Screens, flows and content design
workstream: engineering
last_researched: 2026-11-24
confidence: medium
---

# Screens, flows and content design

What every screen contains, how it is laid out per device, which states it has, and the words it uses, for the redesign (laid out in s31a; restyled in s46 to the black-and-white system of `26`). Tokens and components come from `26-design-system.md`; practice behaviour stays in `12-practice-screen-and-notation.md`; import mechanics in `13-import-onboarding-and-youtube-embed.md` (+ `25` §4 for URL import); plan rules in `23-plans-free-and-paid.md` §5; v1 features in `21-v1-features.md`. Where those docs and this one disagree on **layout, states or copy**, this doc wins; on behaviour, they win.

**Step s47 (2026-11-24)** rebuilt every screen on the calm-workspace direction (`docs/design/s47-direction.md`, `26`): §1 (shells), §3.1–§3.12 and the keys of §3.7.6 describe what is built now; the states catalogue (§4) and the copy rules (§5) stand, with s47's copy changes in the progress log.

Rewritten in place in step s31a (2026-11-08) from `redesign/` (report, mockups, `research/product_inventory.md`). Section numbers are unchanged, so code comments citing "27 §3.7.3" still point at the same topic. The Music Stand version is in git (`git show 8d6a3f6:docs/specs/27-screens-flows-and-content.md`). Step s46 (2026-11-17) made targeted edits for the black-and-white system: theme names, the Home composition (§3.1), the shells (§1) and the copy change list (§5.7).

**Mockups (history).** Every screen below names the s31a mockup in `redesign/mockups/` that its layout and copy came from. From s46 the mockups are historical and no longer the visual source (`26` §4.9): visuals follow `26` and the code (`packages/ui-tokens`, `apps/web/app/ui`, Storybook); layout, states and copy follow this doc; behaviour follows `redesign/report.md` and the behaviour docs. Strings shown in a mockup for a situation the app already has were adopted as that situation's copy and listed in §5.7 as changes; strings in mockups that are sample data (song titles, artists, numbers) are not copy.

## TL;DR
- **Shell (s47):** from 1024 px a left rail with the wordmark, Library, Settings, **Add song** (`A`), Search (the **⌘K / Ctrl K command palette**), the songs opened last, Usage, the worker state and the account. Below 1024 px a 48 px top bar and a bottom bar of Library · Add song · Settings. Files can be dropped anywhere in the app.
- **Add song** replaces the Import page: a dialog on desktop and a full-screen sheet on phones (File / Link / Record), with Title and Artist fields. `/import` opens the dialog.
- **Practice opens at once and fills in by stage**: every finished stage leaves a real artefact and unlocks something, starting with loops and slow-down on the original audio (§3.7.3).
- **Practice layout (s47):** the music and one transport. Top bar · song map (sections, waveform, loop band, now-line) · notation from edge to edge with the loop drawn on it · one transport, which asks how the pass went in the loop's place. The tools panel (**Loop / Mix / Progress / Fix**) is closed until asked for: docked from 1180 px, a drawer below that, a sheet on phones. Tab is the default view on every device; phones keep the glance view as their Chords view.
- **Settings = Account · Display & practice · Keyboard & pedal · About**, with a pedal setup wizard.
- **Keys:** every practice action has a key, printed on its control, and is confirmed in words within 100 ms (§3.7.6). Speed is `,` / `.` (Shift = 1 %), `Shift` + `5`…`0` sets 50…100 %, `S` opens the speed field; `1` `2` `4` `8` loop that many bars from the bar playing; ↑/↓ never change speed; single-key shortcuts can be switched off. The pedal's left side means again, its right side go.
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

| Shell | Top area | Navigation |
|---|---|---|
| Marketing | 64 px bar on the page colour with no rule under it: wordmark · How it works · Pricing (the current page has a 2 px ink line) · Sign in · **Try an example song** (outline in the bar, so each page keeps its own one filled control); signed in, "Library" replaces both. System banners sit under the bar on the page's grid | Phone: wordmark, Try an example song and Menu (the pages and Sign in, a check on the current one); footer with the wordmark and links (How it works, Pricing, Terms, Privacy), the current one marked |
| App | From 1024 px there is no top bar: a 232 px left rail holds the wordmark (→ Library) · Library · Settings (the current page has a 2 px ink line) · **Add song** with its `A` key cap · Search with `⌘K` / `Ctrl K` · Recent (the three songs opened last) · Usage · the worker state · the account (initials and name). Pages are `max-w-library` (1080) or `max-w-settings` (880) | Below 1024 px: a 48 px top bar (wordmark, search, the Usage gauge, the account) and a bottom bar **Library · Add song · Settings**, Add song a plain tab like the others |
| Focus | Practice: 52 px top bar, 48 on phones, no rule under it (§3.7.1). Onboarding: the same bar with Exit (‹ Library signed in) and no step dots (§3.3) | None; ⌘K still works when signed in |
| Auth | Wordmark top left and a quiet "Try an example song" link; one centred form column (at most 400 px), no card and no panel beside it at any width | — |
| Bare | Wordmark top left; one column on the page grid that reads from the top; a system page is a plain message with one action, no card | — |

- Every top bar is sticky. The app shell accepts a file dropped anywhere: the "Drop to add" overlay covers the window with a 2 px ink edge, an icon and the accepted formats, and opens Add song with the file.
- **Account menu** (the rail's account row; an icon button below 1024 px): the name with the username under it (email for a Google-only account) · Settings · Keyboard & pedal · Appearance (Dark / Light / Follow my device) · Help (How it works, Pricing, Terms, Privacy) · Sign out.
- **Command palette** (§3.12) opens from Search, ⌘K / Ctrl K anywhere in the app and focus shells, and a button on touch screens. `A` opens Add song from anywhere in the app shell (it follows the single-key switch and is ignored while typing or inside a dialog or menu).

**Route map**
| Before | After | Notes |
|---|---|---|
| `/library` | `/library` | Adds Continue, This week, Worth a revisit; keeps toolbar and URL state (`?view=` is gone with the grid, s47). `?add=file|link|record` opens Add song |
| `/import`, `/import?tab=record` | Redirect to `/library?add=file` / `?add=record` | The dialog opens over the library (sheet on phones) |
| `/songs/$id/practice` | same | New `?tab=loop|mix|progress|fix`; keeps `?view`, `?loop`, `?speed` (25–110), `?mix`, `?level` |
| `/songs/$id/edit` | same | Desktop full editor, reached from Fix → "Open full editor" |
| `/settings` → `/settings/profile` | `/settings` → `/settings/account` | |
| `/settings/profile`, `/settings/billing`, `/settings/privacy` | Redirect to `/settings/account#profile`, `#plan`, `#privacy` (query kept: `?checkout=success|cancelled`, `?confirm=delete`) | Account holds Profile, Plan, Privacy, Sign out |
| `/settings/display`, `/settings/keyboard` | same | Display & practice; Keyboard & pedal |
| — | `/settings/about` | New |
| `/start`, `/start/saved`, `/auth/*`, `/billing/$view`, `/unsupported`, `/account-deleted`, 404, error | same | `/start` is one page (s47): `?instrument`, `?level`, `?song`; `?step=` lands on it |

## 2. Key flows (happy paths and where they branch)
| Flow | Steps | Target | Branches |
|---|---|---|---|
| First session | Home → `/start` (guitar, just started and the suggested song already chosen) → **Start practising** → Play or Space → the example loops at 70 % → Felt clean → "Save your progress?" | First slowed loop ≤ 5 min, no account; two actions with the defaults (s47) | "Or bring your own song" (file, link, record) from the same page |
| Come back | Open the app → Library → **Resume practice** on the Continue card | First audible pass < 10 s after opening (report) | No progress yet: the most recent song |
| Add a file | Add song (button, ⌘K, or drop) → file → part + analysis → **Start practising** → Practice opens with local playback while upload and analysis continue | Playable ≤ 5 s after the pick | Warning badge, duplicate ("Open it"), cap reached, offline queue |
| Add a link | Add song → Link → paste → part + analysis → Practice opens; first stage "Downloading" | — | Unsupported or failed link → upload instead (`25` §4) |
| Record | Add song → Record → permission → level + count-in → record → **Use this recording** | — | Permission denied |
| Practise | Practice → tap two bars (or a section chip, or `4` for four bars from here) → speed −/+ (or `Shift` + `7` for 70 %) → play → rate each pass (C / N, or the pedal: left again, right go) | Loop made in ≤ 2 actions, median < 3 s; every action confirmed ≤ 100 ms | Ladder on: speed steps up after clean passes |
| Fix an unsure spot | Fix tab (or E, or tap a "?") → J / K through spots → hear an alternative over the loop → **Use** (or "It's right") | ≤ 2 taps to an alternative | Offline: queued edits |
| Set up a pedal | ↑/↓ before setup → PedalHud "Pedal detected? Set it up" → wizard: left, right, choose what they do → test area | A pair in < 30 s | One pedal only |
| Get notified | Getting ready card → **Notify me when it's ready** → browser permission (on that click only) | — | No Web Push (not installed on iOS): button hidden; toasts and title updates remain |
| Upgrade | Lock at the point of action → upgrade sheet → mock checkout → back with Plus | 3 screens | Declined (simulated) |

## 3. Screens
Each spec lists **mockup (history) · purpose · layout · content · primary action · states · step**. Sizes are CSS px (`26` §8); copy keys are in §5.6–§5.7.

### 3.1 Home `/` (marketing) · s36, recomposed s46, rebuilt s47
- **Purpose:** the promise in one screen and the way to the example song.
- **Hero (s47): the product is the picture.** The headline **"Bring any song. Practise just your part."**, the lead, **Try an example song** (the page's one filled control) and Sign in (outline), then the practice screen drawn from the kit itself (`practice-still.tsx`): the song map, a tab with chord names over it, the loop on the score, the playhead, the unsure marks, the transport with its key caps, and the Mix panel from 1280 px. It is one image with a text alternative. The tab shows two, four or five bars by width, so its digits never fall under 11 px. Signed-in visitors get "Open your library" in place of the guest pitch.
- **Below the hero:** what it does, made for the music stand, and how a session goes, each as hairline lists (no tiles, no boxes), then a closing section ("Free is a real practice app") with Try an example song and See pricing.
- The s46 gear photos (`apps/web/public/art/home-*.webp`, `docs/home-art.md`) are no longer on the page (open question for the owner, progress log s47).
- **Honesty gates** (the home page never promises what isn't built): unchanged; the gated claims keep their current wording in §5.7.
- **States:** static; LCP is the headline (≤ 2.5 s, `10` §9).

### 3.2 How it works, Pricing, Legal · s36, rebuilt s47
- **How it works:** a title, then the four step links, which mark the step being read with the ink edge (`aria-current`); each step is its own section with its text and a scene of the app at that step, built from the kit. Scene text is real text (it no longer shrinks with the scene on phones), every scene has a text alternative, and the Practise scene is the real transport with the pass question. Then the accuracy note in frequency wording and **Try an example song**. No scroll-driven motion.
- **Pricing:** the demo notice as one quiet line; the title **"Every practice tool is free"** and its lead; Monthly / Yearly as `ChoiceRow`s (the chosen one has the ink edge and a check); **Free** and **Plus** as two hairline columns with the price as a `Stat`, "Your plan" as a `Status`, and one filled control on the page. If prices fail to load the page stays in the marketing shell with Try again and the example song.
- **Legal:** a 72 ch reading column; "On this page" marks the section being read; section heads sit one step above the body text; the date shows its year. An unknown legal page is a 404 inside the marketing shell.

### 3.3 Onboarding `/start` (focus shell) · s36, rebuilt as one page in s47
**Two actions to the first note with the defaults** (it was four): Start practising, then Play or Space. Answers and the chosen song are in the URL (`instrument`, `level`, `song`); old `?step=` links land on the same page.

- **The page** (h1 "Your first song"; Exit → Home for visitors, ‹ Library signed in; no step dots):
  1. **What do you play?** `ChoiceRow`s, Guitar chosen by default; Piano and Drums are disabled rows that say "coming soon" in their name until they have example songs.
  2. **How long have you played?** `ChoiceRow`s, "Just started" chosen by default (sets the defaults of `13` §1).
  3. **The example songs** as `ChoiceRow`s, the suggested one first, labelled "Suggested" and chosen; a song picked by hand stays picked. If the examples fail to load the message says what that means and offers Retry.
  4. **Or bring your own song:** three rows (upload a file, paste a link, record). Visitors are sent to sign up and on to `/library?add=file|link|record`; signed-in learners go straight there.
  5. A sticky bottom bar with the one filled control, **Start practising**, and what it will do ("guitar rhythm · bars 3–6 at 70 %").
- **"Where's your screen?" is no longer a step:** the reading distance starts from the device and is changed in Display and reading (§3.7.4, §3.9).
- **The guide** in the example's practice screen is one quiet line at a time in the page's flow, first above the song map, never over the notation, the transport or a control: what will play ("… Press Play or Space to start.", with "Change song" back to `/start`), then the loop line ("We've looped bars 5–8 at 70 %. Play along."), then the pass line, then "Save progress" after the sheet was dismissed. Each line has "Got it" (`Esc`); a dismissed line stays away.
- **Save** (after the first completed pass, never mid-pass): "Save your progress?" with the sign-up form, a centred dialog from 640 px and a bottom sheet on phones; "Not now" keeps practising.
- **Saved** `/start/saved`: the saved song as a row with "Keep practising"; a failed claim offers Try again as the one filled control; with nothing to claim it says "You're signed in" and that there was no practice on this device to save.

### 3.4 Auth `/auth/*` (auth shell) — `SignIn.dc.html` · s36
Username and password only (`25` §1).
- **Layout (s46):** a single centred column (at most 400 px) on the plain page, no card and no showcase panel. The username and password fields are 52 px tall, a step above the 44 px browse control.
- **Sign in:** h1 "Sign in" · "Welcome back. Enter your username and password." · Username · Password (error under the field with an icon: `auth.wrong_credentials`, which marks both fields; focus moves to the first field with an error) · **Sign in** (primary, 48, full width; it keeps its fill and label while it works) · "or" divider · Continue with Google (only when configured) · "New to Splitune? **Create an account**. No email needed." (a 44 px target) · "By continuing, you agree to our Terms and Privacy policy."
- **Create an account:** as today ("Pick a username and a password. No email needed.", hints, `auth.username_taken`), same layout.
- **Showcase:** removed in s46 (its `auth.showcase_*` keys are retired, §5.7).
- Both continue at `?next=` (same-origin paths only).

### 3.5 Library `/library` (app shell, home) · s34, s39 (progress data), rebuilt s47
A page of hairline lists at `max-w-library` (1080 px); nothing is a card.

1. **h1 "Library"**, then **Continue** with no box: the song (h2), the meta line "{artist} · {part} · clip **{clip}**, bars 25–28 · yesterday, 24 min", the ladder, best clean and first-clean-pass lines as text, the 30-day sparkline with its text alternative, and **Resume practice**, the page's one filled control.
2. **This week:** three `Stat`s (time practised, clean passes, the climb on a clip) and a bar per day whose height is that day's minutes. No streak count, no missed-day wording; hidden when no day of the last seven was practised.
3. **Worth a revisit:** rows (clip, "{song} · 6 days ago · best 65 %"), up to three; hidden on phones.
4. **Songs**, grouped by what each needs: **Getting ready**, **Needs you**, **Ready to practise**. A row (`ListRow`) leads with the instrument's drawing (from 1024 px), then the title (the whole row opens Practice), one meta line "{artist} · {part} · {length}", the state as a `Status` glyph and words with one line that explains it, at most one action (Try again, Re-create stems) and the ⋯ menu (Rename, Analyse again / Analyse with stems + tab, Delete song). On phones the status sits under the title. Offline rows say "Needs connection".
5. **Toolbar:** instrument pills (a menu on phones), the title filter on every width, "Show: …" as its own menu that names the active filter, and Sort. All of it stays in the URL; 24 per page with "Show more". The grid/list toggle and `?view=` are gone: there is one list.
- **States:** the skeleton matches the final layout; the load error and "no results" say what to do; a rename's toast names the new title and offers Undo; the worker-offline line shows when songs are queued. §4.
- A song's music in its row (a small waveform with its sections) is not built: the list has no such data (open question, progress log s47).

### 3.6 Add song (was Import) · s34, rebuilt s47
- **Container:** one block-scrolling column. A dialog on desktop (max 640), a full-screen sheet on phones. Header "Add a song" with "It opens right away. Loops and slow-down work while we analyse." and Close. Opens from Add song (`A` anywhere in the app shell), ⌘K, `?add=`, `/import`, or a dropped file. Focus starts on the chosen tab.
- **Tabs** File · Link · Record (the last one used is remembered).
- **File:** before a pick, the drop zone. After it, the file unboxed: name, "7.4 MB · 3:12", Remove, the waveform preview; warnings that don't block as a glyph and words ("Sounds like a live recording. Separation may be rougher."); blocking problems inline with "Choose another file"; the duplicate notice with **Open it** / Add anyway. Then **Title** and **Artist (optional)**.
- **Link:** the field with Paste; the error shows inline on blur and on submit; "Also download the video" as a switch row with its cost hint; the hint about sites and length.
- **Record:** the explainer before the browser's prompt; then the timer and the input level, unboxed, `R` to start and stop, Count-in and Click switches; the take reviewed as a waveform with Play and Record again. A browser that can't record offers "Use a file" and "Paste a link".
- **Your part** and **Analysis** are `ChoiceRow`s (Hand for guitar and bass stays beside the part). A used-up allowance says "Unavailable" with the reason right under it.
- **Submit is never disabled in advance.** Pressed too early it says what is missing beside the cause and moves focus there (the link field, the drop zone, the file's way out, the allowance, Record).
- **Footer:** "What works best?" · Cancel · **Start practising** ("Use this recording" on Record, "Add and analyse" on Link). Phones show only the primary, full width.
- **States:** cap reached (the limit, the reset date, See Plus; Lite still offered), Welcome available, offline (queues), unsupported or too long; an upload continues after the dialog closes, shown by the upload link in the shell as a `Status`.

### 3.7 Practice `/songs/$songId/practice` (focus shell)
Behaviour per `12`; this section fixes regions, sizes, states and copy. Steps: s35 (core), s37 (Loop/ladder), s38 (Fix), s39 (Progress), s40b (Mix), s41b (sections), s42 (beat pulse), s43 (phone, Stand view, pedal wizard). Rebuilt in s47: the screen is the music and one transport (§3.7.1), and the mockup names below are history.

#### 3.7.1 Regions (wide: 1024 px and up)
```
┌ Top bar 52 ─────────────────────────────────────────────────────────────────────────────┐
│ ‹ Library │ Title / "Artist · Guitar · A minor · 96 BPM"    Tab  Notes  Chords [V]    (? Auto-transcribed · 6 unsure) Aa ⌨ ⋯ │
├ Song map ───────────────────────────────────────────────────────────────────────────────┤
│ [Intro][Verse 1][Pre][Chorus]…  section chips · waveform 40 · loop band · now-line      │
├ Notation (edge to edge) ─────────────────────────────────────┬ Tools panel 340 (closed) ─┤
│ ⌐ Loop · bars 25–28 ¬                                        │ Loop  Mix  Progress  Fix  │
│ TAB  F        C         G         Am?                        │                           │
│      four bars a system, chord names over the tab,           │  (the open tab)           │
│      the loop drawn on the score, a 2 px ink line under      │                           │
│      the bar playing                                         │                           │
│ key row 36: [3] unsure · [5] probably · [0] sounding    Tap two bars to loop · [4] …   As played ▾ │
├ Transport 80 ───────────────────────────────────────────────────────────────────────────┤
│ ⟲R ⏮← ▶Space ⏭→  26.3 / 92 · 1:04 / 3:50   [⟳ L] [Loop · bars 25–28 · Count-in 1 bar]   I ♪  − 75 % S +   Tools X  🔊 │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```
The screen is the music and one transport (s47). Nothing else takes height unless it is asked for: the notation has about 74 % of a 1440 × 900 screen (it had about 40 %).

- **Top bar (52, no rule under it):** "‹ Library" (quiet; "Exit" for visitors) · title (`text-label`) over the part line (`text-caption`, muted): "{artist} · {part} · {key} · {bpm} BPM" (key spelled in the song's own key; "key after chords" while unknown) · centred **view switch** (line tabs with the `V` key cap; per instrument §3.7.5; shown once a notation and chords both exist; while the analysis runs, its `Status` "Analysing 5 of 8 · about 4 min" takes this place) · **legend chip** ("?" in a dashed box + "Auto-transcribed · {n} unsure") · Display ("Display and reading", `Aa`) · Keyboard & pedal · More (⋯: Keyboard shortcuts, Open full editor (desktop, signed in), Keyboard & pedal settings, the song's actions). Every control is quiet at rest, so the music keeps the ink.
- **Song map:** section chips over the overview (s41b; a tap loops that section; the looped section's chip carries a 2 px ink line; absent when there are no sections), the overview (your part's waveform, or the song's before stems; unplayed / played / in-loop bars; loop band with draggable edges and keyboard nudging; now-line), and the ruler only when there are no sections. A tap seeks to the bar's start.
- **Notation, edge to edge:** systems of four bars (two on narrow screens); bar numbers follow the song's own count; chord names sit over the tab; rhythm stems under it; the bar playing has a 2 px ink line under it; the sounding digit is inverted; the loop is drawn on the score as a bracket with its badge "Loop · bars 25–28". Unsure is a dashed box with "?", probably a dotted edge, digits always ink (`26` §5). Tap two bars to loop them (the same bar twice for one bar).
- **Key row (36, under the notation):** samples of the marks drawn as the notation draws them ("unsure", "probably", "sounding"), the loop hint with its key ("Tap two bars to loop · `4` loops four bars from here"; fine pointers from 1024 px), and Level and Capo ("As played ▾"). The key and pedal confirmation shows here (§3.7.4).
- **Chord strip:** only where the paper needs one: the current and next chord for the lanes views, piano's keyboard, the vocal phrases. The Tab view has none, because the chords are over the tab.
- **Transport (80, a hairline above it):** Restart `R` ("Restart loop" while looping, else "From the top") · Previous bar `←` · **Play/Pause** `Space` (64, the one filled circle) · Next bar `→` · position ("26.3 / 92" over "1:04 / 3:50"; from 1280 px) · the pedal's two sides, once a pedal has been pressed ("◀ again · ▶ go" with what each does now; from 1536 px) · centre: Loop on/off `L` and the loop pill ("Loop · bars 25–28 · Count-in 1 bar"; off: "No loop"; it opens the Loop tab), replaced by the pass question after a pass (§3.7.4) · Count-in `I` · Click · speed (− `,` · readout "75 %" over "72 BPM", `S` opens its panel on the typed field · + `.`) · **Tools** `X` · volume. Every control is a 48 px circle or pill; key caps show from 1180 px on fine pointers; a control that is off says why to assistive technology ("after the beat is found").
- **Tools panel (340):** tabs Loop · Mix · Progress · Fix (§3.7.4). **Closed by default.** From 1180 px it docks beside the notation; below that it is a drawer from the right that stops above the transport. It remembers the last tab per device; `?tab=` opens one. `X` opens it on Mix and closes it.
- **Width:** from 1180 px the panel docks and the key caps show; 1024–1179 the panel is a drawer and the row has no key caps; under 1024 px, on any pointer, the transport stacks (§3.7.2). Nothing overlaps or leaves the screen at any width from 320 px.

#### 3.7.2 Other layouts
| Layout | When | Arrangement |
|---|---|---|
| **Phone** | ≤ 640 wide (any pointer), or a touch screen ≤ 640 tall | Top bar 48 (back, the view tabs, Display, ⋯; the title is read out, and Search is in ⋯) · song map (compact) · notation at two bars a system, about 64 % of a 375 × 812 screen · transport in three rows: a **status row** (56: the loop line "Loop · bars 25–28", which opens the Loop tab; the pass question takes its place after a pass; the key and pedal confirmation shows at its end), then Loop · Count-in · speed − "75 %" +, then **Tools** · Previous bar · **Play 64** · Next bar · Restart. No key caps at this width; nothing overflows at 375 px and every control is at least 44 px |
| Phone **Chords** view (glance) | Phone portrait with the Chords view chosen and chords present | The current chord, the beats and the next chords at the reading sizes, in place of the notation. Tab is the default view on every layout (s47) |
| Phone **Tools** sheet | Tools button, the loop line, `X` | A bottom sheet (at most 60 % of the height) that stops above the transport, so Play stays in reach; the same four tabs; Mix opens on the mini-mixer with "All {n} stems". Keys and the pedal keep working while it is open |
| Tablet, and windows 641–1023 wide | Coarse pointer with the shortest side > 640; any window under 1024 px | The panel is a drawer from the right. Under 1024 px the transport is the phone's three rows, centred at most 576 px wide, with the Click and volume added to the bottom row (Tools · Click · Previous bar · **Play** · Next bar · Restart · volume); from 1024 px it is the single row. At the stand, the reading sizes of `26` §6 apply |
| With video (URL import) | The song has a downloaded video | Floating player over the notation's bottom right, closed by default, opened from ⋯ (Larger / Smaller / Hide) |
| `stage` appearance | Stored `stage` | The layout of the device at no less than Music-stand sizes (`26` §2) |

#### 3.7.3 Progressive states (`13` §4) — `Practice-Ready.dc.html`
Practice opens as soon as local playback works. Every finished stage leaves a real artefact and unlocks something; nothing is faked.

| Stage (label) | Artefact shown | Unlocks |
|---|---|---|
| Local upload, or "Downloading" (link) | Waveform from the local file | Play, speed, time-based loops |
| "Reading the audio" | Duration, channels, "sounds like a studio recording" | — |
| "Finding the beat" | "84 BPM in 4/4, starts on a pickup bar"; bar ruler; beat grid | Bar loops, count-in, click, beat pulse |
| "Listening for instruments" | "Guitar, bass, drums, vocals" and the part question | Change the part before separation |
| "Isolating your part", "Preparing the stems" | Separating detail, then stem waveforms | Mix tab and presets |
| "Working out the chords" | Chords, key, sections (when scheduled) | Chords over the tab, Chords view, Level & capo, section chips |
| "Transcribing your part", "Building the tab" | "Every note, with how sure we are"; "Fingerings you can actually play" | Tab / Notes, Fix tab |

- **Getting ready** (in the notation's place while it is empty; no card, no faint staff; s47): the **part question first**, marked by a 2 px ink line on its left: "We hear guitar, bass, drums and vocals." / "Is guitar the part you play?" with **Yes, guitar** (outline, so Play stays the one filled control) and Pick another; then h2 "Getting your part ready" with what is unlocked in words ("You can practise already: the beat is found, so loops, slow-down and count-in work on the original song."), "Analysing your song" + ETA over the overall bar (`role="progressbar"`, `aria-valuetext` = the running stage) and the stage list (a `Status` glyph, the name, a detail line, "Done" / "62 % · ~2 min" / "Waiting"); **Notify me when it's ready** (s44, only where Web Push exists) and "Back to the library". A failed run is an unboxed message with Try again (outline) and Back to the library. On a phone's Chords view a compact form shows the part question, any failure and one status line.
- **What works now:** a `ListGroup` of rows, each a `Status` glyph and a word (Ready · Soon · Later) with "In about 2 min": Loop and slow down · Count-in and metronome · Mixer · Chords and sections · Tab.
- **Top bar while analysing:** a `Status` with the ring that fills, "Analysing 5 of 8 · about 4 min left", in place of the view switch (it truncates in its own column, the ETA is left out on phones, and no ETA shows while the processing machine is offline); song map placeholder "Sections appear when the chords are ready" (only when sections are scheduled); Tools says why Mix is not ready ("after your part is isolated").
- **ETA:** weighted by typical stage times (separation the largest share); a padded range when uncertain ("about 3–5 min"); it changes only when a stage finishes and never sits at 99 %; hidden if a remaining stage has no timing yet.
- **Arrivals** are announced quietly once ("Tab is ready — Show") and never re-lay out the notation under the playhead; the polite live region announces stage milestones only.
- **Piano and drums** fill in the same way (beats, stems, chords) and only the notes arrive last.
- **Failures:** soft-dependency failures leave a usable partial song with the reason in plain words and two choices (Retry · "Practise with chords"); a failed analysis shows the failure card (§3.11); "Processing machine offline. Your song is queued and starts automatically." appears once, with the next step, never as a stalled bar. Every stage can be cancelled from ⋯ ("Stop analysing").
- **Pick another** opens the part chooser and re-runs the analysis for the chosen part from separation on (the existing analysis route with the new instrument); s35 stops and reports if the API can't take a part for a re-run.

#### 3.7.4 Inspector tabs and overlays
- **Loop** (s35, ladder s37, rebuilt s47; `PanelSection`s divided by hairlines, no cards): a heading with the bars and the best pass, and the loop switch with its `L` key cap; **From bar** / **To bar** steppers; length buttons **1 · 2 · 4 · 8** (the current length has the ink edge) with **÷2** and **×2**; **Earlier** and **Next phrase** move the loop by its own length (`⇧←` / `⇧→`); "Fine-tune edges" with the sixteenth-note nudges. **Speed ladder** as a section: the switch, the rungs (done rungs ink-filled, the current one a 2 px ink edge), the summary sentence and what the pass being played does (wording as in s37), and the chips **Start**, **Goal**, **Step**, **{n} clean passes**, **More**, each opening a stepper. Rest (None · 1 beat · 1 bar), Count-in (Off · 1 bar · 2 bars, `I`), and the switch "Ask how each pass went before the next" (`C` / `N`). **Saved clips** are rows, the one playing marked by the ink edge, with a ⋯ menu for Rename and Delete (Undo toasts, no confirm dialog); "Save this loop". Before the beat is found: "Bar loops are ready once the beat is found." Clear loop at the bottom.
- **Mix** (s35, s40b, rebuilt s47): presets as rows with a check (**Your part loud** · **Minus-one** · **Original** · **Rhythm only**, the last only when both stems exist); stem rows in mixer order, "Your part" first as a plain label, "Rough" as a `Status`; each row has a 4 px stem-colour rule beside the name, inverted **M** and **S** toggles at 48 px, a fader and a readout in words ("+6 dB", "Muted", "−6 dB · solo"); **solo dims the other stems and their readout says "Not heard"**. **Helpers** as switch rows: Click (level + switch), Hear the chords; the **master volume**, so phones reach it; Reset mix · "Use as default for {part}". Waiting for stems and stems removed each show a `Status`. A changed mix puts a dot on the tab. The phone sheet opens on the mini-mixer (preset pills, your part and Band with M **and S**, the Click switch, "All {n} stems").
- **Progress** (s39, rebuilt s47, lazy): the clip's name and bars; **today as three `Stat`s** (cold start today · clean passes · minutes); **Last 30 days** as a section, not a box, with the chart (solid ink: best clean pass of the session; dashed with square markers: the first clean pass, cold) and its text alternative; **Sessions** as rows ("Today · 18 min · 14 passes · best 60 %"); the **Warm up with yesterday's hard bars** button on the first session after a day away; the **Weekly goal** switch row "Optional. No streaks, no reminders unless you ask." With no clip selected: the song's clips with their best clean tempo, each row looping it. With passes but no clean one yet: "Mark a pass as Felt clean to see your progress here."
- **Fix** (s38, rebuilt s47): choosing the tab (or `E`, `J`, `K`, or tapping a "?") enters **Fix mode** where the panel docks. The top bar's centre becomes one line, a glyph and "Fixing · every change saves as you go", with Undo and Redo together and **Done** (outline, `Esc`). Unsure marks stay ink with a dashed edge and "?", probably a dotted edge, edited an underline; the selected chip has the ink edge and no wash. The tab: **Spot 2 of 6 · bar 27–28** with previous / next (`K` / `J`); the spot's own section comes first and carries the suggested fix, which **`Y` accepts** (the first alternative, otherwise "It's right"); **chord section** (the guess, "Other likely chords" rows with "Hear … over the loop" and **Use**, outline, so Play is the only filled control; the chord field with a visible label and hint; "Split at beat 3"); **note section** (the note, "or play it as" alternatives, String and Fret steppers, Length, **It's right**, Delete note in the destructive style, Report wrong); **beat fixes** (Half tempo · Double tempo · Move downbeat); **Your edits** with Revert and the "Show original" switch. The pickup is named "Pickup · chord" / "Pickup · note n". The key line under the notation shows ink samples and `J` / `K` / `Y`. Dock in Fix mode: Play, the bars, **Listen to: Original · Your part · Tab synth · Both** (ink edges), speed − / + with `,` / `.`. Toast "Edit saved · bar 31, string 3 → fret 2" + Undo, always above the dock. **Touch layouts** fix in the **editor sheet**: non-modal, above the transport, at most 60 % of the height, with the queue's ‹ › and a visible Close; `E` opens it on the bar playing, `J` / `K` open it on the first unsure spot and then walk the same queue. The copy says "Your fixes are saved for this song" and never implies the model learns from them.
- **Display and reading** (Aa): three hairline groups. **Appearance** (Dark · Light · Follow my device); **Reading** (Where is your screen?: Automatic · Desk · Music stand · Floor; Reading size; Hyperlegible font); **Notation** (Show uncertainty, `U`; Notation follows the music: Page by page · Scrolling · Off; Playhead: Line · Block · Bar; Reduce motion). It fits a 375 px screen. The same controls as Settings → Display & practice.
- **Legend popover** (`26` §5), **Level & capo popover**, **Piano options**, **Melody options**: as today, restyled.
- **Key and pedal confirmation (PedalHud):** one quiet line on `--raised` with a hairline, ≤ 100 ms after the press: "{source} · {action}" ("Key 4 · Loop bars 5–8", "Right pedal · Play", "Key , · Speed 70 %"); 1.2 s; announced politely. It is beside the music and never over it: on the key row just above the single-row transport, and at the end of the status row when the transport is stacked. It ignores the pointer, except "Pedal detected? Set it up", which links to the pedal setup and stays 5 s.
- **Pass question:** after a pass while a loop is active and "Ask how each pass went" is on, the loop's place in the transport (the status row when stacked) asks "Pass {n} at {speed} — how was it?" with **Not yet** `N` and **Felt clean** `C`, in the pedal's order (left again, right go), both outline buttons at 48 px. Nothing floats over the music, and it leaves with the next pass.
- **Count-in:** the beat number at display size in the ink, centred on the notation on `--raised` with a hairline, with "Count-in · beat 3 of 4" under it; a static number under reduced motion. It is the one thing that may sit over the music, and only while it counts.
- **Shortcuts overlay** (`?` on desktop; in ⋯ on every layout, phones included): every key of §3.7.6, grouped and shown as key caps, and one "Set up a pedal" link to Settings → Keyboard & pedal (it replaces a "Learn" button per row).

#### 3.7.5 Instruments
| Instrument | View switch (default first) | Over or beside the notation (s47: there is no Now column; chords sit over the tab, and a strip shows only where the paper needs one) | Inspector notes | Mockup |
|---|---|---|---|---|
| Guitar | Tab · Notes · Chords | Chord + shape, Level and Capo | — | `Main.dc.html`, `Practice-Mix.dc.html` (Chords: a "Shapes in this song" row of chord boxes, Level Simple / As played, "Capo none · sounds in A minor", the chord sheet with section names and bar ranges at the left, four bars a line, beat slashes, the current beat's slash in the ink) |
| Bass | Tab · Notes · Chords | Chord, Level (Root notes / As played) | — | — |
| Piano | Chart · Notes · Staff, plus a **Hands** segmented control (Both · Left · Right; the other hand drawn at 45 %, audio unchanged) | Above the roll: "Now · bar 6" + chord 40 + beats + "Next · in 3 beats" + chord; legend "L left hand · R right hand (quiet)" | **Wait for me** (MIDI keyboard badge; V5) in the dock where Web MIDI exists | `Practice-Piano.dc.html` |
| Drums | Grid · Staff · Chords, plus **Level** (Main groove · Simplified · As played) in the top bar | Above the grid: "Bar 10" + "2 e &" (40, tabular figures) + beats 22; the letter key line | Mix: today the drum stem and the band; per-drum channels ("Kick only", "Drums minus snare") and "Focus the lane I'm learning" need deeper separation and are later scope (not s32–s45). The hint card "Both feet busy? Start and stop with a MIDI pad or the space bar, and turn on 2 bars of count-in." | `Practice-Drums.dc.html` |
| Vocals | Melody · Chords | The phrase strip (as built) | — | — |
| Something else | Chords | Chord | — | — |

#### 3.7.6 Keys and pedal (s47)
Every practice action has a key, the key is printed on its control (fine pointers, from 1180 px), and every press is confirmed in words (§3.7.4). The behaviour is `12` §8; this is what the screen shows.

| Key | Does | Printed on |
|---|---|---|
| `Space`, `Enter` | Play / pause | Play |
| `←` / `→` | Restart the loop, or back a bar / next bar | Previous bar, Next bar |
| `R`, `Home` | From the top (of the loop while one is on) | Restart |
| `1` `2` `4` `8` | Loop that many bars from the bar playing | the key row's hint (`4`) |
| `L` | Loop on / off (no loop yet: the hint on how to pick bars) | Loop |
| `Shift` + `←` / `→` | Move the loop back / forward by its own length | Loop tab |
| `,` / `.` | Slower / faster by 5 % (`Shift`: 1 %) | − and + |
| `Shift` + `5` … `0` | Speed 50 … 90 %, 100 % | the speed panel's presets |
| `S` | Open the speed panel on its typed field: `S`, a number, `Enter` | the speed readout |
| `I` | Count-in: off, 1 bar, 2 bars | Count-in |
| `C` / `N` | Felt clean / Not yet | the pass question |
| `M` | Mute your part | Mix tab |
| `X` | Open the tools on Mix, or close them | Tools |
| `V` | Next view (Tab, Notes, Chords) | the view tabs |
| `U` | Show or hide the uncertainty marks | Display |
| `J` / `K` | Next / previous unsure spot (enters Fix) | Fix tab |
| `E` | Fix the bar playing | Fix tab |
| `Y` | Accept the suggested fix, or "It's right" | Fix tab |
| `[` / `]`, `P` | Previous / next phrase, the phrase's first note (vocals) | the phrase strip |
| `?` | The shortcuts overlay (desktop) | ⋯ |
| `⌘K` / `Ctrl K` | Command palette | search |

- **The pedal has two sides and one rule: left means again, right means go.** Out of the box `PageUp` is the left side and `PageDown` the right (AirTurn mode 3); Settings → Keyboard & pedal learns any other key for either side. What "again" and "go" are follows the moment, and the transport says so once a pedal has been pressed (from 1536 px):

| Moment | Left (again) | Right (go) |
|---|---|---|
| Playing or paused | Restart the loop / back a bar | Play / pause |
| The pass question is up | Not yet | Felt clean |
| Fix mode | Previous unsure spot | Next unsure spot |

- `↑` / `↓` never change speed: until a pedal is set up they show "Pedal detected? Set it up".
- Keys act while a popup that belongs to practice is open (the tools sheet, the bar editor); any other popup, and any text field, owns its keys.
- With single-key shortcuts off (WCAG 2.1.4), letters, digits and `Shift` + digit are inert; `Space`, `Enter`, `Home`, the arrows, `PageUp` / `PageDown` and learned keys keep working.

### 3.8 Edit `/songs/$songId/edit` (desktop)
The full editor, reached from Fix → "Open full editor": the notation with the panel beside it (under it below 1024 px), built from the same Fix sections (chord and note, beat fixes, Your edits with Revert), undo/redo, "Hear original". It uses the practice key map and learned pedals (s47): `J` / `K` and the pedal step through the spots, `Y` accepts, `,` `.` change the speed, `←` `→` select notes, Delete removes the note, ⌘Z / ⇧⌘Z undo and redo; `Esc` first deselects the note, then leaves. Touch devices are redirected to Practice, where the editor sheet does the same.

### 3.9 Settings `/settings/*` (app shell) · s36, rebuilt s47
Layout: `max-w-settings` (880 px); the section list sits beside the content from 768 px and is a scrolling line of tabs on phones, so the h1 stays near the top. A section is an h1, then groups of plain hairline rows (label and hint on the left, the control on the right, wrapping under it on narrow screens). Each field saves on its own and says so.
- **Account:** Profile (Name and Username with their hints, Main instrument as a select, "How long have you played?"). **Plan:** "Demo mode" as intro text; what is left this period as `Stat`s with a link to Usage; on Plus, Manage plan is outline and Cancel Plus is quiet. **Privacy:** export and delete; controls that need a connection say "Unavailable offline" in their names; the export's retry sits inside the failure message; the delete confirmation lists what goes; the re-auth Confirm is never disabled and shows a field error.
- **Usage:** the allowance meters (their tracks edged, so an unused one is visible) with the words beside them.
- **Display & practice** ("Saved on this device" as intro text): Appearance as three `ChoiceRow`s with swatches (Dark · Light · Follow my device; `stage` stays a valid stored id with no row); Increase contrast; Reading (Where is your screen?, Reading size, Hyperlegible font); Notation; practice defaults.
- **Keyboard & pedal:** the test area first; then the actions as rows in `12` §8 order (names wrap), each with its keys, its learned pedal key and **Learn**; while learning, the prompt shows inside that row. The two pedal sides are two of those rows ("Pedal left", "Pedal right"). Single-key shortcuts switch; Reset. The guided pedal wizard is still s43.
- **About:** version and build date; the transcription models folded away in a disclosure; font licences; the provenance register; the personal-mode line.

### 3.10 Billing (bare shell; personal mode `25` §2) · s36, rebuilt s47
- **Upgrade sheet:** a dialog with Close on wide screens, a bottom sheet with Close on phones: "Plus gives you", Monthly / Yearly as `ChoiceRow`s, "Cancel anytime in one tap.", **Continue to checkout** before Not now. If prices fail the benefits stay and Continue says it is unavailable and why.
- **Mock checkout:** the plan summary and **Simulate successful payment** / Simulate declined card / Cancel; no card fields ever. "Declined" offers no dead "Try again". An expired link tells a signed-out visitor to sign in first.
- **Mock portal:** Cancel Plus is outline and only Resume Plus is filled; past due shows the warning glyph; the confirmation line takes focus; the simulations sit in their own section.

### 3.11 System pages, banners, dialogs and toasts — `States.dc.html` · s36
**Look (s47).** A system page (unsupported, 404, error, account deleted) is a plain message at the top of the bare shell's column with no card: a one-sentence h1, one supporting sentence, then one filled control and a text link; where it leads depends on being signed in (the library, or Home and the example song). The error page says what Reload does and that the learner's data is safe. A banner (offline, worker offline, update ready, in-app browser, demo mode) is one quiet line with a `Status` glyph and words, never a tinted bar; its action (Reload) is outline. Toasts sit bottom right (bottom centre on phones), above a bottom bar or the practice transport, on `--raised` with a hairline.

| Item | Content | Action |
|---|---|---|
| Unsupported browser (bare) | h1 "Splitune can't run in this browser" + "It's missing AudioWorklet, which plays your stems in sync. Try a recent Chrome, Edge, Firefox or Safari." (the missing feature named in plain words) + the supported-versions line under Details | Copy link · "Your library is still available" |
| Analysis failed (card in practice and the library) | Icon + h3 by reason ("We couldn't find a steady beat") + the reason's sentence + "This didn't use an analysis." | **Try again** (primary) · the reason's alternative ("Practise with time-based loops") |
| Worker offline banner | "Processing machine offline. Your song is queued and starts automatically." | — |
| Offline banner | "You're offline. Songs you've opened keep working." | — |
| Update ready | "A new version is ready. It waits until you stop playing." | Reload (never during playback) |
| Rough-part banner (practice) | "Your part didn't separate cleanly, so the tab may be rougher." | Show chords instead |
| In-app browser | "Open in your browser for audio and uploads." + platform hint | Copy link · Dismiss |
| iOS install hint (app shell) | "Install Splitune: tap Share, then Add to Home Screen." | Dismiss |
| Screen can't stay on | `practice.screen_tip` | Close |
| Playback interrupted | "Playback paused by another app or a call." | Tap to resume |
| 404 | "404" in tabular figures + "We couldn't find that page." + "The link may be old or mistyped." | Go to library |
| Error boundary | "Something went wrong on this screen." + error id (copyable) | Reload · Go to library |
| Confirm dialog | h3 "Delete “{title}”?" + "Its stems, loops, passes and edits will be removed. This can't be undone." | Cancel · **Delete song** (destructive solid) |
| Rename dialog | "Rename song", Title field ("Enter a title.") | Cancel · Save |
| Delete account | `delete.account_confirm`, then "Confirm it's you" | Cancel · Delete account |
| Toasts | "Edit saved" + Undo · "Renamed." · "Song deleted." · "Analysis started." · "Thanks — this helps" · error "An edit couldn't be saved, so it was undone." (`role="alert"`) | — |
| Empty library | §4 | — |

### 3.12 Command palette (app and focus shells) · s34, restyled s47
The active row is a 1.5 px ink edge and hover is the only fill; song rows lead with the instrument's drawing; Add song shows its `A` key.
`Dialog` with a 52 px field "Search songs, clips and actions" (17 px) + `Esc`; results grouped **Songs**, **Clips** ("Chorus riff · Northbound Lights · bars 25–28"), **Actions**; the typed text bold in results; ↑/↓ move, Enter runs (its `Kbd` shown on the selected row). Actions: Add song · Loop bars {a}–{b} (typed "loop 17-20") · Loop the next {section} (with sections) · switch view (Tab, Notes, Chords…) · Dark / Light / Follow my device · Set up a pedal · Display and reading · Settings sections · Sign out. Each action shows its key where it has one. Add song has no global chord: ⌘/Ctrl N is reserved by browsers (the mockup's "Ctrl N" is dropped). Lazy-loaded.

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
| Dark · Light | The themes (s46; Night Rehearsal and Daylight are retired names) | Dark mode, light mode, Night Rehearsal, Daylight (in copy) |
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
| `appearance.dark` · `appearance.light` · `appearance.dark_hint` · `appearance.light_hint` | Night Rehearsal · Daylight · Dark. Easy on the eyes in dim rooms. · Light. Best in a bright room or outdoors. | Dark · Light · Easy on the eyes in dim rooms. · Best in a bright room or outdoors. (the theme names are retired with the Night Rehearsal look, owner 2026-11-17; `appearance.system` and its hint unchanged) | s46 |
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
| `auth.showcase_title`, `auth.showcase_point_1…3`, `auth.showcase_loop` | (the s36 showcase copy above) | removed: the auth pages have no showcase panel (§3.4) | s46 |
| `home.still_alternative`, `home.still_band`, `home.still_hero_loop`, `home.still_hero_pass`, `home.still_hero_song`, `home.still_label`, `home.still_loop`, `home.still_next`, `home.still_now` | (the copy of Home's product still) | removed: Home has no product still (§3.1); the `home.still_*` keys the How it works stills use stay | s46 |
| `practice.next_in_beat` (new) | — | Next · in 1 beat (the singular of `practice.next_in_beats`, chosen by `nextInBeats` in `features/practice/bar-text.ts` for a count of one) | s46 |
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
`redesign/report.md` (IA, practice regions, keymap, progressive processing, settings, system states, acceptance criteria), `redesign/research/product_inventory.md` (every current screen, state and string), `redesign/research/stem_practice_players.md`, `redesign/research/notation_learning_apps.md`, `redesign/research/practice_science_ergonomics.md`, `redesign/research/ai_confidence_processing_ux.md`; the 25 mockups in `redesign/mockups/` (2026-11-08; historical from s46, no longer the visual source); `docs/home-art.md` and `apps/web/app/features/marketing/home.tsx` for the s46 Home (2026-11-17). Earlier sources stay valid: `research/users/user-journeys-and-flows.md`, `research/ux/onboarding-retention-motivation.md`, `research/ux/learning-science-principles.md`, [Atlassian voice and tone](https://atlassian.design/foundations/content/voice-tone), [GOV.UK error messages](https://design-system.service.gov.uk/components/error-message/), [Apple HIG: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio).
