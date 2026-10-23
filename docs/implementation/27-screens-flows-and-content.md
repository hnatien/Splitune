---
title: Screens, flows and content design
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Screens, flows and content design

What every screen contains, how it is laid out per device, which states it has, and the words it uses. Visual tokens and components come from `26-design-system.md`; behaviour of the practice screen stays in `12-practice-screen-and-notation.md`; import/onboarding mechanics in `13-import-onboarding-and-youtube-embed.md` (+ `25` §4 for URL import); plan rules in `23-plans-free-and-paid.md` §5. Where those docs and this one disagree on **layout, states or copy**, this doc wins; on behaviour, they win.

## TL;DR
- **Four shells:** *marketing* (public pages), *app* (library, import, settings), *focus* (onboarding and practice — no navigation chrome) and *bare* (auth landing, mock checkout, system pages). Navigation is shallow: Library is home; Import is the one primary action.
- **Practice layout change:** on touch devices the **transport moves to the bottom edge** (closest to the hands at a stand, the media/practice-app convention, safe-area aware), with the timeline directly above it and a slim status bar on top. Doc 12 §1 is updated to match.
- **Progressive practice screen:** the practice route opens as soon as local playback works and fills in as artefacts land (beats → stems → chords → tab); every intermediate state has a defined layout (§3.7.3).
- **Every screen has its empty, loading, partial, error and offline states specified** (§4), and every message lives in one catalogue (§5.6) that maps 1:1 to Paraglide keys.
- **Voice: a calm coach** — plain, specific, encouraging, honest about uncertainty, never guilt or hype. Sentence case, numerals, verbs on buttons, "what happened + what to do" in every error.
- **Bars display 1-based** ("Bar 17"); data stays 0-based (`05` §indexing); the pickup shows as "Pickup".

## 1. Information architecture
```mermaid
flowchart LR
  subgraph Marketing[Marketing shell]
    H[/ Home] --- HW[/how-it-works] --- PR[/pricing] --- LG[/legal/*]
  end
  subgraph Focus[Focus shell]
    ST[/start onboarding] --> P[/songs/$id/practice]
  end
  subgraph App[App shell]
    LIB[/library] --> IMP[/import]
    LIB --> P
    LIB --> ED[/songs/$id/edit desktop]
    SET[/settings/*]
  end
  subgraph Bare[Bare shell]
    AU[/auth/*] --- MC[/billing/mock-checkout] --- MP[/billing/mock-portal] --- SYS[unsupported · offline · 404 · error]
  end
  H -->|Try an example| ST
  H -->|Sign in| AU
  AU --> LIB
  IMP -->|local playback ready| P
```

| Shell | Top area | Navigation | Notes |
|---|---|---|---|
| Marketing | 64 px bar: wordmark · How it works · Pricing · Sign in · **Try it free** (primary) | Footer with legal links | SSR; no app chrome |
| App | 56 px bar: wordmark (→ Library) · Library · **Import** (primary) · allowance meter (≥ `md`) · account menu | Phone: same bar, Library/Import as icons + labels, account menu holds the rest | One shell for library, import, settings |
| Focus | Practice/onboarding status bar only; "Back to library" (or "Exit") at top-left | None | Hides nav; Wake Lock on practice |
| Bare | Wordmark only | — | Centred single column, max 480 px |

Account menu: Settings · Plan & billing · Keyboard & pedal · Appearance (inline radio: System/Light/Dark/Stage) · Sign out.

## 2. Key flows (happy paths and where they can branch)
| Flow | Steps (screens) | Target | Branches |
|---|---|---|---|
| First session | Home → `/start` instrument → level → example plays isolated → loop at 70% → (optional) Felt clean → "Save your progress" → sign in | First slowed loop ≤5 min, no account (`13` §1) | Skip to "Import my own song" at any step |
| Sign in | Email → "Check your email" → magic link → Library (or back to where they were) | ≤3 screens | Expired link, Google if configured |
| Import a file | Library/Import → drop or pick → part + analysis type → **Practice opens with local playback** while upload/analysis continue | Playable in ≤5 s after pick (local decode) | Pre-flight warning, duplicate found, cap reached, offline |
| Import a link | Import → Link tab → paste → part + type → progress ("Downloading…" → "Analysing…") in the practice screen | — | Unsupported/blocked link → upload or embed fallback (`25` §4) |
| Record | Import → Record tab → permission → level meter + count-in → record → review → use | — | Permission denied |
| Practise | Library → song → practice (resume state) → tap bars → loop → speed → passes | Resume in ≤1.5 s (cached) | Chords-only banner, rough stems, stems expired |
| Fix a wrong chord/note | Tap chip/note → editor sheet → alternative or edit → saved (optimistic) | 2 taps for a top-k alternative | Offline queue |
| Upgrade | Point of action lock → upgrade sheet → mock checkout → back with Plus | 3 screens | Declined (simulated) |

## 3. Screens
Each spec lists **purpose · layout · content · primary action · states**. Sizes are CSS px (`26` §8).

