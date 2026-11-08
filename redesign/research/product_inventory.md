# Splitune web app: functional inventory for the redesign

This covers what each screen does, holds and shows, and its states. Visual rules are left out. It comes from the route files, `features/**`, `ui/**`, `messages/en.json`, contracts, `docs/status.md`, and specs 12, 13, 21, 23, 25 and 27 (only the IA/flows/states/copy parts of 27). Where the code and the specs disagree, the code wins and I flag the gap.

Main paths (all under `D:\Projects\Splitune\`):
- Routes: `apps\web\app\routes\`
- Screens: `apps\web\app\features\<area>\`
- Reusable widgets: `apps\web\app\ui\`
- Copy: `apps\web\messages\en.json` (about 890 keys)
- Data: `packages\contracts\src\`
- Screen and state spec: `docs\specs\27-screens-flows-and-content.md` (its implementation notes at the bottom record how things were actually built)

---

## 1. Locales and tone

- **There is one locale: English.** `apps\web\project.inlang\settings.json` has `baseLocale: "en"`, `locales: ["en"]`, and `<html lang="en">`.
  - The app uses Paraglide; keys are named `area.situation` (e.g. `practice.loop_badge`).
  - A copy test (`apps\web\app\copy-keys.test.ts`) blocks hard-coded strings in screens.
  - Chord names are treated as notation and never translated.
- **Voice: "a calm coach who knows music"** (spec 27 §5):
  - Plain words, short sentences and real numbers. It is honest about uncertainty and encouraging without hype.
  - Sentence case everywhere. Buttons are verbs naming the outcome ("Start practising", "Delete song"), never "OK" or "Submit".
  - Numerals with a non-breaking space before the unit: "70 %", "84 BPM", "−3 dB" (true minus sign).
  - Speed is shown as % first and BPM second.
  - Bars are 1-based in the UI ("bars 17–20"); the bar before the first downbeat is "Pickup".
  - Dates read "1 Dec"; anything within 7 days is relative ("3 days ago").
  - No emoji. No exclamation marks except a success the user caused.
  - Errors follow "what happened + what it means + what you can do", never blame the user, and never show raw codes.
  - No streaks, badges, confetti or guilt about missed days.
- **Fixed terms** to use in mocks: Song, Part ("your part"), Stem, Mix (presets "Your part loud", "Minus-one", "Original"), Loop, Clip (a saved, named loop), Pass and "clean pass", Speed, Analysis (Full / Lite / "Welcome analysis"), Auto-transcribed, Unsure (for low confidence).
- **Representative strings:**
  - Home headline: "Learn the songs you love, one loop at a time."
  - Loop badge: "Loop · bars 17–20 · pass 3"
  - Pass prompt: "How was pass 3?" with "Felt clean" / "Not yet"
  - Best tempo: "Best clean pass: 85 %"
  - Legend: "Auto-transcribed — may contain errors (v0.4.0)"
  - Chords-only fallback: "We're not confident in the note-level tab for this song — showing chords." with "Show tab anyway"
  - Cap reached: "You've used this month's 5 Lite analyses. They reset on 1 Dec. You can keep practising every song you already have."
  - Worker offline: "Processing machine offline — your song is queued and will start automatically."

---

## 2. Screen list

### Shells
- **Marketing shell:**
  - Top bar: wordmark, How it works, Pricing, Sign in (or "Library" when signed in), "Try an example song".
  - Phones: everything except the wordmark sits behind a "Menu" button.
  - Footer: How it works, Pricing, Terms, Privacy.
- **App shell** (`features\shell\app-shell.tsx`):
  - Top bar: wordmark (goes to Library), Library, **Import** (the primary action), Settings, the upload pill, the account menu.
  - Phones: brand mark, upload pill and account menu in the top bar, plus a bottom tab bar (Library / Import / Settings).
- **Account menu:**
  - The username as a label (the email for a Google-only account).
  - Links: Settings, Plan & billing, Keyboard & pedal.
  - Appearance choice: System / Light / Dark / Stage.
  - Help: How it works, Pricing, Terms, Privacy.
  - Sign out.
- **Focus shell** (onboarding, practice, edit): a slim status bar with "Back to library" (or "Exit" to Home for visitors; icon only on phones), the page's own status content and the upload pill. No navigation. Keeps the screen awake on practice.
- **Auth shell:**
  - Wordmark and a form column.
  - From `lg` up, a showcase beside it: "Learn the song one part at a time." with three points and stills of the practice screen.
- **Bare shell:** wordmark and one centred column (mock billing, system pages).
- **Banners every shell shows** (`features\system\system-banners.tsx`):
  - Offline: "You're offline. You can keep practising songs you've opened."
  - "A new version is ready." with Reload. It is held back while audio plays.
  - iOS install hint, app shell only, dismissible: "Install Splitune: tap Share, then Add to Home Screen."
  - In-app browser: "Open in your browser for audio and uploads." with a hint, "Copy link" (becomes "Link copied") and Dismiss.

### Routes
| Route | File |
|---|---|
| `/` Home | `features\marketing\home.tsx` |
| `/how-it-works` | `features\marketing\how-it-works.tsx` |
| `/pricing` | `features\billing\pricing-page.tsx` |
| `/legal/terms`, `/legal/privacy` | `features\marketing\legal-page.tsx`, `legal-content.ts` |
| `/auth/sign-in`, `/auth/sign-up` | `features\auth\sign-in.tsx` |
| `/library` | `features\library\*` |
| `/import` | `features\import\*` |
| `/settings` (goes to `/settings/profile`), `/settings/display`, `/settings/keyboard`, `/settings/billing`, `/settings/privacy` | `features\settings\*`, `features\billing\billing-settings.tsx` |
| `/start` | `features\onboarding\onboarding-page.tsx` |
| `/start/saved` | `features\onboarding\saved-page.tsx` |
| `/songs/$id/practice` | `features\practice\*` |
| `/songs/$id/edit` | `features\practice\edit-page.tsx` |
| `/billing/mock-checkout`, `/billing/mock-portal` | `routes\_bare\billing\$view.tsx` |
| `/unsupported` | `features\system\unsupported.tsx` |
| `/account-deleted` | `features\system\account-deleted.tsx` |
| 404 and error page | `features\system\error-page.tsx` |

### Home (`/`)
- **Hero:**
  - Badge "Free to try, no account needed", the headline, and a subhead ("Bring a song. Splitune isolates your part, shows the chords and tab, and lets you loop and slow down any bar.").
  - Buttons: **Try an example song** and Sign in.
  - A still of the practice screen with a caption: bars 5–8 looping at 70 %, with the unsure chord and notes marked.
- **Three proof sections**, each with a label, title, body and three points:
  - "Isolate your part": mixer with separate faders and mute/solo.
  - "Loop and slow down": tap two bars, 50 % without changing pitch, best speed per loop.
  - "Tab that admits when it's unsure": dashed outlines and "?", tap for alternatives, fixes stay with the song.
- **"Made for the music stand"**, six features:
  - count-in that follows the band
  - pedal / keyboard shortcuts
  - readable from where you sit
  - Stage mode for dark rooms
  - works offline
  - progress without nagging
- **"How a session goes"**, 4 steps: Bring a song → Pick your part → Loop the hard bars → Speed up as it gets clean.
- **Pricing teaser:** "Free is a real practice app", with Try an example song and See pricing.
- **States:** static, server-rendered.

### How it works (`/how-it-works`)
- Intro, then a "Steps" overview linking to four steps: Bring a song / We isolate your part / We find the beat, chords and tab / You loop and slow down.
- Each step has text plus an inert picture:
  - Import: Upload / Record / Paste a link, a file row "riff-in-a-minor.mp3 3:12 · 7.4 MB", Uploading → Uploaded → "Reading the audio" → "Ready to analyse".
  - Separating: full mix splits into stems.
  - Transcribing: Beat, Chords, Tab.
  - Practice: "Loop · bars 5–8 · pass N".
- Closes with a card: "How accurate is it?" and **Try an example song**.

### Pricing (`/pricing`)
- "Demo mode" banner, title and intro.
- **Free card:** "No charge", a short body, and "Try an example song".
- **Plus card:** Monthly / Yearly shown as two equal choice cards (monthly pre-chosen), with prices from the API. Default config is $9.99 a month and $79.99 a year.
  - The button depends on the visitor: "Get Plus" for Free accounts (goes to checkout); signed-out visitors are sent to sign-in first; Plus members get "Manage your plan".
- **Feature matrix:**
  - Practice (both plans): loops and saved clips, slow to 50 %, count-in and metronome, mixer, chords/tab/corrections, level toggle, keyboard and pedal, examples, unlimited library.
  - Analyses: Welcome analysis "1 per account" on Free; Full "15 a month" on Plus; Lite "5 a month" on Free and "Unlimited (fair use)" on Plus; extra instrument and priority processing on Plus only.
  - Depth: mic scoring, offline, export, all "Coming soon" on Plus.
- **States:** loading; "We couldn't load the prices."

### Legal (`/legal/terms`, `/legal/privacy`)
- A reading column, "On this page" table of contents, "Last updated {date}".
- Terms sections: The service / Your songs / Accuracy / Payments (simulated) / Leaving.
- Privacy sections: What we keep / Where it lives / On your device / Deleting.

### Sign in and Create an account (`/auth/sign-in`, `/auth/sign-up`)
- **Sign in:** "Sign in", "Welcome back. Enter your username and password.", Username, Password, **Sign in**, "New to Splitune? Create an account".
- **Create an account:** "Create an account", "Pick a username and a password. No email needed.", Username (hint "3–30 letters, numbers, dots or underscores."), Password (hint "At least 8 characters."), **Create account** (signs you in at once), "Already have an account? Sign in".
- Both pages:
  - "Continue with Google" under an "or" divider, only if Google is configured.
  - Small print: "By continuing, you agree to our Terms and Privacy policy."
  - `?next=` returns the visitor where they were.
- **Errors:**
  - Under each field: "Enter your username.", "Enter your password.", and the invalid-format versions.
  - From the server: "That username and password don't match.", "That username is taken. Try another.", rate limit "Too many tries in a short time. Try again in {seconds} s.", and the generic system error.
- There is no email or magic link anymore.

### Onboarding (`/start`)
- Progress dots with "Step n of 5" and Back on every step. The answers live in the URL, so Back and reload keep them.
- **Step 1, "What do you play?":**
  - Guitar, Bass and Something else are selectable.
  - Piano and Drums are shown but disabled with "Coming soon — try guitar or bass" (there is no example song for them yet, although the practice screen supports both).
  - There is no Vocals card.
- **Step 2, "How long have you been playing?":** Just started / I can play a few songs / Coming back after a break.
- **Step 3, "Where's your screen?"** (skippable):
  - Hint: "We'll size chords and tab so you can read them from where you play."
  - Radio cards: Desk ("Laptop or desktop, about half a metre away"), Music stand ("Tablet on a music stand, about 75 cm away"), Floor ("Phone on the floor or a chair, a metre or more away").
  - The choice applies at once; a "Can you read this?" sample shows chords Am and F and tab "0 2 2 1 0".
  - Continue / Skip (Skip restores the previous setting).
- **Step 4, "Your first song":**
  - For a visitor, a dialog over the example's practice screen: song card (title, then artist · part such as "guitar riff" · length), **Play your part** (reads "Getting your part ready…" while loading), and Back.
  - For a signed-in user, a page that first copies the example into their library, then opens it.
  - Errors: "We couldn't load the example songs." with Retry; "Example songs are on their way…" when there are none.
- **Step 5, the loop:** the practice screen, pre-set from the answers:
  - loop on the suggested bars, starting speed 70 % (just started) or 80 %, the "Your part loud" mix, and a level (simplified for guitar beginners, root notes for bass beginners, chords only for "Something else");
  - at most two coach marks placed above the timeline: "We've looped bars 5–8 at 70 %. Play along." and "After each pass, tap Felt clean or Not yet. Splitune keeps your best clean speed.", each with "Got it".
- **Save sheet:** after the first completed pass, once playback stops, a bottom sheet "Save your progress?":
  - "Your loop and passes are on this device. Save them to an account to keep them."
  - The sign-up form with a link to switch to sign-in.
  - "Not now" closes it and leaves a "Save progress" button on screen.
- **`/start/saved`:**
  - States: "Saving your progress…", then "Your progress is saved" ("{title} is in your library with your loop and passes.") or "You're signed in."; error "We couldn't save your progress. It's still on this device." with Try again.
  - Then a card "Next: a song you want to learn": Import a song / Record yourself / Keep practising.
- Visitor progress is kept on the device and claimed automatically at sign-in.

### Library (`/library`)
Covered in section 5.

### Import (`/import`)
Covered in section 4.

### Practice (`/songs/$id/practice`)
Covered in section 3.

### Edit (`/songs/$id/edit`, desktop only; touch devices are redirected to practice)
- **Status bar:** song title, Undo, Redo, a Select switch "Notes / Bars", and "Hear this bar" (disabled until a bar is chosen).
- **Two panes:**
  - Left: the notation (tab), wide. Click a note or bar to select it.
  - Right: an inspector that shows the bar editor (same content as the editor sheet in section 3), or "Select a bar to edit it." when nothing is selected.
- **"Your edits":** every change, newest first ("Changed a chord", "Split a chord", "Changed a note", "Deleted a note", "Moved the downbeat", "Changed the tempo grid", "Reported as wrong", and so on), each with a Revert button.
- The transport bar sits at the bottom.
- **Keys:** ←/→ select the previous or next note (or bar), Delete/Backspace removes the selected note, Space plays or pauses, ⌘/Ctrl Z undoes, Shift+⌘/Ctrl Z redoes.
- The zoom control mentioned in spec 27 §3.8 is not built.

### Mock checkout (`/billing/mock-checkout`)
- Banner "Demo mode — no real charges."
- "Checkout" title and a plan card: plan name, price, and "Plus renews automatically until you cancel. You can cancel anytime in one tap."
- Buttons: **Simulate successful payment**, Simulate declined card, Cancel.
- **States:**
  - Declined: "The (simulated) payment was declined. Nothing was charged." with Try again.
  - Failure: "That didn't work. Try again."
  - Expired session: "This page has expired. Start again from Plan & billing." with "Go to Plan & billing".
  - Loading skeletons; "We couldn't load the prices."
- There are never any card fields.

### Mock portal (`/billing/mock-portal`)
- Demo banner and "Manage Splitune Plus".
- Plan card: plan name, "Renews on {date}" or "Ends on {date}", and a past-due line when relevant.
- Actions:
  - Cancel Plus (or Resume Plus), confirmed in one line with no "are you sure" step.
  - Switch to yearly / Switch to monthly.
  - A "Simulations" section: Simulate payment failure, Simulate refund.
  - "Back to Plan & billing".
- **Confirmation lines:**
  - Cancel: "Plus stays active until {date}. Then you'll be on Free — nothing you've made is removed."
  - Resume: "Plus is back on. It renews on {date}."
  - Switch: "You're now on {plan}. The new price applies from your next renewal on {date}."
  - Payment failure: "The (simulated) payment failed. Plus stays active for now, and we've emailed you."
  - Refund: "The (simulated) refund was issued."
- Expired session state, as on checkout.

### System pages
- **Unsupported browser:**
  - "Splitune can't run in this browser"
  - "Your browser can't run Splitune's audio engine ({missing})." The missing piece is named in plain words: "AudioWorklet, which plays your stems in sync" and/or "WebAssembly SIMD, which slows music down without changing the pitch".
  - The supported browsers list, and a "Your library is still available" button.
  - Practice and edit redirect here when those features are missing.
- **404:** "We couldn't find that page." / "The link may be old or mistyped." / Go to library.
- **Error page:** "Something went wrong on this screen." / "Error id: {id}" / Reload / Go to library / "Copy error id" (becomes "Error id copied").
- **Account deleted:** "Your account was deleted" / "Everything in it is being removed now. You can start again with a new account at any time." / "Go to the home page".

---

## 3. Practice screen in depth

### Regions and layouts
The page is exactly the viewport height. From top to bottom:
1. Status bar
2. A slim stack of notices (absent when there are none)
3. The "paper": a chord strip over the notation (or the glance view)
4. Song overview timeline
5. Transport, at the bottom edge on every layout

Layouts are picked by pointer type and size (`features\practice\layout.ts`):
- **Desktop:** any mouse pointer, any width.
- **Phone portrait** (touch, ≤640 px wide): the glance view by default.
- **Phone landscape** (touch, ≤640 px tall): compact 32 px ruler instead of the overview.
- **Tablet landscape / portrait:** everything else on touch.
- **Stage** (a dark appearance) can sit on top of any layout. It hides the title, part line, ⋯, and the level and piano options buttons, and keeps ⚙ and the transport.

### Status bar (`status-bar.tsx`, `status-controls.tsx`)
- Song title and a part line, e.g. "Guitar · E♭ major · 96 BPM" (the key is spelled in the song's own key). On phones and in Stage this text is for screen readers only.
- **Legend chip** "Auto-transcribed · v{model}" (dashed outline; icon only below `md`). It opens a popover with:
  - "Auto-transcribed — may contain errors (v…)"
  - a key: "Probably" = dashed outline, "Unsure" = dashed outline plus "?"
  - a "Show uncertainty" switch.
- **View switch,** shown once chords and a notation both exist. Options depend on the instrument:

  | Instrument | Views (default first) |
  |---|---|
  | Guitar / bass | Tab / Notes / Chords |
  | Piano | Chart / Notes / Staff (Notes is the default once quality passes) |
  | Drums | Grid / Staff / Chords |
  | Vocals | Melody / Chords |

- **Video toggle,** only for a link import that downloaded its video.
- **⚙ Display popover** (`display-popover.tsx`):
  - Look: Appearance (System / Light / Dark / Stage); Score (Paper / Match appearance).
  - Reading: "Where is your screen?" (Automatic / Desk / Music stand / Floor); "Reading size" slider 80–140 % in 10 % steps; "Hyperlegible font" switch; "Show uncertainty" switch.
  - Motion and layout: Reduce motion (Follow system / On / Off); Tab layout (Page by page / Scrolling).
- **⋯ popover:**
  - Desktop: "Keyboard shortcuts" and "Open the editor" (signed-in users only).
  - Always: a link to Keyboard & pedal settings.
  - Export is not built.

### Transport (`transport-bar.tsx`)
- **Position:**
  - Restart button: "Restart loop" while looping, otherwise "Back a bar" (goes to the previous bar if within 0.5 s of a bar start).
  - A large round Play/Pause.
- **Loop group:**
  - Loop on/off toggle (key L). With no loop yet, pressing it shows the hint "No loop — tap two bars".
  - Joined to it, the loop badge: "No loop — tap two bars" / "Loop · from bar 17, tap the last bar" (one bar tapped) / "Loop · bars 17–20" / "Loop · bars 17–20 · pass 3".
  - The badge has states off, armed, active and resting, and opens the Loop popover.
- **Speed:**
  - − / + buttons step 5 % (Shift-click steps 1 %).
  - The readout "70 % · 84 BPM" opens a slider (1 % steps) plus presets 50 / 70 / 85 / 100 %. From the widest breakpoint the presets also sit inline.
  - **The practice range is 50–100 %** (clamped in code). The URL accepts 25–200 and the Settings starting speed allows 25–100.
  - Keys ↓ / ↑ change speed by 5 %.
- **Helpers** (not on phones):
  - Count-in toggle and Metronome toggle, both disabled until the beat grid exists.
  - Mix toggle (opens the mixer), disabled until stems are loaded.
- **Master volume** (not on phones): mute button, slider 0–100 %, "80 %" readout. Saved per device.
- **Pass pair** at the right edge, only while a loop is active:
  - "Felt clean" (C) / "Not yet" (N).
  - The question "How was pass N?" appears after each pass.
  - "Best clean pass: N %" shows underneath; a new best draws a tick.
  - Screen readers hear "Pass 3 done at 70 %. How was it?"
- **Phones:** two rows (restart/play/loop, then speed with icon-only ✓ / ↺).
  - **Phones have no count-in, metronome, mix or volume controls in the transport, and no level/capo or piano options.** The only access is through keys or the loop popover (count-in bars). This is a real gap for the redesign.

### Loops
- **Ways to make a loop:**
  - Tap bar A, then bar B on any notation view or the chord sheet. Tapping the same bar twice loops one bar. Loops are always snapped to bars and handle the pickup bar.
  - "Loop this bar" button in the glance view.
  - Numeric fields in the Loop popover.
  - Drag the loop band handles on the timeline (snaps to bars; arrow keys on a handle nudge it).
  - Vocals: tap a phrase marker, or press L with no loop to loop the phrase being sung.
- **Loop popover** (`loop-panel.tsx`):
  - Bars: "From bar" / "To bar" number fields (earlier / later steppers), each edge with ‹ › buttons that move it by a sixteenth note (hint "‹ › move that edge by a sixteenth note.").
  - Before the beat is found: "Bar loops are ready once the beat is found."
  - "Between repeats" (only with a loop): Rest between repeats (None / One beat / One bar); Count-in (Off / 1 bar / 2 bars); switch "Ask how each pass went before the next" (pauses after each pass until answered).
  - "Save clip": a name field (up to 100 characters) and a Save clip button.
  - "Clear loop".
  - "Saved clips": a list of named clips ("name · Bars 17–20"). Tap one to load it.
- **Clips:** the active loop is auto-saved as an unnamed clip (one is reused) so it survives a reload. Each clip stores its rest, count-in bars and best clean tempo.
  - **There is no UI to delete or rename clips** (beyond saving a name). The API supports delete.
- **Pass tracking:** each pass marked Felt clean / Not yet is recorded with its speed. The best clean tempo per clip updates and appears in the transport and on the library card.
  - Practice sessions (start/end, input mode touch / keyboard / pedal / mixed) and pass attempts sync from an on-device queue.
  - **There is no history, chart or progress screen.** The API endpoint for per-clip attempt history exists but is unused. Spec 27 §5.5 wants tempo history per clip (last 30 days), "first clean pass at 85 %", optional weekly goals and opt-in neutral reminders; none of that is built.

### Count-in and metronome
- Both follow the detected beat grid and need it to exist.
- Count-in bars: 0 or 1–2 in the UI (the data model allows up to 4); default 1.
- During a count-in, a large beat number appears centred on screen.
- The metronome is a click sound only. **There is no visual or haptic metronome (V9).**
- **"Metronome off the beat?"** lives in the editor sheet, with Half tempo / Double tempo / Move downbeat (each is a correction to the beat grid).

### Mixer (`mixer-drawer.tsx`)
- A right-side drawer about 352 px wide on tablets and desktop; a bottom sheet at 70 % height on phones (though phones currently have no button to open it).
- **Presets** in a vertical list, each with a one-line description:
  - Your part loud: "Your part louder than the rest"
  - Minus-one: "Your part muted — you play it"
  - Original: "The song as it was recorded"
- **Stem cards.** The MVP has **two channels only:** your part (labelled with the instrument and a "Your part" tag) and "Backing" (the song minus your part).
  - Each card has Mute, Solo, and a volume fader with a dB field (−30 to +6 dB) plus Quieter / Louder.
  - A "Rough" tag with "This stem may contain bits of other instruments." when the separation is poor.
- "Reset mix", and the default mix is part 0 dB with backing −6 dB.
- Key M mutes or unmutes your part ("Your part muted" / "Your part on"; "Stems aren't ready yet" if there are none).
- Per-instrument faders are not built; the home page copy promises separate faders for guitar, bass, drums, vocals and keys. Step s30 plans drum-piece channels (e.g. "Kick only", "Drums minus snare") and lane focus.

### Parts and views per instrument
- The part is fixed per song at import. **There is no part switching or extra-instrument UI in practice**, although "Extra instrument on a song" is listed as a Plus feature. The "Is this your guitar? [Yes] [Wrong instrument]" check after stems arrive (spec 27) is not built.
- **Guitar:**
  - **Tab** (default): chord names above the bars, low-confidence ones with "?". Markers 8va/8vb ("Played an octave higher/lower than recorded") and "!" for notes that can't be placed on the neck.
  - **Notes:** a neck on the left with lanes flowing into it; it lights the fingers sounding now and shows the next shape faintly.
  - **Chords:** a chord sheet of bars with their chords.
  - Chord strip: the current chord large with its chord shape diagram (mirrored for left-handed players), an arrow, then the next six chords. At the end a "Level and capo" button opens Level (Chords only / Simplified / As played) and Capo 0–12. The capo changes shapes only, not the sound.
- **Bass:** Tab / Notes / Chords as for guitar. Level: Root notes / As played. No capo.
- **Piano:**
  - **Chart:** a lead sheet with four bars to a line, beat slashes, and "N.C." for no chord.
  - **Notes:** falling notes onto a keyboard, keys lit with L/R for each hand.
  - **Staff:** a grand staff with the sustain pedal drawn.
  - Piano strip: "Now · bar N" with the current chord and beat dots, a keyboard showing the voicing (left hand / right hand), "Next · in N beats" with a small keyboard, and "Then" two more chords.
  - Piano options: Chords (Simple (triads) / As played), Voicing (Smooth / Root position), Show hands (Both / Right only).
  - The analysis status stays on screen until the notes arrive, then everything opens at once.
  - A song whose average note confidence is below 0.80 opens on the Chart with a banner and "Show notes anyway".
- **Drums** (behind the off-by-default `v1.drums` flag):
  - **Grid:** five lanes (Cymbals, Hi-hat, Toms, Snare, Kick). Guesses and medium/low-confidence hits are hollow and dashed; the lowest add "?". A key explains letters: "o open hi-hat · p pedal hi-hat · C crash · R ride · H M L F high, mid, low, floor tom".
  - **Staff** and **Chords** views.
  - Level: Main groove / Simplified / As played. No editing of drum hits.
- **Vocals:**
  - **Melody:** a note roll with phrase markers, plus **Chords**.
  - Phrase strip: "Phrase n of N" with its letter (A′ for a repeat) and bars; "Starts on" a note with its scale degree; "First note" plays the starting pitch; "Next · in n beats"; Range; a phrase loop button; Guide vocal On / Quiet / Off; Melody options (note labels: Names / Scale degrees / None; pitch range shown: Follow the phrase / Whole song).
  - Keys: [ and ] for previous/next phrase, P to hear the first note.
- **Other ("Something else"):** chords only.
- **Glance view** (phone portrait default): current chord, its guitar shape or piano voicing, the next chord, bar.beat (or "Pickup"), "Loop · Bars 17–20 · 70 %", and "Loop this bar".

### How confidence is shown
- **Never by colour alone.** Medium confidence = lighter ink plus a dashed outline; low = the same plus a "?" glyph.
- Applies to chord chips, tab digits, notes and drum hits. Notes whose timing was hard to place get a dotted underline.
- The timeline hatches unsure bars.
- "Show uncertainty" off keeps the lighter ink but drops the outlines and "?".
- **Whole-song fallback:** when the summary recommends chords only, the chords show with a banner and "Show tab anyway" (or "Show notes anyway"). The banner wording names the reason:
  - "Note-level tab isn't available for this song — showing chords."
  - "Tab for this instrument isn't supported yet — showing chords."
  - "Your part didn't separate cleanly, so the tab is unreliable — showing chords."
  - Piano and vocals have their own versions.
  - If there are no chords to fall back on: "We're not confident in the notes for this song." with no button.

### Corrections (`editor-sheet.tsx`, `editor-content.tsx`)
- **How it opens:** tap a chord chip, press E (current bar), or select a note on the edit page. It is a bottom sheet on phones and tablet portrait, and a 400 px side panel on desktop and tablet landscape.
- **Contents:** "Edit this bar", with a header "Bar 12 · beat 3" (or "Pickup").
- **Chord section:**
  - Pick between chords if the bar has several.
  - The current chord large with its guitar diagram.
  - "Other likely chords": up to 4 alternatives with how likely each is ("Second guess · about 1 in 3", "About 1 in 5").
  - "Type a chord" field (hint "e.g. Am7"; error "That isn't a chord we know. Try a name like Am7, F#m or G/B.") with "Use this chord" and "Split at this beat".
  - "Report wrong".
- **Notes section:**
  - Note chips such as "A4 · string 2, fret 1" (dashed if unsure, "?" if low).
  - String and Fret steppers, Length (Shorter / Longer by a sixteenth), "Delete note", "Report wrong". These only appear for guitar and bass notes.
- **Hearing:** "Hear this bar" (plays the original mix once) and "Hear the tab" (a synth preview).
- **Metronome fixes:** "Metronome off the beat?" with Half tempo / Double tempo / Move downbeat.
- **Feedback:** every change applies at once with a toast "Edit saved" + Undo. "Report wrong" gets "Thanks — this helps". A rejected change shows the error toast "An edit couldn't be saved, so it was undone. Try it again." A key press shows "Edit undone" / "Edit redone".
- Edits queue on the device when offline.
- **Not built:** add a note, nudge a beat, mark correct, rename sections. The data model supports all of them.

### Timeline, zoom and follow behaviour
- **Overview strip** (48 px): your part's waveform (the full song's audio before stems exist), a small bar ruler (seconds before beats are known), the loop band with handles, unsure hatching and a now-line. Tap seeks to the start of that bar.
- Phone landscape shows only a 32 px ruler.
- The timeline component supports +/- zoom, but zoom is off in practice, so there is **no zoom anywhere in practice.** Reading size is controlled by the distance preset and the Reading size slider instead.
- **Notation follow:**
  - Tab: "Page by page" (the default, and forced when reduced motion is on) or "Scrolling" with a fixed now-line.
  - Piano chart keeps the current line second from the top.
  - Rolls and lanes show one or two bars ahead. With reduced motion they turn a page at a time and only the playhead moves.

### Keyboard and pedal map (`model\keymap.ts`)
Pedals send the same keys. Each action can also learn one extra key per device.

| Action | Default keys |
|---|---|
| Play or pause | Space, Enter |
| Restart loop or back a bar | ←, PageUp |
| Next bar | →, PageDown |
| Slower (5 %) | ↓ |
| Faster (5 %) | ↑ |
| Felt clean | C |
| Not yet | N |
| Loop on or off | L |
| Mute your part | M |
| Previous phrase / Next phrase (vocals) | [ / ] |
| Hear the phrase's first note | P |

- Extra keys: E edits the playing bar; ? opens the shortcuts overlay (desktop); ⌘/Ctrl Z undo, Shift+⌘/Ctrl Z redo.
- Every key action shows a 1.2 s on-screen confirmation, e.g. "Speed 75 %", "Loop · bars 5–6", "From the top of the loop", "Bar 12", "Loop on" / "Loop off", "Your part muted", "Phrase 2", "No loop — tap two bars", "Stems aren't ready yet", "No sung phrases here".
- The shortcuts overlay (desktop, `shortcuts-overlay.tsx`) holds the binding table with "Learn this pedal" and the editor keys.

### Other practice behaviour
- **Resume:** reopening a song restores speed, mix, view (Chords or notation), position and the selected clip. The URL can also set them: `?view=tab|chords&loop=17-20&speed=70&mix=your-part|minus-one|original&level=…`.
- **Video:** a floating player in the bottom-right corner of the paper, closed by default. Larger video / Smaller video / Hide video. Muted and kept in sync with the audio, including slow-down and loops.
- Lock-screen media controls show the song title.
- **Transpose / pitch shift is not built** (the data model has a saved playback key, but there is no control).
- **Speed trainer is not built.**

### Practice states
- **Loading:** a skeleton of the paper, timeline and transport; "Loading your song…" after 1 s.
- **Song error:** an inline message (e.g. "We couldn't find that. It may have been deleted.").
- **Progressive fill** as results arrive (spec 27 §3.7.3):
  1. Local audio only (during upload): a placeholder "Tab will appear here as soon as it's ready" (with instrument variants for piano, vocals and drums) over the analysis status card; seconds ruler; play, speed and time-based loops work.
  2. Beats found: bar ruler, bar-snapped loops, count-in and metronome enabled, and "You can already loop and slow the original".
  3. Stems ready: the mixer becomes available and the part's waveform appears.
  4. Chords ready: chord strip and chord sheet.
  5. Tab ready: tab or Notes.
  - Piano and drums skip the in-between states and open all at once.
- **Analysis status card:** covered in section 4.
- **Banners:**
  - Stage fallback warnings ("Stems are unavailable right now; chords and beat are ready. This didn't use an analysis.", "We couldn't work out the chords for this song. The beat and tab are still ready.", "Your part couldn't be isolated, so the tab comes from the full mix and may be rougher.", "A backup model isolated your part…", "The beat was found with a smaller model…", "The video couldn't be downloaded…").
  - Stems expired: "The stems for this song were removed after 180 days unused. Your loops and edits are safe." with "Re-create stems".
  - After 20:00, once per device: "Practising in the dark? Try Stage." with Try Stage and Close.
  - Once per device where the screen can't be kept on: "This browser can't keep your screen on. If it turns off while you play, choose a longer auto-lock time in your device's display settings."
  - Interrupted: "Playback paused by another app or a call." with "Tap to resume".
  - Audio failed: "We couldn't load the audio for this song. Check your connection and reload."
  - Offline and not cached: "This song isn't saved for offline yet."
- **Visitor (example song):** "Exit" goes to Home, no editor, and everything is stored on the device.

---

## 4. Import and start flow (`features\import\import-page.tsx`)

- **Tabs:** File / Link / Record. The last tab used is remembered; `?tab=record` opens a tab directly.
- **File tab:**
  - A drop zone: "Drop an audio or video file, or choose a file", with "MP3, M4A, WAV, FLAC, OGG, MP4, MOV · up to 20 minutes". The whole page accepts drops and shows "Drop to import" while dragging. Also accepts AIFF, Opus and WebM.
  - After a file is picked, a file row shows:
    - name, size · duration, and a Remove (×) button;
    - "Reading the file…", then a waveform preview (or "Preview after upload" for files over about 200 MB);
    - warning chips that don't block: "This recording is very quiet…", "…distorted in places…", "This file is mostly silence…";
    - blocking errors: "Songs up to 20 minutes are supported. This one is {duration}.", "Files up to 500 MB are supported.", "We couldn't read this file. It may be damaged or in a format we don't support.";
    - a duplicate notice (detected from the file's fingerprint): "You already have this song." with **Open it** / Import anyway.
  - Speech and live-recording warnings have copy but are not built.
- **Link tab:**
  - "Link to a video or song" field (placeholder "https://"; error "Enter a link that starts with https://") and a Paste button where the browser allows it.
  - Hint: "Works with YouTube and most video sites. Songs up to 20 minutes."
  - "Also download the video" switch, on by default.
- **Record tab:**
  - Unsupported browser: "Recording isn't available in this browser. Try a file or a link instead."
  - Before asking: "Your browser will ask for the microphone. Turn off noise reduction on headsets for the cleanest take." with **Allow microphone**.
  - Denied: "Splitune needs your microphone to record. You can allow it in your browser's site settings." with Try again.
  - Ready: an "Input level" meter, Count-in and Click switches (Click needs Count-in), and a large Record button.
  - Then "Count-in {beat}" (4 beats at 100 BPM), Stop with an elapsed timer, and review: "Your recording, {duration}" with an audio player and Record again.
- **Side panel (all tabs):**
  - If the Welcome analysis is unused: "Your first full analysis is free — your part isolated, plus tab." with "Use it now".
  - **"Your part"** dropdown: Guitar / Bass / Piano / Drums / Vocals / Something else. Defaults to the profile instrument.
  - **Analysis** choice: **Full** ("Your part isolated, plus tab") or **Lite** ("Beat and chords, fast", with "{left} of {limit} Lite analyses left · resets {date}").
  - Locks when a limit is used up:
    - Free, no Full left: "Full analyses are part of Plus. You've used your free Welcome analysis." with See Plus and Use Lite instead.
    - Plus, Full used up: "You've used this period's {limit} full analyses…"
    - Lite used up: "You've used this month's {limit} Lite analyses…" with See Plus.
    - See Plus opens the upgrade sheet.
  - Offline when submitting: "You're offline. We'll start the upload when you're back." (it starts automatically when the connection returns).
  - Errors are shown inline.
  - **Primary button:** "Start practising" (File) / "Use this recording" (Record) / "Import and analyse" (Link).
- **There is no title or artist field at import.** The title comes from the file name and can be renamed later in the library; artist exists in the data model but has no UI.
- **What happens next:**
  - File or recording: the song is created and the practice screen opens straight away with local playback. The upload continues in the background (resumable, survives a reload) and then the analysis starts.
  - Link: the practice screen opens and its first stage shows "Downloading".
  - An upload pill in the top bar shows "Uploading 42 %" or "Waiting for connection" and links to the song.
  - After a reload in a browser that couldn't keep the file (e.g. Safari private browsing): "The upload of "{title}" was interrupted. Choose the same file to continue where it stopped." with "Choose the file" (a different file gets "That's a different file. Choose the one you started uploading.").
  - Upload failure: "The upload stopped. Check your connection and try again." with Retry.
  - If no analysis was ever started: "This song's file was never uploaded. Import it again to analyse it."
- **Pipeline stages the user sees** (in order): Downloading → Reading the audio → Finding the beat → Listening for instruments → Isolating your part → Preparing the stems → Working out the chords → Transcribing your part → Building the tab. Unknown stages show as "Analysing".
  - Each stage shows: Waiting / Working (or the ETA) / Done / Used a fallback / Didn't work / Skipped.
- **How progress is shown:**
  - A card "Analysis" on the practice paper with an overall progress bar labelled "Analysing your song · About N min left" (or "Analysis finished"), and a small busy bar under the running stage.
  - The ETA comes from median stage times of recent runs. It is hidden if any remaining stage has no timing yet (no fake progress).
  - Updates arrive live from the server; stage changes are announced politely to screen readers.
  - If the processing machine is off: "Processing machine offline — your song is queued and will start automatically."
  - In the library, the card shows "Analysing 2/5" and a line "{stage} · About N min left".
- **Failure and retry:**
  - Whole analysis failed: "We couldn't analyse this song. This didn't use an analysis." with the stage's reason and "Try again" (re-runs the analysis).
  - Partial failures show as practice banners (section 3).
  - Link failures: "We can't import from this link. Try uploading the audio file instead.", "We couldn't download this video (it may be private, removed or blocked in your region).", "Link import is temporarily broken. Upload a file instead."
  - Other reasons: silent file, no steady beat, too long.
  - The YouTube embed fallback with manual sync is not built.
  - There is no push or email notification when an analysis finishes.

---

## 5. Library (`features\library\library-page.tsx`, `song-entry.tsx`)

- **Header:** "Library" and "{n} songs" ("+" when more pages exist). The allowance meter sits here below `lg`; the app shell doesn't show it on wide screens, although spec 27 put it in the shell. A worker-offline banner shows when songs are queued.
- **Toolbar** (shown once there are songs or a filter is active):
  - Search by title (debounced).
  - Instrument (All plus the six instruments).
  - Status (All / Ready / Partial / Analysing / Failed).
  - Sort (Last practised [default] / Added / Title).
  - "Clear filters".
  - Grid / List switch from `md` up; phones always get the list.
  - All of these are kept in the URL.
- **Card or row content:**
  - Instrument tile and instrument label.
  - Title (two lines at most) and artist if present.
  - Status badge: Uploading {pct} / Upload not finished / Downloading / Queued / Analysing n/m / Failed / Stems expired / Chords only / Partial / Ready.
  - "Practised {3 days ago}".
  - "Best 85 % on bars 17–20".
  - The whole card opens practice.
- **Follow-up line under the card:**
  - Analysing: a progress bar with "{stage} · About N min left".
  - Uploading: a progress bar.
  - Failed: the reason, "This didn't use an analysis." and Try again.
  - Stems expired: the expiry text and "Re-create stems".
- **Overflow menu ("More for {title}"):**
  - Rename: a dialog "Rename song" with a Title field (error "Enter a title."), Cancel / Save, then toast "Renamed."
  - "Analyse again", or "Analyse with stems + tab" for a Lite song (lock icon when no Full is left; on Free it opens the upgrade sheet). Toast "Analysis started."
  - Delete song: a confirm dialog "Delete "{title}"? Its stems, loops and edits will be removed. This can't be undone." with Delete song / Cancel, then toast "Song deleted."
- **States:**
  - Loading: skeleton cards.
  - Empty: "Your library is empty. Import a song you want to learn, or start with an example." with **Import a song** and "Try an example" (goes to `/start`).
  - No results: "No songs match. Try another search or filter." with Clear filters.
  - Load error: "We couldn't load your library." with Retry.
  - 24 songs per page with "Show more". The list refreshes itself every 10 s while something is in progress.
  - The offline state from spec 27 (uncached songs dimmed with "Needs connection") is not built.

---

## 6. Settings, billing, privacy

Each field saves on its own and shows "Saving…" / "Saved" / "Couldn't save. Try again." There is no global save button. Sections: Profile, Display & practice, Keyboard & pedal, Plan & billing, Privacy. **About is not built.**

- **Profile** (saved to the account):
  - Name (saves when you leave the field).
  - Main instrument (six options).
  - Level: Just started / I can play a few songs / Coming back after a break.
  - Handedness: Right-handed / Left-handed (hint "Chord diagrams and the fretboard are mirrored for left-handed players.").
  - The account also has a marketing opt-in with no UI.
- **Display & practice** (saved on this device only):
  - Appearance: System / Light / Dark / Stage.
  - Score: Paper / Match appearance (hint "Paper keeps the music dark on light in every appearance.").
  - "Where is your screen?": Automatic / Desk / Music stand / Floor.
  - Reading size: slider 80–140 % with a live sample "3 5 7 10 · 100 %" and the hint "Can you read the fret numbers from where you play?".
  - Hyperlegible font.
  - Reduce motion: Follow system / On / Off.
  - Increase contrast: Follow system / On / Off (only here, not in the ⚙ popover).
  - **Practice defaults:**
    - Starting speed 25–100 % in 5 % steps (default 100).
    - Count-in Off / 1 bar / 2 bars (default 1).
    - Rest between repeats None / One beat / One bar.
    - Sound delay −150 to +150 ms in 10 ms steps (hint about Bluetooth headphones playing late).
  - "Show uncertainty" and "Tab layout" are only in the ⚙ popover. "Ask after each pass" is only in the Loop popover.
- **Keyboard & pedal:**
  - Intro: "These keys work on the practice screen. Learned pedals are saved on this device."
  - A table of Action / Keys with a "Learn this pedal" button per row. While learning, the button reads "Press it now" and the line "Press the pedal or key for {action}. Escape cancels." shows.
  - "Reset to the defaults".
  - A test area: "Try a key or pedal here" / "Click here, then press a key or your pedal." responds "{key}: {action}" or "{key} isn't bound to anything."
  - There is no pedal setup wizard.
- **Plan & billing:**
  - Return messages from checkout: "You're on Plus. 15 full analyses a month, resets {date}." or "Checkout cancelled. Nothing was charged."
  - "Your plan": Free / Splitune Plus, monthly / Splitune Plus, yearly, with "Renews on" or "Ends on {date}", and a past-due line ("The last (simulated) payment failed — Plus stays active while it's retried.").
  - Plus: a full-analysis meter "{left} of {limit} full analyses left · resets {date}" and "Lite analyses: no monthly limit". Buttons: Cancel Plus (one tap, then the "stays active until…" line) or Resume Plus, and Manage plan (goes to the mock portal).
  - Free: "Your Welcome analysis is still unused." or "You've used your Welcome analysis.", the Lite meter, and See Plus (opens the upgrade sheet).
  - Error: "That didn't work. Try again."
- **Upgrade sheet** (bottom sheet), opened from five places: Lite cap, Full cap, a Lite song in the library, Pricing, Settings.
  - "Plus gives you": 15 full analyses a month, Lite without a monthly limit, extra instruments, priority processing, and "Mic scoring, offline practice and export as they arrive".
  - Monthly / Yearly choice cards.
  - "Every practice tool stays free…" and "Cancel anytime in one tap."
  - Not now / **Continue to checkout**.
  - Error: "We couldn't load the prices."
- **Plans:**
  - Free: 1 Welcome analysis for life and 5 Lite a month.
  - Plus: 15 Full a month and unlimited Lite (fair use about 200).
  - Failed analyses never count against an allowance.
- **Privacy:**
  - Offline: read-only with "You're offline. These settings need a connection."
  - "Help improve transcriptions" switch (opt-in, with a hint).
  - **Download my data:**
    - A body explaining the file, then "Prepare my data".
    - Pending: "Preparing your file. This can take a few minutes — you can leave this page." (plus the worker-offline notice when relevant).
    - Ready: "Your file is ready. The link works until {date}." with **Download my data** and "Prepare a new file".
    - Failed: "We couldn't prepare your file. Try again."
    - Unavailable: "We couldn't check your data download." with Try again.
  - **Delete my account:**
    - A body explaining what goes, and a destructive button.
    - Confirm dialog: "Delete your account and everything in it? This can't be undone." with Cancel / Delete account.
    - If the session is old: "Confirm it's you" with a Password field and Confirm (Google accounts sign in with Google again and come back to the dialog).
    - Failure: "We couldn't delete your account. Try again."
    - Then the `/account-deleted` page.

---

## 7. v1 features (V1–V13): what is built

Sources: `docs\status.md`, `docs\specs\21-v1-features.md`, `docs\steps\s18…s30`.

| ID | Feature | State | UI still to design |
|---|---|---|---|
| V1 | Speed trainer | Not started. Data model and an off-by-default flag only. | Entry in the speed popover; settings (start / end / step % / plays per step / count-in each pass); progress in the loop badge ("pass 3/4 at 70 %"); % and BPM entry. |
| V2 | Transpose and capo suggestions | Partial. Only the manual guitar capo (0–12, shapes only) exists. | "Playback key" control (±12, warning beyond ±3 on vocals) separate from "shapes key/capo"; capo suggestion; "sounds like original key" confirmation. |
| V3 | Sections | Not started. Data model and the "renamed a section" edit exist. | Section chips above the timeline, tap to set a loop, editable labels, "Part A/B/C" fallback. |
| V4 | Piano notes, hands, falling notes, staff | Done. Real-device and owner checks pending. | — |
| V5 | Piano wait mode over MIDI | Not started. Desktop and Android Chrome only (no Safari or iOS). | Wait-mode toggle, MIDI device state, octave-insensitive option, hands-separate. |
| V6 | Drums | In progress, behind the off-by-default `v1.drums` flag. Grid, staff and levels built; onboarding still says "Coming soon". | Planned in s30: drum-piece mixer channels and presets, lane focus, rough-piece hints. |
| V7 | Mic scoring and tuner | Not started. | Tuner (needle, cents, "in tune" text); calibration (tap/clap); headphones prompt; Bluetooth warning; calm scoring feedback with "I played it right". |
| V8 | Record and compare | Not started. | Record a take during a loop pass; A/B or left/right playback against the reference; takes kept on the device. |
| V9 | Visual and haptic metronome | Not started. Only the count-in beat number exists. | Beat pulse (at most 3 flashes a second, downbeat shown by shape), vibration. |
| V10 | Offline practice | Partial. The service worker caches the app, pages, API reads and example media; edits and passes queue offline. | "Make available offline" in the song menu and practice ⋯, a "Saved offline" badge, quota and removal messages, library "Needs connection" dimming. |
| V11 | Export | Not started (off-by-default flag; "Coming soon" on pricing). | Export menu (MusicXML / Guitar Pro / PDF) with an "auto-transcribed" footer. |
| V12 | Alternative fingerings, tuning, capo | Partial. Capo only; the "easiest" fingering mode exists internally with no switch. | Tap a note to cycle fingerings; Easiest / As played switch; tuning presets (standard, half-step down, drop D, full-step down; 4- or 5-string bass); "low string on top" option. |
| V13 | Richer levels | Partial. Piano triads / as played and drum Main groove / Simplified / As played are built. | Piano right-hand-melody-only, left-hand block chords, simplified rhythm. |
| — | Vocals (s23) | Melody view done; the rest not started. | Pitch curve, live mic curve, lyrics lane, transposing to the singer's range. |
| V14 | Native apps | Not started. PWA plus optional sideloaded builds. | — |

Other things specced but not built that need UI:
- "Is this your {instrument}?" check after stems arrive.
- Part switching or extra instrument per song.
- YouTube embed fallback with manual sync points.
- Settings → About.
- Progress history (tempo per clip over 30 days), weekly goals, reminders.
- Clip management (delete / rename).
- Multi-stem mixer.
- "Analysis done" notification.
- Speech and live-recording warnings at import.
- Timeline zoom.
- Edit-page zoom.
- Phone access to mixer, metronome, level, capo and volume.
- Allowance meter in the shell on wide screens.

---

## 8. Everything else the redesign must cover

- **Toasts:** Edit saved (with Undo) / Thanks — this helps / edit rejected (error) / Renamed. / Song deleted. / Analysis started. / API errors from the library.
- **Dialogs and sheets:**
  - Rename song; Delete song; Delete account (confirm and re-check-it's-you steps).
  - Upgrade sheet; onboarding song card; save-progress sheet.
  - Mixer drawer; editor sheet or side panel; shortcuts dialog.
- **Popovers:** loop, speed, Display ⚙, ⋯, confidence legend, level and capo, piano options, melody options, account menu, song overflow menu.
- **In-practice overlays:** the key/pedal confirmation, the count-in number, coach marks, the floating video.
- **PWA:**
  - Installable app (opens on `/library`, full screen).
  - Precaches the app; network-first for pages and data; caches example media.
  - Offline pages: `/start`, `/library`, practice.
  - "A new version is ready" (never during playback).
  - Asks for persistent storage once installed.
  - iOS "Add to Home Screen" hint.
  - Lock-screen media controls; keeps the screen awake with a fallback tip.
- **Offline everywhere:** a global banner; the import queue; privacy settings read-only; practice "This song isn't saved for offline yet."
- **Accessibility features users can turn on:**
  - Appearance including Stage (the dark score); Paper or Match score.
  - Distance presets and the Reading size slider; Hyperlegible font.
  - Reduce motion (switches to paging, steps the playhead, removes fades); Increase contrast; high-contrast system mode respected.
  - Left-handed mirroring; Bluetooth sound delay.
  - Skip link.
  - Full keyboard and pedal control with learnable keys and on-screen confirmations.
  - Text alternatives for screen readers: bar descriptions ("{bar}: {chords}; notes {notes}"), "Sounding now: Left hand B♭2…", the neck and melody descriptions (updated at most once a second), stage-change announcements.
  - Flashes capped at 3 a second; confidence never shown by colour alone.
- **Device warnings:** unsupported browser page; in-app browser banner; screen-can't-stay-on tip; playback interrupted ("Tap to resume").
- **Visitor mode:** an example song can be practised without an account and everything is kept on the device; "Exit" goes to Home; the editor is hidden; progress is claimed at sign-in.
- **Personal-mode specifics** (`docs\specs\25-personal-mode.md`):
  - Payments are a mock throughout, with demo banners and never any card fields.
  - Link import (YouTube and similar) is allowed, with an optional video download.
  - Analyses run on the owner's machine, so a "processing machine offline" state appears in the library, practice, import and data export.
  - Stems expire 180 days after a song was last opened, with "Re-create stems".
  - Copyright and DMCA flows are switched off; songs taken down for copyright have a dormant status.

### Data behind the screens (`packages\contracts\src\`)
- **Song:** title, artist, instrument, source (upload / recording / url / example), duration, status (importing / analysing / ready / partial / failed / taken_down), last opened, created.
  - Saved practice state: speed, mix per stem, playback key, view, position, selected clip.
  - In the library list: the latest analysis (type Welcome / Full / Lite, status, stages done / total, recommended view), stems (available / expired / none), and the best clean pass (tempo, bars).
- **Analysis:** status (queued / running / done / partial / failed / cancelled), progress, a status per stage (pending / running / done / failed / fallback / skipped, with an error code).
  - Live events: stage started / completed / failed (with any fallback), progress, waiting for the worker, done.
- **Music data:**
  - Beats: bpm, meter, bars (pickup is −1), whether the tempo might be half or double.
  - Chords: name, slash bass, confidence, up to 5 alternatives with likelihood; the song's key.
  - Notes: pitch, timing, confidence, bends, hand, string likelihoods; tuning detected (with a suggested tuning); piano sustain pedal; vocal pitch curve (unused).
  - Drum hits: one of 5 classes, a "guess" flag, confidence.
  - Tab: tuning, capo, level, fingering mode, string/fret, up to 3 alternative fingerings, "can't be placed" flag.
  - Stems: kind (isolated / mix-minus), quality (good / rough), empty flag.
  - Summary per instrument: mean note confidence, share of unsure notes, recommended view (tab / notation / roll / drum_grid / f0 / chords_only) with reasons.
  - Never shown in the UI: which instruments were detected and their subtypes (acoustic vs electric guitar, synth keys, organ), and song sections (intro, verse, chorus…).
- **Loop clip:** name, start/end bar and beat, rest, count-in bars (0–4), trainer (unused), best clean tempo.
- **Account:** username, display name, main instrument, level, handedness, training and marketing opt-ins, plan (free / monthly / yearly), subscription status (active / trialing / past_due / cancelled / expired) with period end and cancel-at-end, allowance usage (Welcome available; Full and Lite used / cap / reset date).
- **Examples:** part (rhythm / riff / bass line), suggested loop, starting speed per level.