### 3.1 Home `/` (marketing)
- **Purpose:** explain the promise in one screen and get to the example song.
- **Layout:** hero (headline, one-line subhead, **Try an example song** primary + "Sign in" secondary) beside a live, muted, auto-paused product still of the practice screen on paper (not a stock photo); then three proof rows (Isolate your part · Loop and slow down · Tab that admits when it's unsure) each with a cropped real UI image; then "How a session goes" (4 steps); pricing teaser (Free is a real practice app); footer.
- **Copy:** headline "Learn the songs you love, one loop at a time." Subhead "Bring a song. Splitune isolates your part, shows the chords and tab, and lets you loop and slow down any bar."
- **States:** static; LCP element is the headline (budget ≤2.5 s, `10` §9).

### 3.2 How it works, Pricing, Legal
- **How it works:** the four pipeline steps in plain language, with an honest note on accuracy ("Auto-transcription gets most of a song right and marks the bits it's unsure about").
- **Pricing:** two columns Free / Plus, feature matrix from `23` §3 grouped as Practice (all ✓ for both, shown first), Analyses, Depth; monthly/yearly toggle with neither pre-selected visually emphasised beyond the toggle; "Cancel anytime in one tap". Personal mode banner: "Demo mode — purchases are simulated." No countdowns, no "most popular" badge.
- **Legal:** 72 ch reading column, table of contents, last-updated date.

### 3.3 Onboarding `/start` (focus shell)
| Step | Content | Primary | Notes |
|---|---|---|---|
| 1 Instrument | Five large cards (Guitar, Bass, Piano·v1, Drums·v1, Something else) with icons; v1 ones show "Coming soon — try guitar or bass" | Card tap advances | 2 × 3 grid tablet, list phone |
| 2 Level | "Just started" · "I can play a few songs" · "Coming back after a break" | Card tap | Sets defaults (`13` §1) |
| 3 Where's your screen? | Desk · Music stand · Floor (illustrated with simple line drawings) + "Can you read this?" live sample at the chosen size | Continue | Sets the distance preset (`26` §6.3); skippable |
| 4 Your first song | Example song card (title, "guitar riff", 0:45), **Play your part** | Play | Autoplay only after the tap (HIG) |
| 5 Loop it | Practice screen in focus mode with a coach mark: "We've looped bars 5–8 at 70 %. Play along." | — | Coach marks: max 2, dismissible, never block the transport |
| 6 Save | After the first completed pass: sheet "Save your progress?" Email field + Continue; "Not now" keeps practising | Continue | Never interrupts mid-pass |

Progress dots (1–5) at top with "Step 2 of 5" text; Back always available.

### 3.4 Auth `/auth/*` (bare shell)
- **Sign in:** "Sign in or create an account" · email field · **Email me a link** · Google (if configured) · small print linking Terms/Privacy. One form for both sign-in and sign-up.
- **Check your email:** "We sent a link to {email}. It works for {minutes} minutes." (`MAGIC_LINK_TTL_S` in `apps/api/src/auth.ts`, currently 5 minutes) · "Open Mailpit" link in dev only · Resend (after 30 s) · Use a different email.
- **Landing:** spinner ≤1 s then redirect; errors: expired ("This link has expired. We can send a new one."), used, invalid.

### 3.5 Library `/library` (app shell, home)
- **Layout:** page title "Library" + count; toolbar: search (title), filter chips (Instrument, Status), sort (Last practised · Added · Title), view toggle (grid/list ≥ `md`). Grid of `SongCard`s: 3–4 columns desktop, 2–3 tablet, list on phone.
- **SongCard content:** title (2 lines max), instrument icon + "Guitar", status badge (Ready · Partial · Analysing 2/5 · Queued · Chords only · Stems expired · Failed), last practised ("3 days ago"), best clean tempo ("Best 85 % on bars 17–20"), overflow menu (Rename, Analyse again/Upgrade to Full, Delete). The whole card opens practice.
- **Header extras:** `AllowanceMeter`; `WorkerStatus` banner when the Mac worker is offline and something is queued.
- **States:** empty (§4), loading (6 skeleton cards), analysing (inline `StageList` compact: current stage name + ETA), stems expired ("Re-create stems" action, keeps loops), failed (reason + Retry; "This didn't use an analysis").

### 3.6 Import `/import` (app shell)
- **Layout:** tabs **File · Link · Record** (remember last used); right/below: "Your part" (instrument select, defaults to profile) and **Analysis** radio cards: *Full — your part isolated + tab* (shows allowance) / *Lite — beat and chords, fast*; then the primary button.
- **File:** large drop zone (whole page accepts drops) with "Drop an audio or video file, or **choose a file**" and the formats/limits line ("MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 minutes"). After pick: file row with waveform preview (local decode), duration, pre-flight result chips ("Sounds like a live recording — separation may be rougher"), duplicate notice ("You already have this song — open it").
- **Link:** URL field with paste button, "Also download the video" switch (on by default), supported-sites hint.
- **Record:** permission explainer before the browser prompt; input level meter; count-in toggle + optional click; big Record (practice size) → timer → Stop → review with playback → **Use this recording** / Record again.
- **Primary:** "Start practising" (file/record: goes to practice immediately with local playback; upload continues in the background with a progress pill in the status bar) / "Import and analyse" (link).
- **States:** cap reached on the chosen type (inline lock with the exact limit and reset date + Upgrade, Lite still offered), offline ("You're offline. We'll start the upload when you're back." queues), unsupported file, too long.

### 3.7 Practice `/songs/$songId/practice` (focus shell)
Behaviour per `12`; this section fixes regions, sizes and progressive states.

#### 3.7.1 Regions (tablet landscape, the primary layout, e.g. 1180 × 820)
```
┌ Status bar 56 ────────────────────────────────────────────────────────────┐
│ ‹ Library   Song title · Guitar        [Loop · bars 17–20 · pass 3]  ⚙ ⋯ │
├ Chord strip 88 ───────────────────────────────────────────────────────────┤
│   Am   │  F   │ [ C ] │  G?  │  Am  │                      ConfidenceLegend │
├ Notation (paper, flex) ────────────────────────────────┬ Mixer drawer 320 ┤
│   2–3 systems of tab, page-flip by bar group           │ (overlay; closed  │
│   loop bars shaded, current bar ruled, now-line         │  by default)      │
├ Timeline 104 ──────────────────────────────────────────┴───────────────────┤
│ bar ruler · loop band · waveform lanes (my part + mix) · unsure-bar hatch  │
├ Transport 96 (+ safe area) ───────────────────────────────────────────────┤
│ [⟲ restart] [▶ play 64] [⟳ loop]   [− 70 % · 84 BPM +]   [count-in] [metronome] [mix] │ [Felt clean] [Not yet] │
└───────────────────────────────────────────────────────────────────────────┘
```
- Transport: practice targets 64 px for restart/play/loop/speed −/+ and the pass pair; 48 px for count-in, metronome, mixer, view. Pass pair appears at the right end only while a loop is active (fades in after each pass per `12` §5).
- Status bar: song title truncates; loop badge mirrors loop state for distance reading; ⚙ opens Display (appearance, score surface, distance, font, uncertainty toggle); ⋯ opens shortcuts, edit on desktop, export (v1).
- `PedalHud` appears centred over the notation, 1.2 s.

#### 3.7.2 Other layouts
| Layout | Arrangement |
|---|---|
| Tablet portrait | Status bar · video (if any, 16:9, ≥200 px tall) · chord strip · notation (1–2 systems) · timeline · transport (two rows if < 820 px wide: transport row + speed/pass row) |
| Phone landscape | Status bar 48 · chord strip enlarged · notation 1–2 bars with now-line · single transport row (play, loop, speed −/+, pass pair); timeline collapses to a 32 px ruler with the loop band |
| Phone portrait | **Glance view** by default: current chord (`--read-chord-current`), next chord, bar.beat, loop badge, speed; transport at bottom; "Show tab" toggle |
| Desktop | Status bar · chord strip · notation (wider systems, scroll) · timeline · transport bar; editor opens as a right side panel 400 px; `?` opens the shortcuts overlay |
| With local video (URL import) | Tablet landscape: video left 40% / notation right 60%, or "Notation over video" toggle (scrim `--hud-bg`, notation on dark score); portrait: video on top |
| Stage | Same regions; chrome hidden except transport and loop badge; reading sizes +1 step |

#### 3.7.3 Progressive states (`13` §4)
| Available | Chord strip | Notation | Timeline | Transport / mixer | Banner |
|---|---|---|---|---|---|
| Local audio only (uploading) | Hidden | Placeholder on paper: "Tab will appear here as soon as it's ready" + `StageList` | Waveform from local decode, seconds ruler, loop by drag/time fields | Play, speed, loop (time-based); no count-in; mixer hidden | Status pill "Uploading 42 %" |
| + beats | Hidden | Same placeholder, bar numbers appear | Bar ruler; bar-snapped loops; count-in/metronome enabled | + count-in | — |
| + stems | Hidden | Same | Lanes per stem | Mixer appears with the "Is this your part?" audition chip | "Is this your guitar? [Yes] [Wrong instrument]" (once) |
| + chords | Shown | Chord-only sheet (bars with chord names) | — | — | — |
| + tab | Shown | Tab (or chords-only per `recommended_view`) | Unsure-bar hatching | — | Chords-only banner when applicable |
| Failed stage | Reason inline where that layer would be | — | — | — | "Stems are unavailable right now; chords and beat are ready." + Retry later |

Layers fade in (200 ms, `--ease-enter`; instant under reduced motion) without shifting the transport.

#### 3.7.4 Overlays
- **Mixer drawer:** `StemRow` per stem, "Your part" first; presets at top; master volume; "Reset mix". Phone: bottom sheet at 70% height.
- **Editor sheet:** header "Bar 12 · beat 3"; for chords: top-k alternatives as large chips with frequency text, "Type a chord" field (Harte-validated), "Split at this beat"; for notes: string/fret steppers, duration, delete; **Hear this bar** (original mix) / **Hear the tab**; "Report wrong" (secondary, with "Thanks — this helps" confirmation); Undo in the toast.
- **Speed popover:** slider + presets + "Speed trainer" (v1) entry.
- **Display popover (⚙):** Appearance (System/Light/Dark/Stage), Score (Paper/Match), Distance (Desk/Stand/Floor) + calibration slider, Hyperlegible font, Show uncertainty, Reduced motion (follows system by default), Left-handed diagrams.

### 3.8 Edit `/songs/$songId/edit` (desktop-first)
Two-pane: notation (wide, scroll) + inspector (selected bar/note/chord properties, alternatives, corrections history with revert per op). Toolbar: undo/redo, selection mode, "Hear original", zoom. Keyboard-first; touch devices are redirected to practice with the editor sheet.

### 3.9 Settings `/settings/*` (app shell)
Left nav (desktop/tablet) / list (phone): **Profile** (name, instrument, level, handedness) · **Display & practice** (same controls as the Display popover + default speed, count-in bars, rest between repeats, sound delay ±150 ms for Bluetooth headphones) · **Keyboard & pedal** (binding table from `12` §8 with "Learn this pedal" per row, test area, reset) · **Plan & billing** (plan, allowances with reset dates, renewal date, Manage → mock portal, Cancel) · **Privacy** (Download my data, Delete account, training opt-in) · **About** (versions, licences/provenance link).
Each section saves per field with inline "Saved" confirmation (no global save button).

### 3.10 Billing (bare shell; personal mode `25` §2)
- **Upgrade sheet** (from a lock): "Plus gives you" list (from `23` §3), monthly/yearly price cards (no default emphasis), "Cancel anytime in one tap", **Continue to checkout**.
- **Mock checkout:** persistent banner "Demo mode — no real charges"; plan summary; three buttons: **Simulate successful payment** (primary), Simulate declined card, Cancel. No card fields, ever.
- **Mock portal:** plan, renewal date, Cancel at period end (one tap, then confirmation text — no "are you sure" loop), Resume, Switch monthly ↔ yearly, Simulate payment failure, Simulate refund.
- **Return states:** success ("You're on Plus. 15 full analyses a month, resets {date}."), declined ("The (simulated) payment was declined. Nothing was charged."), cancelled.

### 3.11 System pages and banners
| Page/banner | Content | Action |
|---|---|---|
| Unsupported browser (bare) | "Your browser can't run Splitune's audio engine." + which feature is missing (AudioWorklet / WebAssembly SIMD) in plain words + supported browsers list | "Your library is still available" link |
| In-app browser banner | "Open in your browser for audio and uploads." | Copy link / Open in browser (platform hint) |
| Offline banner (app) | "You're offline. You can keep practising songs you've opened." | — |
| Worker offline (`WorkerStatus`) | "Processing machine offline — your song is queued and will start automatically." | — |
| 404 | "We couldn't find that page." | Go to library |
| Error boundary | "Something went wrong on this screen." + error id (copyable) | Reload · Go to library |
| Update available (SW) | "A new version is ready." | Reload (never mid-practice: deferred until playback stops) |

## 4. States catalogue
| Screen | Empty | Loading | Partial | Error | Offline |
|---|---|---|---|---|---|
| Library | "Your library is empty. Import a song you want to learn, or start with an example." **Import a song** · Try an example | Skeleton grid | Cards with stage progress | Inline: "We couldn't load your library." Retry (cached cards stay) | Cached songs shown, others dimmed with "Needs connection" |
| Import | Drop zone | Decode spinner on the file row | Upload progress row | Per §5.6 | Queue message |
| Practice | — | Skeleton of regions; "Loading your song…" after 1 s | §3.7.3 | Per-layer inline reasons | Cached stems play; uncached: "This song isn't saved for offline yet." |
| Settings | — | Field skeletons | — | Inline per field | Read-only with notice |
| Edit | "Select a bar to edit it." | Skeleton | — | Inline | Edits queue ("Saved on this device") |

## 5. Content design
### 5.1 Voice
**A calm coach who knows music.** Plain words, short sentences, specific numbers, honest about uncertainty, encouraging without hype.

| Do | Don't |
|---|---|
| "We're not sure about bars 12–14 — they're marked with ?" | "Our AI perfectly transcribes any song!" |
| "Best clean pass: 85 %. Try 90 %?" | "🔥 You're on fire! Don't break your streak!" |
| "You've used this month's Lite analyses. They reset on 1 Dec." | "Oops! Limit reached. Upgrade now!" |
| "Pick up where you left off: bars 17–20 at 80 %." | "You haven't practised in 3 days." |

### 5.2 Terminology (use exactly these words in UI)
| Term | Meaning | Avoid |
|---|---|---|
| Song | An imported track in the library | Track, file, project |
| Part | The instrument the learner practises ("your part") | Target, stem (in user copy) |
| Stem | One separated layer in the mixer | Channel, track |
| Mix | The balance of stems; presets "Your part loud", "Minus-one", "Original" | Levels |
| Loop | The active repeating range | A–B, cycle |
| Clip | A saved, named loop | Bookmark, region |
| Pass | One time through the loop; "clean pass" when marked Felt clean | Rep, attempt (in UI) |
| Speed | Playback rate as % of the original | Tempo (except BPM readout) |
| Analysis | Full or Lite processing; "Welcome analysis" for the free first Full | Credit, token, job |
| Auto-transcribed | Machine-made notation | AI-generated, perfect |
| Unsure | Low-confidence marking | Error, wrong |

### 5.3 Style rules
- Sentence case for everything, including buttons and titles. Product names keep their case (Splitune Plus).
- Buttons are verbs naming the outcome: "Start practising", "Delete song", "Email me a link" — never "Submit", "OK", "Yes".
- Numerals always; non-breaking space before units: "70 %", "84 BPM", "−3 dB" (U+2212 minus), "0:45" (m:ss), "1:02:10" over an hour. Speed always as % first, BPM second.
- Bars: 1-based in UI and URLs ("bars 17–20" with an en dash); "Pickup" for bar −1; beats 1-based ("Bar 12, beat 3").
- Dates: "1 Dec", "1 Dec 2027" when not this year; relative for recent ("3 days ago") up to 7 days.
- No exclamation marks except success that the user caused ("You're on Plus!") — at most one per screen. No emoji in UI copy.
- Errors never blame ("you did X wrong") and never show raw codes; technical detail behind "Details".
- Accessible names match visible labels (WCAG 2.5.3); icon-only buttons use the verb ("Play", "Restart loop").

### 5.4 Message formula
**What happened** (one sentence) + **what it means for you** (optional) + **what you can do** (action buttons). Example: "We couldn't read this file. It may be damaged or in a format we don't support. [Try another file] [Record yourself]".

### 5.5 Motivation and progress UI
- Show competence evidence: best clean tempo per clip, tempo history per clip (last 30 days), "first clean pass at 85 %".
- Goals are user-set and weekly ("Practise 3 days this week" is optional, editable, never a default daily quota).
- No streak counters, leaderboards, badges, confetti, loss-framed notifications or red notification dots. Missed days are never mentioned.
- Reminders (opt-in) are neutral: "Your loop on bars 17–20 is ready when you are."

### 5.6 Message catalogue (source of truth; Paraglide keys `area.situation`)
| Key | Copy | Actions |
|---|---|---|
| `import.unreadable` | We couldn't read this file. It may be damaged or in a format we don't support. | Try another file · Record yourself |
| `import.too_long` | Songs up to 20 minutes are supported. This one is {duration}. | Choose another file |
| `import.too_large` | Files up to 500 MB are supported. | Choose another file |
| `import.speech` | This sounds like speech, so results may be poor. | Continue anyway · Cancel |
| `import.live` | This sounds like a live recording. Parts may separate less cleanly — we'll mark rough results. | Continue · Cancel |
| `import.duplicate` | You already have this song. | Open it · Import anyway |
| `import.offline` | You're offline. We'll start the upload when you're back. | — |
| `import.url_unsupported` | We can't import from this link. Try uploading the audio file instead. | Upload a file |
| `import.url_failed` | We couldn't download this video (it may be private, removed or blocked in your region). | Upload a file · Use the video with manual sync |
| `import.url_broken` | Link import is temporarily broken. Upload a file instead. | Upload a file |
| `record.permission_denied` | Splitune needs your microphone to record. You can allow it in your browser's site settings. | Try again |
| `analysis.queued_offline` | Processing machine offline — your song is queued and will start automatically. | — |
| `analysis.eta` | About {minutes} min left | — |
| `analysis.stems_unavailable` | Stems are unavailable right now; chords and beat are ready. This didn't use an analysis. | Retry later |
| `analysis.failed` | We couldn't analyse this song. This didn't use an analysis. | Try again · Details |
| `analysis.wrong_instrument` | Is this your {instrument}? | Yes · Wrong instrument |
| `practice.chords_only` | We're not confident in the note-level tab for this song — showing chords. | Show tab anyway |
| `practice.rough_stem` | This stem may contain bits of other instruments. | — |
| `practice.legend` | Auto-transcribed — may contain errors (v{model}) | Show uncertainty |
| `practice.stems_expired` | The stems for this song were removed after 180 days unused. Your loops and edits are safe. | Re-create stems |
| `practice.not_offline` | This song isn't saved for offline yet. | — |
| `practice.beat_off` | Metronome off the beat? | Half tempo · Double tempo · Move downbeat |
| `practice.pass_prompt` | How was that pass? | Felt clean · Not yet |
| `practice.best_tempo` | Best clean pass: {pct} % | — |
| `practice.screen_tip` | This browser can't keep your screen on. If it turns off while you play, choose a longer auto-lock time in your device's display settings. | Close |
| `plan.cap_lite` | You've used this month's {limit} Lite analyses. They reset on {date}. You can keep practising every song you already have. | See Plus · Not now |
| `plan.welcome_available` | Your first full analysis is free — your part isolated, plus tab. | Use it now |
| `plan.cap_full` | Full analyses are part of Plus. You've used your free Welcome analysis. | See Plus · Use Lite instead |
| `plan.allowance` | {left} of {limit} Lite analyses left · resets {date} | — |
| `billing.demo` | Demo mode — no real charges. | — |
| `billing.declined` | The (simulated) payment was declined. Nothing was charged. | Try again |
| `billing.cancelled_at_period_end` | Plus stays active until {date}. Then you'll be on Free — nothing you've made is removed. | Resume Plus |
| `auth.link_sent` | We sent a link to {email}. It works for {minutes} minutes. | Resend · Use a different email |
| `auth.link_expired` | This link has expired. We can send a new one. | Send a new link |
| `system.offline` | You're offline. You can keep practising songs you've opened. | — |
| `system.unsupported` | Your browser can't run Splitune's audio engine ({missing}). | See supported browsers |
| `system.in_app_browser` | Open in your browser for audio and uploads. | Copy link |
| `system.error` | Something went wrong on this screen. | Reload · Go to library |
| `library.empty` | Your library is empty. Import a song you want to learn, or start with an example. | Import a song · Try an example |
| `delete.song_confirm` | Delete “{title}”? Its stems, loops and edits will be removed. This can't be undone. | Delete song · Cancel |
| `delete.account_confirm` | Delete your account and everything in it? This can't be undone. | Delete account · Cancel |

Pipeline `reasons` codes (`05`) map to `analysis.reason.{code}` keys with the same formula; unknown codes fall back to `analysis.failed`.

**Codes from the contracts → keys.** The UI renders by code only; `ErrorEnvelope.message` (English, user-safe) is for logs and API clients, never shown as-is.

| Contract code | Key | Copy |
|---|---|---|
| `ViewReason.notes_unavailable` | `practice.reason.notes_unavailable` | Note-level tab isn't available for this song — showing chords. |
| `ViewReason.notation_not_supported` | `practice.reason.notation_not_supported` | Tab for this instrument isn't supported yet — showing chords. |
| `ViewReason.rough_stem_low_conf` | `practice.reason.rough_stem_low_conf` | Your part didn't separate cleanly, so the tab is unreliable — showing chords. |
| `ViewReason.low_confidence` | `practice.chords_only` | (above) |
| `invalid_input` | `error.invalid_input` | Some details aren't right. Check the highlighted fields. (field issues inline from `details`) |
| `unauthenticated` | `error.unauthenticated` | Your session has ended. Sign in again to continue. |
| `forbidden`, `not_found` | `error.not_found` | We couldn't find that. It may have been deleted. |
| `conflict` | `error.conflict` | This changed somewhere else. Reload to see the latest version. |
| `file_too_large` · `too_long` · `unsupported_media` | `import.too_large` · `import.too_long` · `import.unreadable` | (above) |
| `url_unsupported` · `url_download_failed` | `import.url_unsupported` · `import.url_failed` | (above) |
| `analysis_cap_reached` | `plan.cap_lite` / `plan.cap_full` by `details.type` | (above) |
| `rate_limited` | `error.rate_limited` | Too many tries in a short time. Try again in {seconds} s. (`retry_after_s`) |
| `pipeline_unavailable` | `analysis.queued_offline` | (above) |
| `internal_error` | `system.error` | (above) |
| `rights_warranty_required`, `taken_down` | — | Dormant in personal mode (`25` §8) |

## Implementation notes (step 10, 2026-10-22)
- The catalogue lives in `apps/web/messages/en.json` (Paraglide keys = the keys above). Added for step 10's screens: navigation/shell, home, how it works, legal, auth, library, import, upload, stages, settings and system keys, plus `analysis.reason.{tagger_unavailable, chords_unavailable, notes_on_mixture, beats_fallback, separation_fallback, video_unavailable, too_long, audio_empty, beats_not_found}`, `import.{quiet, clipping, mostly_silent}`, `auth.link_invalid`, `upload.{choose_again, choose_file, wrong_file}`. Every step-09 machine code maps to copy in `apps/web/app/lib/reasons.ts` (unknown → `analysis.failed`). The copy-key test (`app/copy-keys.test.ts`) checks the §5.6 keys, every key the code uses, and that screens hold no hard-coded strings.
- **Magic-link landing:** Better Auth reports expired, already used and unknown links all as `INVALID_TOKEN`, so they share `auth.link_expired`; a visitor who is already signed in (e.g. clicked the link twice) goes straight on. Other errors show `auth.link_invalid`.
- The "Check your email" step stays on `/auth/sign-in` (component state) so the address never appears in a URL.
- Library: the phone layout is always the list; "Last practised" shows `last_opened_at`. Practice (provisional): stage list with ETA, worker-offline status, fallback banners, upload pill in the status bar.

## Implementation notes (step 12, 2026-10-22)
- Practice layouts as built, chosen by feature queries (`app/features/practice/layout.ts`): desktop = fine pointer at any width; coarse pointer → phone portrait (≤ 640 px wide, portrait; glance view by default with "Show tab"), phone landscape (≤ 640 px tall; compact ruler), else tablet landscape/portrait. Video layout when the song has a video; Stage on top of any of them. Stage chrome: transport, loop badge and ⚙ (the way back out of Stage); song title, part and ⋯ hidden. The evening Stage hint appears once.
- Focus shell "Back to library" is icon-only below `sm` (name kept for assistive tech).
- Design QA (28 §5) screenshots: Light, Dark, Dark + match, Stage × tablet landscape 1180×820 (touch), phone portrait 390×844 (touch), desktop 1440×900, from the `Screens/Practice` Ready story. Fixed from it: status bar overflow on phones (⚙ and ⋯ off-screen), the audition banner squeezing its text, instrument label and ⋯ showing in Stage.

## Implementation notes (step 13, 2026-10-22)
- **Onboarding as built:** steps 1–3 in the focus shell with `StepDots` ("Step n of 5") and Back; instrument and level are `ChoiceCard` buttons (Piano/Drums focusable, `aria-disabled`, "Coming soon — try guitar or bass"); the screen step is a radio group that applies the distance preset live, with the "Can you read this?" sample on paper at the reading sizes; Skip restores the previous preset. Step 4 is a dialog over the example's practice screen; step 5 keeps the practice screen with `CoachMark`s placed just above the timeline (over the score, never over a control or the transport). The save sheet is a bottom `Drawer` shown once a pass is complete and playback has stopped; "Not now" leaves a "Save progress" button.
- New kit pieces with stories: `ChoiceCard`, `StepDots`, `CoachMark`, `BassIcon` (`ui/icons/bass.tsx`). New copy keys: `start.*` (steps, coach marks, save, saved, next), `system.update_ready`, `system.install_ios`.
- **Design QA (28 §5):** every `/start` step, the song card, the loop and the save sheet at 390×844 touch and 1180×820 touch, Light and Dark: no horizontal overflow, no page errors; axe clean in E2E (all engines) and in the stories. Found and fixed: coach marks covered the chord strip/legend (tablet) and "Show tab" (phone). Seen, not fixed (step 12's chord strip): with many chords the chips run over the confidence legend on a 1180 px tablet.

## Implementation notes (step 14, 2026-10-22)
- **Screens as built:** `/pricing` (demo banner, Free and Plus cards, monthly/yearly as equal choice cards with monthly chosen instead of a toggle, the §3 matrix grouped Practice/Analyses/Depth with allowances from the API), upgrade sheet (bottom drawer: Plus benefits, the same choice cards, "Cancel anytime in one tap.", Not now / Continue to checkout), `/billing/mock-checkout` and `/billing/mock-portal` (one route `/billing/$view`, bare shell, demo banner, simulate buttons; expired-link state), Settings → Plan & billing (plan, renewal/end date, past-due line, full or Lite allowance meter, Welcome status, one-tap Cancel/Resume, Manage → portal, See Plus; checkout return states via `?checkout=success|cancelled`). The app-shell meter shows Plus' full allowance ("12 of 15 full analyses left · resets 22 Nov"), Free's Lite allowance as before.
- Locks only where the learner acts: Import (Full/Lite caps with See Plus and Use Lite instead; the `plan.welcome_available` prompt with Use it now), Library "Analyse with stems + tab" on a Lite song (lock icon; Free opens the upgrade sheet).
- New catalogue keys: `plan.cap_full_plus` ("You've used this period's {limit} full analyses. They reset on {date}. You can keep practising every song you already have."), `plan.see_plus`, `plan.not_now`, `plan.use_lite`, `plan.use_it_now`, `plan.plus_*`, `plan.monthly|yearly|price_month|price_year|interval|cancel_anytime|continue_checkout|prices_failed`, `pricing.*` (matrix rows, groups, CTA), `billing.*` (checkout/portal/settings lines). `library.upgrade_full` now reads "Analyse with stems + tab". `analysis_cap_reached` maps `welcome` → `plan.cap_full`, `full` → `plan.cap_full_plus`, `lite` → `plan.cap_lite`.
- Design QA (28 §5) from Storybook screenshots of every billing story at 390×844 touch, 1180×820 touch, 1440×900 (Light and Dark) and 320 px: no page errors, no overflow from billing content; fixed the pricing card footers, the header meter width for the longer Plus text and the phone matrix columns. The 320 px overflow of the app-shell story wrapper (account button + story padding) is pre-existing.

## Implementation notes (step 15, 2026-10-22)
- **Settings → Privacy as built:** training opt-in Switch with per-field "Saved"; "Download my data" (Prepare my data → "Preparing your file…" with the worker-offline notice → "Your file is ready. The link works until {date, time}." + Download / Prepare a new file; failed and unavailable states); "Delete my account" (destructive outline button → AlertDialog with `delete.account_confirm` → Delete account; a stale session gets "Confirm it's you" + Email me a link → `auth.link_sent`). Offline: read-only notice. After deletion: bare page `/account-deleted`. New keys `privacy.*`; `settings.coming_privacy` removed; `legal.privacy.delete_body` updated. Stories for every state (Screens/Settings, Screens/System, Screens/Practice → Stems expired).
- **Design QA (28 §5)** on the Privacy states and the account-deleted page: 390×844 touch, 1180×820 touch, 1440×900 × Light/Dark/Stage — no overflow, no page errors; fixed the re-auth action's emphasis (primary). 320 px shows the pre-existing 31 px app-shell story overflow.
## Implementation notes (step 15a, 2026-10-22)
- **Practice status bar on phones** (< 640 px wide): the song title is screen-reader-only (as in Stage), so the loop badge — the thing read from the stand — keeps its words ("Loop · bars 5–6" was truncated to "L…" beside the title). Phone landscape (wider than 640 px) keeps the title.
- **Practice loading (§4):** the skeleton has the regions every layout has — paper, timeline (hidden in Stage), transport at the bottom edge — and "Loading your song…" (`practice.loading`) after 1 s. The chord strip is not skeletoned: it only exists once chords do, and the transport never moves when it appears.
- **Practice offline (§4):** when the audio can't load while offline, the banner reads `practice.not_offline` instead of the generic `practice.audio_failed`.
- **Glance view:** before the first downbeat it shows "Pickup" (§5.3) instead of "Bar 0.4".
- **PedalHud for every key:** Felt clean / Not yet / Loop with no loop answer "No loop — tap two bars"; Mute your part before stems exist answers "Stems aren't ready yet" (`practice.hud_no_stems`).
- **Analysing placeholder:** the notation placeholder scrolls with nothing focusable in it, so it is a focusable region named by its own text (axe `scrollable-region-focusable`, WCAG 2.1.1).
- **Not built (logged in PROGRESS):** Settings → **About** (§3.9); Library offline state "others dimmed with Needs connection" (§4) — needs to know which songs' stems are cached, which is the v1 offline work (step 20).
- Settings stories render the real section list (`features/settings/settings-layout.tsx`, shared with the route); How it works, Legal and the magic-link landing moved to `features/` and got stories (Screens/Marketing, Screens/Auth/LinkExpired|LinkInvalid), as did the offline and in-app-browser banners (Screens/System).
- `delete.song_confirm` uses typographic quotes (as built since step 10); the copy-key test now checks each §5.6 copy, not only the key.

## Implementation notes (step 17c, practice redesign, 2026-10-23; owner-approved deviations from §3.7)
Approved by the owner from a mockup after a competitor review (Songsterr, Soundslice, Ultimate Guitar, Guitar Pro 8, Moises, Chordify, Fender Play, Yousician, Transcribe!, Capo): tab as the hero, chords aligned to bars, video tucked away, one slim transport.
- **Regions (§3.7.1), every layout:** status bar · notices (one slim stack, absent when empty) · paper (chord strip over the tab or chord sheet) · song overview (48 px) · transport. The overview replaces the 104 px timeline: your part's waveform (the song's audio before stems), small bar ruler, loop band with handles, unsure hatching, now-line; the other stems are in the mixer. It shows in Stage too. Phone landscape keeps the 32 px compact ruler.
- **Status bar:** title and "Guitar · 96 BPM" (screen-reader-only on phones and in Stage); a dashed chip "Auto-transcribed · v{model}" (`practice.legend_short`, icon alone below `md`) that opens the legend and "Show uncertainty" (26 §5); a **Tab / Chords** switch (Chords = the chord sheet; on phone portrait the glance view, still its default) shown once both exist; the **video** toggle when a URL import has a video; ⚙; ⋯. The chip, switch and toggle load with the bar (route budget). **The loop badge moved to the transport.**
- **Chord strip:** on the paper. The current chord at `--read-chord-current` on the current-bar wash with its guitar shape (lazy `ChordShape`), an arrow, then the next six chords as plain names (outline only when unsure); level and capo behind one button at the end (`ScoreTools` popover). Chord names also sit above the bars in the tab (`buildTab({ chordNames: true })`, low-confidence ones with "?").
- **Transport:** restart and a 72 px round play (icons only with tooltips, 26 §11); the loop group (toggle joined to the "Loop · bars 17–20 · pass 3" badge, which opens the loop's options); the speed capsule (−/+ icons only); count-in, metronome, mix (labels from `xl` and at Stand/Floor); the pass pair pinned to the right edge with "How was pass N?" (`practice.pass_question`) while prompting. The controls wrap among themselves; phones use the 48 px secondary size and two rows (restart/play/loop, then speed + icon-only ✓/↺).
- **Video (§3.7.2 "With local video"):** no split column and no "notation over video". A floating player over the paper's bottom-right corner, closed by default, opened from the status bar, with Larger/Smaller and Hide.
- **Popovers:** `PanelSection`s are separated by hairlines instead of sunken tiles (a segmented track on a sunken tile disappeared). `OptionSegments` items size to their labels and wrap inside a rounded track. Loop options are rows (label · bar field · nudge ‹ ›) with a hint line; Display shows the reading size value beside its label. Mixer drawer 352 px: presets are a vertical list, and each stem card stacks name / fader / M S + dB by its own width (container query, one row from 42 rem).

## Implementation notes (step 17d, piano practice, 2026-10-23; owner-approved from a mockup)
Research (pianists' reading habits: lead sheets/chord charts for pop adults, eye–hand span ≈1 s, iReal Pro and Soundslice keyboards; full list in PROGRESS) → mockup canvas → owner "Looks good, build the chord-chart redesign. Piano note transcription can come later as its own step."
- **Paper (piano, no notes yet):** the **chord chart** (`piano-chart.tsx`, served from the chord-sheet chunk) replaces the bar grid: four bars to a line between barlines (two per row in narrow containers), a chord written once where it changes, over its beat, beat slashes in every bar, "N.C." once per silent run, bar numbers at line starts and the loop start. Loop: fill, top rail, 2 px edges at A and B. Current bar on `--bar-current`, its beat's slash in ink, a playhead gliding on the audio clock (steps by beat under reduced motion). While playing, the current line is kept second from the top (smooth scroll; a jump under reduced motion). Bars are buttons named from their own text ("Bar 3, A♭maj7, B♭7, Unsure").
- **Chord strip (piano, not phone landscape):** "Now · bar N" with the current chip and beat dots (the next change's beat dashed); a keyboard C2–C5 with the voicing (left hand bass, right hand chord, L/R on keys and in the caption, middle C labelled; drawn empty under N.C. so nothing moves); "Next · in N beats" (or "next beat", or "bar N" beyond 8 beats) with the next chip and a small keyboard (wide strips); "Then" two names (widest strips); **Piano options** at the end (Chords: As played / Simple (triads); Voicing: Smooth / Root position; Show hands: Both / Right only), icon-only in narrow strips, hidden in Stage.
- **Spelling:** every chord name (strip, chart, tab, editor alternatives) follows the song's key (`keyNoteNames` in the music Worker: the scale's letters, minor's raised leading tone, the key's accidental style elsewhere). The status bar's part line names the key: "Piano · E♭ major · 120 BPM".
- **Glance view (phone portrait):** the voicing keyboard under the current chord for piano.

## Implementation notes (step 18, piano notes, 2026-10-23; owner chose the roll over the grand staff)
- **Status bar:** piano gets **Chart / Notes** (chart first) wherever guitar has Tab / Chords; analytics `view_changed` gains `notes`. **Notes is the default** once the notes pass the quality gate (`recommended_view` `roll`); below it the chart stays, with the banner "We're not confident in the notes for this song — showing the chord chart." and **Show notes anyway**. Phone portrait keeps the glance view.
- **Paper (Notes):** the roll over a full-width keyboard: two bars in view above the now line (the median bar, so tempo wobble doesn't change the speed); sounding keys lit with L/R; the keyboard's accessible name says what is sounding ("Sounding now: Left hand B♭2 E♭3, Right hand F4", notes in the song's key, low to high). Reduced motion: the roll turns a bar at a time and only the playhead moves. A click on the roll taps that bar (A then B loops, as on the chart); keyboard users loop from the loop panel.
- **Chord strip over the notes:** chords, beats and Piano options stay; the voicing keyboards are hidden (the roll has its own).
- Loads on demand through the chord-sheet chunk: the practice route grew 103 B (139 B left).

## Implementation notes (step 18b, guitar and bass Notes, 2026-10-24; owner chose the tab-lane direction)
- **View switch (§3.7.1):** guitar and bass read **Tab / Notes / Chords** once the tab exists (Notes reuses `practice.view_notes`); session-only like piano's (`view: 'notes'`); Tab stays the default. `view_changed` sends `notes`.
- **Notes (§3.7.3 paper):** the neck at the left (34 % of the paper, 200–440 px; 38 % on phones), the lanes to the right of its hit line, one bar of look-ahead. A tap on the lanes arms the bar under it, a second tap loops (as on the tab); the loop panel, keys and pedal work unchanged; notes are edited from the editor sheet and the edit page, as from the tab.
- **Phone landscape (§3.7.2):** the chord strip gives way to the lanes; the chord now and next sit over the neck. Phone portrait keeps the glance view.
- **Copy:** `practice.notes_now` "{bar}: {chord}; {notes}" with `practice.fret_position` "string {string} fret {fret}" (the neck's accessible name, e.g. "Bar 12: Am; string 2 fret 1, string 3 fret 2", changed at most once a second while playing, at once when paused); `practice.fret_shift` "Fret {fret}" on the shift cue.
- Not built: a "low string on top" option (Rocksmith's order); 5-string bass and 7-string guitar draw from `tuning_midi`, but the Worker has no tuning option yet, so only the stories show them.

## Open questions
- Bottom transport on tablets: confirm with the first usability round (reach from playing position vs. glare from the hand over the screen).
- Whether to show the Display/distance step in onboarding or defer it to the first practice session (one fewer step vs. legibility from minute one).
- Glance view as the phone-portrait default vs. tab-first for bassists who read tab on phones (P3).

## Sources
Cross-linked: `users/user-journeys-and-flows.md` (Journeys 1–2, alternate flows A–C), `ux/onboarding-retention-motivation.md`, `ux/learning-science-principles.md` (P9 motivation, P10 gamification), `ux/hands-busy-and-device-context.md`, `ux/practice-tool-patterns.md`, `market/competitor-landscape.md`. Competitor UI audit (2026-10-20): [Soundslice speed training/loop help](https://www.soundslice.com/help/en/player/basic/286/speed-training/), [Moises help](https://help.moises.ai/hc/articles/8472666994076-Welcome-to-Moises-Here-are-some-pointers-to-start-Mobile-App-), [Chordify review (GuitarChalk)](https://www.guitarchalk.com/chordify-review/), [Guitar World on Yousician](https://guitarworld.com/reviews/yousician-review), [Melodics streaks](https://support.melodics.com/en/articles/6777043-what-are-streaks) — tier 2–3. Motivation: Silverman & Barasch, *JCR* 2023 on broken streaks ([summary](https://www.colorado.edu/business/faculty-research/2023/04/19/or-track-how-broken-streaks-affect-consumer-decisions)); Hanus & Fox 2015 ([summary](https://pmc.ncbi.nlm.nih.gov/articles/PMC8916940)) — tier 1. Content: [Atlassian voice and tone](https://atlassian.design/foundations/content/voice-tone), [Atlassian error messages](https://atlassian.design/foundations/content/designing-messages/error-messages), [GOV.UK error message component](https://design-system.service.gov.uk/components/error-message/) — tier 2, accessed 2026-10-20. [Apple HIG: Playing audio](https://developer.apple.com/design/human-interface-guidelines/playing-audio) (no autoplay).
