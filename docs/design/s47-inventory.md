# s47 UI inventory

Tree state: HEAD `bd2c77e` (read after the coordinator's update; files changed since `b3db5c9` were re-read). All paths are repo-relative. Spec references (e.g. "27 §3.5") are the section numbers cited in the code comments (`docs/specs/26-design-system.md`, `27-screens-flows-and-content.md`, `12-practice-screen-and-notation.md`, `28-ui-quality-and-design-review.md`).

Conventions used below:
- Route path = TanStack file route. Pathless groups `_app`, `_auth`, `_bare`, `_focus`, `_marketing` add no URL segment.
- Route files are under `apps/web/app/routes/`; feature files under `apps/web/app/features/`; ui components under `apps/web/app/ui/` and are written without the extension, e.g. `button`.
- "Root" (`apps/web/app/routes/__root.tsx`) wraps every route. It supplies `Toaster` (`ui/toast`), `TooltipProvider` (`ui/tooltip`), `DisplaySync` and the 404/error pages (`features/system/error-page.tsx`, `NotFoundPage` / `ErrorPage`). It also starts upload resume once signed in.

---

## 0. Cross-cutting facts

### 0.1 Route groups and shells

| Group | Route file | Auth | Shell component | Density |
|---|---|---|---|---|
| `_marketing` | `_marketing.tsx` | public (`me` optional) | `features/shell/marketing-shell.tsx` (`MarketingShell`, `SiteFooter`) | `browse` |
| `_auth` | `_auth.tsx` | public (a signed-in visitor is redirected away via `safeNext`) | `features/auth/auth-shell.tsx` (`AuthShell`) | `browse` |
| `_bare` | `_bare.tsx` | public | `features/shell/bare-shell.tsx` (`BareShell`, 480 px column) | `browse` |
| `_app` | `_app.tsx` | `beforeLoad` redirects to `/auth/sign-in?next=` when there is no `me` | `features/shell/app-shell.tsx` (`AppShell`) | `browse` |
| `_focus` | `_focus.tsx` (plain `Outlet`) | per child | `features/shell/focus-shell.tsx` (`FocusShell`), rendered by each page | `practice` |

Shell details:
- **AppShell**
  - Top bar: wordmark, Library link, Usage popover (`features/shell/usage-popover.tsx`), ⌘K search button, Add song, `UploadPill`, `AccountMenu` (`account-menu.tsx`).
  - Phone: `BottomNav` (`bottom-nav.tsx`).
  - Also mounts `SkipLink`, `SystemBanners installHint`, `DropOverlay`, `PaletteLauncher` and `AddSongHost`.
  - `useClaimOnSignIn` claims a guest's progress.
- **FocusShell**
  - 60 px bar with "Back to library" (`exit` mode: "Exit" to `/`), the page status slot, `UploadPill`, and a search button on coarse pointers.
  - `fill` makes the page exactly the viewport (practice).
  - Mounts `PaletteLauncher` unless `exit`.
- **MarketingShell**
  - Sticky bar with How it works, Pricing, Sign in and "Try an example song" (`/start`), or Library when signed in.
  - Phone: a `DropdownMenu` "Menu".
  - Footer with Terms and Privacy.
- **BareShell**: wordmark and a `max-w-bare` main column.
- **AuthShell**: nearly empty page and a 400 px form column.
- `SystemBanners` (`features/system/system-banners.tsx`) is shown by every shell. Its banners are:
  - offline
  - "update ready" (held back while audio plays)
  - iOS "Add to Home Screen" (app shell only)
  - in-app-browser hint with Copy link

### 0.2 Global overlays (reachable from several screens)

| Overlay | Kind | Files | Opened by |
|---|---|---|---|
| Command palette | `ui/dialog` (Base UI dialog primitive), combobox/listbox of Songs, Clips, Actions | `features/shell/command-palette.tsx` (lazy via `palette-host.tsx`, `palette-launcher.tsx`, `palette-store.ts`) | ⌘K / Ctrl K in `_app` and `_focus` (non-exit); search buttons; on practice it registers "Loop bars a–b", saved clips, view names and Display via `usePaletteActions` |
| Add song | `ui/dialog` (full-screen sheet on phones) with File / Link / Record tabs | `features/import/add-song-dialog.tsx`, mounted by `features/shell/add-song-host.tsx` | `/library?add=file|link|record`, `/import` redirect, Add song buttons, a file dropped on the app shell (`features/shell/drop-overlay.tsx`) |
| Upgrade sheet (Plus) | `ui/drawer` (swipe down) | `features/billing/upgrade-sheet.tsx` | `UpgradeSheet` is mounted by `add-song-dialog` (cap reached), `library/song-entry` (Lite song, `trigger="lite_song"`), `shell/usage-popover` (`trigger="settings"`), `settings/usage-settings`, `billing/billing-settings`. Paywall triggers: `cap_lite`, `cap_full`, `lite_song`, `pricing`, `settings` |
| Account menu | `ui/dropdown-menu` | `features/shell/account-menu.tsx` | Avatar button. Contains Settings, Keyboard & pedal, Appearance radio (Dark/Light/System), Help links, Sign out |
| Usage popover | `ui/popover` + `popover-content` + `meter` | `features/shell/usage-popover.tsx` | "Usage" in the top bar and bottom nav |
| Toasts | `ui/toast` | many | Rename/delete/analysis-started toasts, practice "Tab is ready · Show" arrival toast, and correction toasts with Undo |

### 0.3 Data/setup shorthand used below

- **Signed-in** means a Better Auth session. Sign-in is username + password (no email).
- **Analysed song** means a song owned by the account with a finished analysis (artefacts beats, stems, chords, notes/tab, summary).
- **Example song** means a guest-practisable example from `apps/api/examples.json`. Current ids are `ill-fate` (guitar riff), `stitch-up` (guitar rhythm) and `stitch-up-bass` (bass line). Their assets live in the bucket under `assets/examples/{id}/{build}/`, built by `pnpm examples:build`.
- **Stories** means Storybook with fixtures; no backend is needed (see section 9).

---

## 1. `_marketing` (public pages)

### 1.1 Home
| | |
|---|---|
| URL | `/` |
| Route | `apps/web/app/routes/_marketing/index.tsx` |
| Features | `features/marketing/home.tsx`, `product-still.tsx`; art in `apps/web/public/art/home-*.webp` (changed at HEAD) |
| States | Signed out (CTA "Try an example song" → `/start`, Sign in) and signed in (Library link in the shell). No loading or error states: static copy. |
| Overlays | Mobile Menu dropdown only (shell). |
| ui used | `button` (plus shell `brand`, `dropdown-menu`) |
| Reach | Always public. |
| Stories | `Screens/Home`: SignedOut, SignedIn, Daylight, Phone, PhoneDaylight (`features/marketing/home.stories.tsx`) |

### 1.2 How it works
| | |
|---|---|
| URL | `/how-it-works` |
| Route | `routes/_marketing/how-it-works.tsx` |
| Features | `features/marketing/how-it-works.tsx`, `how-scenes.tsx` (inert pictures of the app, built from ui components), `product-still.tsx` |
| States | Static. |
| Overlays | None. |
| ui used | `button`; scenes use `chord-chip`, `loop-badge`, `pass-control`, `progress`, `speed-control` |
| Stories | `Screens/Marketing` HowItWorksPage, HowItWorksDaylight, HowItWorksPhone, HowItWorksPhoneDaylight (`pages.stories.tsx`); `Screens/Marketing/How it works scenes` Import, Separate, Transcribe, Practise (+Daylight) (`how-scenes.stories.tsx`) |

### 1.3 Pricing
| | |
|---|---|
| URL | `/pricing` |
| Route | `routes/_marketing/pricing.tsx` (loader prefetches `plansQuery`) |
| Features | `features/billing/pricing-page.tsx`, `plans.tsx`, `price.ts` (test: `price.test.ts`) |
| States | Loading or failed: an empty container, with `InlineError` "plan.prices_failed" on error. Success: Free and Plus columns, Monthly/Yearly toggle, Compare table. Variants: signed out, on Free, on Plus. |
| Overlays | None (links go to sign-up/checkout). |
| ui used | `badge`, `button`, `status-message` (`InlineError`), `toggle-group` |
| Reach | Public. Prices come from the mock billing provider (`BILLING_PROVIDER=mock`). |
| Stories | `Screens/Pricing`: SignedOut, Daylight, Phone, PhoneDaylight, OnFree(+Daylight), OnPlus (`features/billing/pricing.stories.tsx`) |

### 1.4 Legal
| | |
|---|---|
| URL | `/legal/terms`, `/legal/privacy` (`/legal/$page`; any other value is `notFound`) |
| Route | `routes/_marketing/legal.$page.tsx` |
| Features | `features/marketing/legal-page.tsx`, `legal-content.ts` |
| States | Static; unknown page gives the 404. |
| Overlays | None. |
| ui used | none directly |
| Stories | `Screens/Marketing` Terms, Privacy, PrivacyDaylight, TermsPhone (`pages.stories.tsx`) |

---

## 2. `_auth`

### 2.1 Sign in / Sign up
| | |
|---|---|
| URL | `/auth/sign-in?next=`, `/auth/sign-up?next=` |
| Routes | `routes/_auth/auth/sign-in.tsx`, `routes/_auth/auth/sign-up.tsx` (loader `getAuthOptions()` from `app/server/auth-options.ts`, which decides whether Google is shown) |
| Features | `features/auth/sign-in.tsx` (`AuthScreen mode="sign-in"|"sign-up"`), `auth-shell.tsx` |
| States | Idle; field validation errors (SignUpInvalid story); wrong credentials / server error shown inline; Google button shown or hidden (`SignInWithGoogle`, `SignInMissing`); submitting spinner on the button. A signed-in visitor is redirected to `next`. |
| Overlays | None. The same form is reused inside the onboarding Save sheet (drawer). |
| ui used | `button`, `field`, `input`, `status-message`, `brand` (shell) |
| Reach | Public. Sign-up creates a real local account (username letters/digits/dots/underscores). |
| Stories | `Screens/Auth`: SignIn, SignInDaylight, SignInPhone, SignInWithGoogle, SignInMissing, SignUp, SignUpDaylight, SignUpPhone, SignUpInvalid (`features/auth/auth.stories.tsx`) |

---

## 3. `_bare` (system and mock-billing pages)

### 3.1 Mock checkout / mock portal
| | |
|---|---|
| URL | `/billing/mock-checkout?session=`, `/billing/mock-portal?session=` (any other `$view` is `notFound`) |
| Route | `routes/_bare/billing/$view.tsx` |
| Features | `features/billing/mock-checkout.tsx`, `mock-portal.tsx`, `plans.tsx` |
| States | Checkout: loading skeleton; details error and expired link (`CheckoutExpired`); plans error; success/decline/cancel buttons; action-failed `InlineError`. Portal: loading; error or no session (expired-link state); active plan; cancelling at period end; past due banner; confirmation `InlineError tone="success"`. |
| Overlays | None. |
| ui used | `button`, `skeleton`, `status-message` (`Banner`, `InlineError`) |
| Reach | Needs a signed-in account and a session id created by the app (e.g. Upgrade sheet "Continue to checkout", or Settings → Plan "Manage plan"). |
| Stories | `Screens/Billing`: Checkout, CheckoutDaylight, CheckoutPhone, CheckoutExpired, Portal, PortalDaylight, PortalPhone, PortalCancelling, PortalPastDue (+ Upgrade sheet stories) (`features/billing/billing.stories.tsx`) |

### 3.2 Account deleted
| | |
|---|---|
| URL | `/account-deleted` |
| Route | `routes/_bare/account-deleted.tsx` |
| Features | `features/system/account-deleted.tsx`, `system-card.tsx` |
| States | Static system page. |
| ui used | `button` |
| Stories | `Screens/System` AccountWasDeleted, AccountWasDeletedDaylight, AccountWasDeletedPhone (`features/system/system.stories.tsx`) |

### 3.3 Unsupported browser
| | |
|---|---|
| URL | `/unsupported` (route `ssr: false`) |
| Route | `routes/_bare/unsupported.tsx` |
| Features | `features/system/unsupported.tsx`, `lib/capabilities.ts`, `lib/require-audio.ts` (the practice/edit routes call `requireAudioEngine()`, which sends browsers lacking the audio engine here) |
| States | Missing-requirement explanation, details list, copy-link button. |
| ui used | `button` |
| Stories | `Screens/System` Unsupported, UnsupportedDaylight, UnsupportedPhone |

### 3.4 Not found and error boundary (root level, not a route file)
| | |
|---|---|
| Where | `features/system/error-page.tsx` (`NotFoundPage`, `ErrorPage`), used by `__root.tsx` |
| URL | any unknown URL; any thrown route error |
| States | 404; error with a copyable error id. |
| ui used | `button` |
| Stories | `Screens/System` NotFound(+Daylight/Phone), ScreenError(+Daylight) |
| System banners | `Screens/System` UpdateReady, UpdateHeldWhilePlaying, InstallHintIos, Offline, InAppBrowser (+Daylight/Phone) show `SystemBanners` states. |

---

## 4. `_app` (signed-in app shell)

### 4.1 Library
| | |
|---|---|
| URL | `/library?q=&instrument=&status=&sort=&view=grid|list&add=file|link|record` |
| Route | `routes/_app/library.tsx` (`ssr: 'data-only'`, `pendingComponent: LibrarySkeleton`, loader prefetches `libraryQuery`) |
| Features | `features/library/library-page.tsx`, `library-skeleton.tsx`, `queries.ts`, `song-entry.tsx` (card/row, menu, follow-up), `song-tile.tsx`, `song-status.ts` (+test), `song-dialogs.tsx`, `continue-card.tsx`, `week-strip.tsx`, `revisit-list.tsx`, `library-progress.tsx` (new at HEAD: Continue clip, 30-day sparkline, This week, Worth a revisit from `GET /v1/progress`; shares `features/practice/progress-data.ts`, `model/progress-metrics.ts`) |
| States: empty | No songs and no filters: `EmptyState` with Add song and "Try an example". |
| States: no results | Filters active with 0 matches: `EmptyState` with Clear filters. |
| States: loading | `LibrarySkeleton` / `SongsSkeleton`. |
| States: error | `InlineError` "library.load_error" with Retry. |
| States: offline | Cards that need the server are dimmed ("Needs connection"); `WorkerStatus` banner when the worker is offline and songs are queued. |
| States: success/populated | Grid or list (phones always list). Continue card plus This week strip, Worth a revisit list (wide only), toolbar (search, instrument chips, sort/status menu, grid/list toggle), "Load more" every 24. |
| States: partial | Per-card status: uploading, upload unfinished, downloading, queued, analysing n/m (bar, refetch every 10 s), failed (Try again), stems expired (Recreate stems), chords only, partial, ready. |
| Overlays | Add song dialog (`?add=`), Rename song `Dialog`, Delete song `AlertDialog` (both in `song-dialogs.tsx`), per-song `DropdownMenu` (Rename, Analyse again/Upgrade to full, Delete), sort/status `DropdownMenu`, Upgrade sheet, command palette, account menu, usage popover, drop overlay. |
| ui used | `button`, `dropdown-menu`, `empty-state`, `input`, `status-message`, `toggle`, `toggle-group`, `worker-status`, `skeleton`, `song-card` (`SongCard`, `SongRow`), `progress`, `badge`, `alert-dialog`, `dialog`, `field`, `toast`, `icons/bass`; progress strips use `sparkline`, `stat-card` |
| Reach | Signed in. For non-empty states, add songs (Add song, or sign in with a claimed example) with at least one analysed song. For the Continue/week/revisit strips: a song opened before, with clean passes in the last 31 days. |
| Stories | `Screens/Library` (`features/library/library.stories.tsx`): Populated (+Daylight, IncreasedContrast, Phone, List), ViewSwitch, Filters, WorkerOffline, Empty, EmptyPhone, NoResults, Loading, LoadError, Offline, ProgressSections. Kit: `Kit/Library` (`ui/library.stories.tsx`). |

### 4.2 Import (redirect)
| | |
|---|---|
| URL | `/import?tab=file|link|record` → 307-style redirect to `/library?add=<tab>` |
| Route | `routes/_app/import.tsx` |
| Notes | No component. Add song is the dialog in 4.1 / 0.2. |

### 4.3 Add song (dialog; `/library?add=...`)
| | |
|---|---|
| Features | `features/import/add-song-dialog.tsx` (lazy default export), `add-song-state.ts` (`useOpenAddSong`, remembered tab `splitune.import.tab`, `usePendingFile`), `analysis-choice.tsx`, `chip-radio.tsx`, `file-row.tsx`, `link-panel.tsx`, `record-panel.tsx`, `part-picker.tsx`, `resume-file.tsx`, `upload-pill.tsx`, `use-picked-file.ts`, `preflight.ts`, `local-audio.ts`, `recorder.ts`, `hash.ts` / `hash.worker.ts`, `upload-manager.ts`, `upload-store.ts`, `upload-db.ts`, `splitune-uploader.ts` |
| States | Per tab. File: empty `DropZone`, file picked (`FileRow` with waveform, title/artist fields), reading, ready, warnings (clipping, quiet, mostly silent), duplicate (Import anyway), too long, too large, unreadable. Link: URL invalid, valid, "download video" switch. Record: mic permission denied, unsupported, recording with level meter, recorded (headset hint, count-in/click). Footer: offline notice (`InlineError tone="warning"`), failure `InlineError`, cap reached (Lite/Full allowance, `see Plus`). Upload progress shows in `UploadPill` in the shell. |
| Overlays | "Works best with…" `Popover`; Upgrade sheet; the dialog itself. |
| ui used | `button`, `dialog`, `drop-zone`, `input`, `label`, `popover`, `popover-content`, `status-message`, `tabs`, `badge`, `radio-card`, `spinner`, `waveform-preview`, `field`, `switch`, `meter`, `toggle-group`, `icons/create`; `drawer` via Upgrade sheet |
| Reach | Signed in; Record needs a microphone. After submit it navigates to `/songs/:id/practice` while upload and analysis continue. |
| Stories | `Screens/Import` (`features/import/import.stories.tsx`): DropZone, Sheet, CapReached, PlusCapReached, PartAndHand, LinkTab, FileSelected, RecordTab, WorksBest, FileReading, FileReady, FileWarnings, FilePreviewAfterUpload, FileDuplicate, FileTooLong, FileUnreadable. Kit: `Kit/Import` (`ui/import.stories.tsx`). |

### 4.4 Settings (layout and sections)
Layout: `routes/_app/settings.tsx` (`ssr: 'data-only'`) with `features/settings/settings-layout.tsx` (section list, 220 px, above the section on phones). Section nav: Account, Usage, Plan, Display, Keyboard, About.

| Section | URL | Route file | Feature files | States | Overlays | ui used |
|---|---|---|---|---|---|---|
| Index | `/settings` | `_app/settings/index.tsx` | none | redirect to `/settings/account` | none | none |
| Account | `/settings/account?confirm=delete` | `_app/settings/account.tsx` | `settings/account-settings.tsx`, `privacy-settings.tsx`, `account-redirect.ts` (+test), `setting-row.tsx`, `use-save-state.ts` | Profile (name/level/instrument), Privacy rows: training opt-in; Download my data (idle, pending, ready, failed, unavailable, offline); Delete my account (confirm, reauth password, reauth Google); Sign out | Delete account `AlertDialog` (opened by `?confirm=delete`) | `button`, `input`, `alert-dialog`, `field`, `status-message`, `worker-status`, `save-status`, `switch` |
| Profile / Privacy | `/settings/profile`, `/settings/privacy` | `_app/settings/profile.tsx`, `privacy.tsx` | redirects to `/settings/account#profile|#privacy` via `toAccount` | | | |
| Usage | `/settings/usage` | `_app/settings/usage.tsx` | `settings/usage-settings.tsx` | Free, Lite used up, Plus; phone stacks the bars | Upgrade sheet | `button`, `meter` |
| Plan | `/settings/plan?checkout=success|cancelled` | `_app/settings/plan.tsx` | `features/billing/billing-settings.tsx`, `upgrade-sheet.tsx` | Free (See Plus), Plus (Cancel/Resume/Manage), cancelling, past due, checkout success/cancelled banner, action failed | Upgrade sheet | `badge`, `button`, `status-message`, `drawer` |
| Billing | `/settings/billing` | `_app/settings/billing.tsx` | redirect to `/settings/plan` keeping `?checkout=` | | | |
| Display & practice | `/settings/display` | `_app/settings/display.tsx` | `settings/display-settings.tsx`, `appearance-cards.tsx`, `setting-row.tsx`, `common/option-segments.tsx`, `common/option-select.tsx`, `common/panel-section.tsx`; store `lib/display-store.ts`; `ui/display.ts` | Appearance (Dark/Light/System; stored `stage` shown as Dark), distance, reading size with live sample, hyperlegible font, motion, contrast, practice defaults, left-handed (stored on account, needs `me`), display offset; per-field save feedback | none | `badge`, `display`, `label`, `number-field`, `save-status`, `slider`, `select`, `switch`, `toggle-group` |
| Keyboard & pedal | `/settings/keyboard` | `_app/settings/keyboard.tsx` | `settings/keyboard-settings.tsx`; `features/practice/keys-store.ts`, `model/keymap.ts`, `input-mapper.ts` | Single-key shortcuts switch, keys table with Learn per action, learning state ("Press the pedal…", Escape cancels), key test area, Reset | none | `button`, `icons` (`PedalIcon`), `kbd` |
| About | `/settings/about` | `_app/settings/about.tsx` | `settings/about-settings.tsx` | Static | none | none |

Reach for all settings: signed in. Stories: `Screens/Settings` (`features/settings/settings.stories.tsx`): Display, DisplayLadderDefault, DisplayPhone, DisplayStage, Account, Privacy, PrivacyOffline, PrivacyExportPending|Ready|Failed|Unavailable, PrivacyDeleteConfirm, PrivacyDeleteReauth, PrivacyDeleteReauthGoogle, Keyboard, About (+Daylight/Phone variants). `Screens/Settings/Plan` (`features/settings/plan.stories.tsx`): Free, Plus, Cancelling, CheckoutCancelled, UsageFree, UsageLiteUsedUp, UsagePlus, UsagePhone.

---

## 5. `_focus` (onboarding, practice, edit)

### 5.1 Onboarding
| | |
|---|---|
| URL | `/start?step=instrument|level|screen|song&instrument=&level=` |
| Route | `routes/_focus/start/index.tsx` (SSR shell; writes the guest profile to the guest store when signed out) |
| Features | `features/onboarding/onboarding-page.tsx`, `first-song.tsx`, `song-parts.tsx` (`StepDots`), `defaults.ts` (+test), `examples.ts`, `guest-store.ts`, `guest-link.ts`, `guest-entry.ts`, `claim.ts`, `marker.ts` |
| States | Step 1 instrument (choice cards), step 2 level, step 3 "Where's your screen?" (distance cards plus Reading size slider and live sample, skippable), step 4 example song. Step 4: loading (`PracticeLoading`), examples failed or none (`InlineError` with retry), signed-in learner "Add to library" (claim) with pending and error states. |
| Overlays | Back/Skip bar; step 4 hands off to the practice screen (5.2 with `?guide`). |
| ui used | `button`, `choice-card`, `icons/bass`, `icons/distance`, `label`, `radio-card`, `slider`, `step-dots`, `status-message` |
| Reach | Public (signed out uses the guest store; signed in works too). Needs the example manifest, i.e. `GET /v1/examples`. |
| Stories | `Screens/Onboarding` (`features/onboarding/onboarding.stories.tsx`): Instrument, Level, Screen (+Daylight/Phone), FirstSongSignedIn, ExamplesFailed, Guide, SaveProgress, Saved, SaveFailed. Kit: `Kit/Onboarding`. |

### 5.2 Onboarding guide (inside practice, `?guide=true` for a guest on an example)
| | |
|---|---|
| Files | `features/onboarding/guide.tsx` (lazy `OnboardingGuide`), `save-sheet.tsx` |
| States | Phase `song`: song card Dialog with "Play your part". Phase `loop`: up to two coach marks ("pass", "done"), then after a completed pass and with playback stopped, "Save your progress?". |
| Overlays | Song `Dialog` (`ui/dialog`), `CoachMark` x2 (`ui/coach-mark`), Save sheet `Drawer` with the `AuthScreen` form. |
| ui used | `button`, `coach-mark`, `dialog`, `drawer` |

### 5.3 Saved
| | |
|---|---|
| URL | `/start/saved` |
| Route | `routes/_focus/start/saved.tsx` (`ssr: false`; needs sign-in, `requireSignIn`) |
| Features | `features/onboarding/saved-page.tsx`, `claim.ts` |
| States | Claiming (spinner), claimed (next: import your own song), claim failed (`InlineError`). |
| ui used | `button`, `spinner`, `status-message` |
| Stories | `Screens/Onboarding` Saved, SaveFailed |

### 5.4 Practice
| | |
|---|---|
| URL | `/songs/:songId/practice?view=tab|chords&loop=17-20&speed=25..200&mix=your-part|minus-one|original&level=chords_only|simplified|as_transcribed|roots|full|core_groove&tab=loop|mix|progress|fix&guide=true` (bars in `loop` are 1-based) |
| Route | `routes/_focus/songs/$songId.practice.tsx` (`ssr: false`; `beforeLoad`: guest entry for example songs, else `requireSignIn`; `requireAudioEngine`; `pendingComponent: PracticeLoading`) |
| Page | `features/practice/practice-page.tsx` (`PracticePage`, regions, `Overlays`, `Floating`, `CountInCounter`, `usePracticePalette`, `useArrivals`, `useSheetFix`), `practice-context.tsx` (`PracticeProvider`, `usePractice`), `practice-store.ts` (`usePracticeUi`), `layout.ts` |
| Reach | Needs a song id the account owns, or an example id as a guest (see section 9). A fully analysed song shows every state. A freshly imported song walks through Getting ready. |

Layouts (`features/practice/layout.ts`): `desktop` (fine pointer), `tablet-landscape`, `tablet-portrait`, `phone-landscape`, `phone-portrait` (coarse pointer + size/orientation). Desktop regions: song map (`practice-timeline.tsx`), Now column (`now-column.tsx`; below 1024 px a strip), notation (`notation-pane.tsx`), inspector (`inspector.tsx`; docked from 1180 px, else a drawer opened by Tools), transport dock (`transport-dock.tsx`). Tablet/phone: `chord-strip.tsx` over the paper, `glance-view.tsx` on phone portrait, `transport-bar.tsx`. New at HEAD: dragging across the song map scrubs bar by bar; the phone mixer opens on `mini-mixer.tsx` and grows to the Mix tab with "All n stems".

States (all within one screen):

| State | Where | Notes |
|---|---|---|
| Loading | `practice-loading.tsx` (`PracticeLoading`) | Skeleton regions; "Loading your song…" after 1 s. Also shown while `!practice.settled`. |
| Error | `practice-page.tsx` | Song fetch error: `InlineError` inside `FocusShell`. |
| Getting ready / analysing (empty notation) | `getting-ready.tsx` (+`analysis-status.tsx`, `model/getting-ready.ts`), `ui/stage-list`, `ui/worker-status` | Stage list with ETA, part question ("Is guitar the part you play?" with Yes / Pick another dropdown), "What works now" card, failure card with Try again, worker offline notice, not-uploaded state (resume file) |
| Partial | `model/screen.ts`, `banners.tsx` | Layers arrive by kind: beats, then stems, chords, tab/notes, summary. Chords-only sheet, chords-only fallback, "Show tab anyway", rough part, "Tab is ready · Show" toast |
| Playing states | `model/player-machine.ts` | `loading`, `ready`, `countIn`, `playing`, `paused`, `loopRest`, `assess`, `audition`; count-in counter overlay |
| Success / populated | all regions | Tab, Notes, Staff, Chords; piano chart, roll, staff; drums grid/staff; vocal melody; glance |
| Banners | `banners.tsx` (`PracticeBanners`) via `ui/status-message` | chords-only (piano/vocals/reason), notes unsure, stage failure, rough part, interrupted audio ("tap to resume"), audio failed / not offline, screen tip, stems expired (Recreate stems) |

Overlays on practice:

| Overlay | Kind | File | Open by |
|---|---|---|---|
| Inspector | docked panel (desktop ≥ 1180 px) or `Drawer` | `inspector.tsx` (tabs Loop, Mix, Progress, Fix; Mix tab shows a dot when the mix differs from default, Fix shows the unsure count) | Tools button, loop/mix pills, `?tab=` |
| Loop tab | tab body | `loop-tab.tsx`, `ladder-card.tsx`, `loop-panel.tsx` (popover for tablets/phones) | |
| Mix tab | tab body | `mix-tab.tsx`, `mix-copy.ts`, `mixer-prefs.ts`, `stem-names.ts`, `model/mixer.ts`, `hear-chords.tsx` | |
| Progress tab | tab body | `progress-tab.tsx`, `progress-data.ts`, `progress-copy.ts`, `progress-goal.ts`, `model/progress-metrics.ts` | |
| Fix tab and Fix mode | tab + dock + key line | `fix-tab.tsx`, `fix-mode.tsx`, `fix-cards.tsx`, `fix-history.tsx`, `fix-store.ts`, `fix-synth.ts`, `editor-content.tsx` | `E`, `J`, `K`, clicking an unsure chord, `?tab=fix` |
| Mixer drawer | right `Drawer` (tablet) or bottom sheet with mini-mixer (phone) | `mixer-drawer.tsx`, `mini-mixer.tsx` | Mix button |
| Editor sheet | `Drawer` (bottom on touch, side on landscape tablet) | `editor-sheet.tsx` | tap a chord or press `E` on touch |
| Shortcuts overlay | `Dialog` | `shortcuts-overlay.tsx`, `key-bindings.tsx` | `?` (desktop, single keys on) or More → Keyboard shortcuts |
| Display and reading popover | `Popover` | `display-popover.tsx` | "Aa" button or ⌘K "Display and reading" |
| More (⋯) popover | `Popover` | `more-panel.tsx` | ⋯ button (Keyboard shortcuts, Open full editor, Video, Keyboard & pedal) |
| Legend chip | `Popover` | `ui/confidence-legend`, `confidence-legend-panel` via `status-controls.tsx` | top bar chip |
| Level and Capo | `Popover` | `score-tools.tsx`, `now-column.tsx` (rows) | Level/Capo buttons |
| Piano options / phrase options | `Popover` | `piano-options.tsx`, `phrase-strip.tsx` | strip end |
| Speed panel | `Popover` | `ui/speed-panel` via `ui/speed-control`, `transport-dock.tsx`, `transport-bar.tsx` | speed readout |
| Volume panel | `Popover` | `volume-panel.tsx` | narrow dock volume |
| Click level stepper | `Popover` | `mix-tab.tsx` | dB readout |
| Ladder chip steppers | `Popover` | `ladder-card.tsx` | chips |
| Pass prompt | floating sheet over the notation | `pass-prompt.tsx` | after a pass while a loop is on |
| PedalHud | floating chip | `ui/pedal-hud` | every handled key/pedal action |
| Video pane | floating player | `video-pane.tsx`, `video-url.ts` | More → Video (URL imports with downloaded video) |
| Song-clips menus | `DropdownMenu` (row More: Rename, Delete), inline rename field, toast with Undo | `loop-tab.tsx`, `clip-actions.ts` | |
| Fix pill, Fix dock, key line | in-shell | `fix-mode.tsx` (`FixPill`, `FixDock`, `FixKey`) | |
| Onboarding guide | Dialog, coach marks, Save sheet | see 5.2 | `?guide=true` as guest |
| Command palette | see 0.2 | | ⌘K |

Notation components: `notation-pane.tsx`, `staff-view.tsx`, `chord-sheet.tsx`, `chord-strip.tsx`, `chord-shape.tsx`, `piano-chart.tsx`, `piano-notes.tsx`, `piano-strip.tsx`, `piano-voicing.ts`, `guitar-notes.tsx`, `drum-notes.tsx`, `vocal-melody.tsx`, `notation-motion.ts`, `score-theme.ts`, `bar-text.ts`, plus `packages/notation` (section 8).

ui used by the practice feature files (union): `badge`, `beat-pulse`, `button`, `chord-chip`, `confidence-legend`, `dialog`, `drawer`, `dropdown-menu`, `icons`, `input`, `kbd`, `label`, `loop-badge`, `mix-preset-group`, `number-field`, `pass-control`, `pedal-hud`, `popover`, `popover-content`, `progress-chart`, `skeleton`, `slider`, `speed-control`, `speed-ladder`, `spinner`, `stage-list`, `stat-card`, `status-message`, `stem-row`, `switch`, `tabs`, `toast`, `toggle`, `toggle-group`, `transport-button`, `waveform-timeline`, `worker-status` (the spinner/skeleton/worker-status are on the Getting ready and loading paths; `sparkline` is used by `progress-chart`).

Stories: `Screens/Practice` (`features/practice/practice.stories.tsx`, 141 stories; data in `practice-story-data.ts`): Loading, Analysing, BeatsFound, PartQuestion, WorkerOffline, AnalysisFailed, PedalBeforeLoop, Chords, StemsUnavailable, Ready, LoopActive (+Wide/1180), InspectorDrawer, NowStrip, ChordsView, WithVideo, StemsExpired, ScreenMayLock, NotSavedOffline, ChordsOnlyFallback, Resume*, Editor, Mixer, Glance, Piano* (chart, notes, staff, glance, options), DisplayPopover, LegendChip, LevelAndCapo, LoopOptions, SpeedPanel, MorePanel, ShortcutsOverlay, Edit, GuitarNotes* , BassNotes, VocalMelody*, Drums*, InspectorMix/Progress/Fix/Loop*, PassPrompt*, DockTargets, SpeedKeys, SingleKeysOff, Follow*, ReducedMotion, Playhead*, UncertaintyOff, Ladder*, SavedClips, ClipRename, ClipDeleteUndo, and Daylight/Phone/Tablet/Stage variants. `Screens/Practice Fix` (`fix.stories.tsx`, 25), `Screens/Practice Mix` (`mix.stories.tsx`, 24; new), `Screens/Practice Progress` (`progress.stories.tsx`, 16; new; data in `progress-story-data.ts`).

### 5.5 Edit (full editor)
| | |
|---|---|
| URL | `/songs/:songId/edit` |
| Route | `routes/_focus/songs/$songId.edit.tsx` (`ssr: false`; `requireSignIn`; `requireAudioEngine`; `pendingComponent: PracticeLoading`) |
| Features | `features/practice/edit-page.tsx`, `editor-content.tsx`, `fix-cards.tsx`, `fix-history.tsx`, `fix-mode.tsx` (`FixPill`, `FixDock`), `fix-store.ts`, `practice-context.tsx` |
| States | Loading (`PracticeLoading`); Fix mode on a page of its own with the notation wide and the Fix cards in an inspector; empty selection; Undo/Redo and "Hear original" in the top bar. Desktop-first; touch devices should use Practice `?tab=fix` (opens the editor sheet). |
| Overlays | Toasts with Undo, `Popover`s inside the Fix cards (chord alternatives), no dialogs. |
| ui used | `button`, plus the Fix card dependencies (`chord-chip`, `input`, `number-field`, `badge`, `switch`) |
| Reach | Signed in, an analysed song; reached from Practice ⋯ → Open full editor (not offered to guests). |
| Stories | `Screens/Practice` Edit; `Screens/Practice Fix` Editor, EditorDaylight |

---

## 6. Keyboard and pedal shortcut map (practice screen)

Definition files:
- `apps/web/app/features/practice/model/keymap.ts` — `ACTIONS`, `DEFAULT_KEYS`, `PEDAL_ARROWS`, `resolveKey`, `keyOf`, `ignoredTarget`, `learn`, `readLearnedKeys`; storage key `splitune.keys`.
- `apps/web/app/features/practice/input-mapper.ts` — `useInputMapper` (global `keydown`), `keyLabel`, `actionLabel`, `unsureAfter`.
- `apps/web/app/features/practice/keys-store.ts` — zustand `useKeys` (`learned`, `singleKeys`, `learning`), persisted.
- `apps/web/app/features/practice/key-bindings.tsx` — table in the `?` overlay.
- `apps/web/app/features/settings/keyboard-settings.tsx` — Settings → Keyboard & pedal.
- `apps/web/app/ui/pedal-hud.tsx` plus `practice-store.ts` (`showHud`, `pressedWith`) — action confirmations as "{source} · {action}".
- `apps/web/app/features/shell/palette-launcher.tsx` — ⌘K.
- `apps/web/app/features/practice/shortcuts-overlay.tsx` — `?` dialog.
- `apps/web/app/features/practice/fix-mode.tsx` — Esc leaves Fix mode.
- `apps/web/app/features/practice/edit-page.tsx` — editor keys.

| Action (id) | Default keys | Notes |
|---|---|---|
| Play / pause (`playPause`) | Space, Enter | Space and Enter do not act while a button, link, tab, switch or menu item has focus |
| Restart (`restart`) | ←, Page Up | "Restart loop" while looping, else back a bar |
| Next bar (`next`) | →, Page Down | |
| Slower (`slower`) | `,` | 5 % step; Shift: 1 % |
| Faster (`faster`) | `.` | 5 % step; Shift: 1 % |
| Felt clean (`clean`) | `c` | needs an active loop; also the pass prompt button |
| Not yet (`notYet`) | `n` | needs an active loop |
| Toggle loop (`toggleLoop`) | `l` | for vocals with no loop, loops the phrase being sung |
| Mute my part (`mutePart`) | `m` | |
| Next unsure spot (`nextUnsure`) | `j` | Fix |
| Previous unsure spot (`previousUnsure`) | `k` | Fix |
| Edit this bar (`fixBar`) | `e` | Fix |
| Previous phrase (`previousPhrase`) | `[` | vocals |
| Next phrase (`nextPhrase`) | `]` | vocals |
| Cue note (`cueNote`) | `p` | vocals |

Other keys and rules:
- **Learned keys.** One per action, added to the defaults, per device; Learn this pedal binds the next key (Esc cancels, Tab/Shift ignored).
- **↑ / ↓.** Never change speed. Before any key is learned they show the HUD "Pedal detected? Set it up" (link to `/settings/keyboard`). Once a key is learned they do nothing unless learned.
- **Single-key switch.** With `singleKeys` off (WCAG 2.1.4), character keys are inert. Chords, Space/Enter, arrows, Page Up/Down and learned keys still work.
- **`?`.** Opens the shortcuts overlay (desktop, single keys on).
- **⌘/Ctrl + K.** Opens the command palette, also with single keys off.
- **⌘/Ctrl + Z / ⌘/Ctrl + Shift + Z.** Undo / redo (practice and edit).
- **Esc.** Leaves Fix mode, unless a field or popup has the key.
- **Ignored targets.** `ignoredTarget` ignores fields, sliders and open dialog, menu or listbox popups.
- **Edit page (`edit-page.tsx`).** Space plays the selected bars, J/K step spots, ←/→ select the previous/next note, Delete or Backspace removes the selected note, ⌘/Ctrl Z undo.

---

## 7. `apps/web/app/ui` components

Support files (no component): `display.ts` (display preferences and the `DISPLAY_SCRIPT` head script; test `display.test.ts`), `fixtures.ts` (story data), `story-kit.tsx` (story helpers: `BOTH_THEMES`, `StateGrid`, `expectTargets`, `expectUnavailable`, `themeFrames`).

Stories files are in `apps/web/app/ui/` and named `<name>.stories.tsx`. "via X" means the component has no stories file of its own and appears in X.

| File | Exported names | Purpose | Stories |
|---|---|---|---|
| `alert-dialog.tsx` | AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogMedia, AlertDialogOverlay, AlertDialogPortal, AlertDialogTitle, AlertDialogTrigger | irreversible-action dialog | via `dialog.stories.tsx` |
| `badge.tsx` | Badge, badgeVariants | 24 px status pill | via `display`, `feedback`, `tabs` stories |
| `beat-pulse.tsx` | BeatPulse | per-beat dots (downbeat square), static until animation work | none |
| `brand.tsx` | BrandMark, Wordmark, MARK_PATHS | logo mark and wordmark | `brand.stories.tsx` |
| `button.tsx` | Button, buttonVariants, SPINNER_DELAY_MS | pill button, variants/sizes, `loading` | `button.stories.tsx` |
| `card.tsx` | Card, CardAction, CardContent, CardDescription, CardFooter, CardHeader, CardTitle | bordered card | via `display.stories.tsx` |
| `checkbox.tsx` | Checkbox | 18 px checkbox in 44 px target | via `form.stories.tsx` |
| `choice-card.tsx` | ChoiceCard | big tap-to-choose rows (onboarding) | via `onboarding.stories.tsx` |
| `chord-chip.tsx` | ChordChip, ChordSymbol, chordText, ChordTiming | chord pill with confidence encoding (dashed, "?") | via `music.stories.tsx` |
| `coach-mark.tsx` | CoachMark | dismissible non-modal tip | via `onboarding.stories.tsx` |
| `confidence-legend-panel.tsx` | ConfidenceLegendPanel | legend body for the popover | via `music.stories.tsx` |
| `confidence-legend.tsx` | ConfidenceLegend, ConfidenceLegendPopover | key to confidence marks | via `music.stories.tsx` |
| `dialog.tsx` | Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogOverlay, DialogPortal, DialogTitle, DialogTrigger | modal sheet | `dialog.stories.tsx` |
| `drawer.tsx` | Drawer, DrawerClose, DrawerContent, DrawerDescription, DrawerFooter, DrawerHeader, DrawerOverlay, DrawerPortal, DrawerSwipeHandle, DrawerTitle, DrawerTrigger | side or bottom drawer | `drawer.stories.tsx` |
| `drop-zone.tsx` | DropZone | file drop target | via `import.stories.tsx` |
| `dropdown-menu.tsx` | DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuGroup, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuShortcut, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger | menu | via `overlays`, `library` stories |
| `empty-state.tsx` | EmptyState | icon, heading, one sentence, actions | via `feedback.stories.tsx` |
| `field.tsx` | Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSeparator, FieldSet, FieldTitle | form field layout | via `form.stories.tsx` |
| `icons/index.tsx` (+ `bass.tsx`, `check-draw.tsx`, `create.tsx`, `distance.tsx`) | PedalIcon, CapoIcon, TabStaffIcon, ChordBoxIcon, CountInIcon, MinusOneIcon, YourPartIcon, TwoPedalsIcon, DistanceDeskIcon, DistanceStandIcon, DistanceFloorIcon, CUSTOM_ICONS; BassIcon; CheckDrawIcon, CircleCheckDrawIcon; createIcon, ICON_STROKE; DistanceIllustration | custom icon set | via `brand.stories.tsx`, `foundations.stories.tsx` |
| `input.tsx` | Input | text field | via `form.stories.tsx` |
| `kbd.tsx` | Kbd, KbdGroup | key cap | via `display.stories.tsx` |
| `label.tsx` | Label | form label | via `form.stories.tsx` |
| `loop-badge.tsx` | LoopBadge | loop pill with pass/rest | via `transport`, `mixer` stories |
| `meter.tsx` | Meter, MeterLabel, MeterValue | measured value (allowance, level) | via `display`, `mixer` stories |
| `mix-preset-group.tsx` | MixPresetGroup, MixPreset | 2×2 mix preset radio cards (changed at HEAD; "Rhythm only" added) | via `mixer.stories.tsx` |
| `number-field.tsx` | NumberField | stepper with ± halves | `number-field.stories.tsx` |
| `pass-control.tsx` | PassControl | Felt clean / Not yet | via `transport.stories.tsx` |
| `pedal-hud.tsx` | PedalHud, PEDAL_HUD_MS | key/pedal confirmation chip | via `feedback`, `transport` stories |
| `popover.tsx` | Popover, PopoverTrigger | root and trigger only | via `overlays`, `speed-ladder` stories |
| `popover-content.tsx` | PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle | positioned popover parts (lazy-loadable) | via `overlays.stories.tsx` |
| `progress.tsx` | Progress, ProgressIndicator, ProgressLabel, ProgressTrack, ProgressValue | upload/analysis bar | via `display`, `feedback`, `library` stories |
| `progress-chart.tsx` | ProgressChart, ProgressPoint | Last 30 days chart (new) | `progress-chart.stories.tsx` |
| `radio-card.tsx` | RadioCard, RadioCardGroup | choice cards (Full/Lite, distances) | via `import.stories.tsx` |
| `radio-group.tsx` | RadioGroup, RadioGroupItem | radio | via `form.stories.tsx` |
| `save-status.tsx` | SaveStatus | per-field "Saving… / Saved" | `save-status.stories.tsx` |
| `scroll-area.tsx` | ScrollArea, ScrollBar | scroll container | via `display.stories.tsx` |
| `select.tsx` | Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectScrollDownButton, SelectScrollUpButton, SelectSeparator, SelectTrigger, SelectValue | select | via `overlays.stories.tsx` |
| `separator.tsx` | Separator | rule | via `display.stories.tsx` |
| `skeleton.tsx` | Skeleton | loading placeholder | via `display`, `feedback`, `library` stories |
| `slider.tsx` | Slider | horizontal, vertical, range | `slider.stories.tsx` |
| `song-card.tsx` | SongCard, SongRow, InstrumentTile | library entries | via `library.stories.tsx` |
| `sparkline.tsx` | Sparkline, chartPath, chartPosition, speedRange, ChartValue | library 30-day line (new) | via `progress-chart.stories.tsx` |
| `speed-control.tsx` | SpeedControl, SPEED_STEP, SPEED_FINE_STEP, formatSpeed | speed −/+/readout | via `transport`, `speed-ladder`, `transport-button` stories |
| `speed-panel.tsx` | SpeedPanel, SpeedPresets, SPEED_PRESETS | speed popover body | via `speed-control` (none own) |
| `speed-ladder.tsx` | SpeedLadder, LadderChip, LadderIcon | ladder rungs | `speed-ladder.stories.tsx` |
| `spinner.tsx` | Spinner | spinner | via `display.stories.tsx` |
| `stage-list.tsx` | StageList, Stage, StageStatus | analysis stage list | via `feedback.stories.tsx` |
| `stat-card.tsx` | StatCard, StatCards | figure + label (new) | via `progress-chart.stories.tsx` |
| `status-message.tsx` | Banner, InlineError, StatusTone | page banner / inline message | via `feedback.stories.tsx` |
| `stem-row.tsx` | StemRow, StemRowSkeleton, StemToggle, STEM_FILL, STEM_RULE, GAIN_RANGE, formatDb | mixer stem row (changed at HEAD) | via `mixer.stories.tsx` |
| `step-dots.tsx` | StepDots | onboarding progress | via `onboarding.stories.tsx` |
| `switch.tsx` | Switch | toggle switch | via `form.stories.tsx` |
| `tabs.tsx` | Tabs, TabsContent, TabsList, TabsTrigger | tabs (`look="segmented"` option) | `tabs.stories.tsx` |
| `toast.tsx` | Toaster, toast, Toast* parts, createToastManager, useToastManager | toasts with Undo | `toast.stories.tsx` |
| `toggle.tsx` | Toggle, toggleVariants | chip toggle | `toggle.stories.tsx` |
| `toggle-group.tsx` | ToggleGroup, ToggleGroupItem | segmented group | via `toggle.stories.tsx` |
| `tooltip.tsx` | Tooltip, TooltipProvider, TooltipTrigger, WithTooltip | tooltip root/trigger | via `overlays.stories.tsx` |
| `tooltip-content.tsx` | TooltipContent | tooltip popup | via `overlays.stories.tsx` |
| `transport-button.tsx` | TransportButton | practice icon button with label | `transport-button.stories.tsx` |
| `waveform-preview.tsx` | WaveformPreview | static waveform of a picked file | via `library`, `import` stories |
| `waveform-timeline.tsx` | WaveformTimeline, TimelineLane, TimelineBar, columnLevels | song map canvas (scrub changed at HEAD) | `waveform-timeline.stories.tsx` |
| `worker-status.tsx` | WorkerStatus | "machine offline" notice | via `feedback.stories.tsx` |

Other `ui/*.stories.tsx` files: `foundations.stories.tsx` (`Foundations/Overview`), `form.stories.tsx` (`Base/Form controls`), `overlays.stories.tsx` (`Base/Overlays`), `display.stories.tsx` (`Base/Display`), `feedback.stories.tsx` (`Kit/Feedback`), `music.stories.tsx` (`Kit/Chords and confidence`), `notation.stories.tsx` (`Kit/Notation`), `mixer.stories.tsx` (`Kit/Mixer`), `transport.stories.tsx` (`Kit/Transport`), `import.stories.tsx`, `library.stories.tsx`, `onboarding.stories.tsx`, `progress-chart.stories.tsx` (`Kit/Progress`). `apps/web/.storybook/fonts.stories.tsx` is `Foundations/Fonts`.

Shared feature pieces outside `ui/`: `features/common/option-segments.tsx`, `option-select.tsx`, `panel-section.tsx`; `features/story-fixtures.ts`.

---

## 8. `packages/ui-tokens` and `packages/notation`

### 8.1 `packages/ui-tokens` (`@splitune/ui-tokens`)
Files:
- `package.json` — exports `.` (`src/index.ts`) and `./primitives.css`, `./themes.css`, `./theme.tailwind.css`, `./fonts.css`; scripts `typecheck`, `test` (vitest).
- `src/primitives.css` — tier 1: static OKLCH literals, only read by `themes.css`.
- `src/themes.css` — tier 2 semantic roles and tier 3 component tokens per appearance.
- `src/theme.tailwind.css` — Tailwind v4 mapping.
- `src/fonts.css` — `@font-face` for Figtree, JetBrains Mono, Atkinson Hyperlegible Next.
- `src/index.ts` — typed names and metadata.
- Tests: `contrast.test.ts`, `palette.test.ts`, `tokens.test.ts`, helper `src/testing/cascade.ts`.

Token groups and naming:
- **Primitives** (`primitives.css`)
  - Neutrals `--black`, `--gray-<L×1000>` (24 steps), `--white`.
  - Washes `--white-soft`, `--white-line`, `--ink-soft`, `--ink-line`.
  - Status `--unsure-*`, `--ok-*`, `--bad-*`, each `-dark` / `-light` plus `-surface-*`.
  - Stem hues `--teal-*`, `--violet-*`, `--sky-*`, `--pink-*`, `--lime-*`, `--stone-*`, each `-dark` / `-light`.
- **Semantic roles** (`SEMANTIC_ROLES` in `index.ts`)
  - shadcn roles: `--background`, `--foreground`, `--card`, `--popover`, `--primary`, `--secondary`, `--muted`, `--accent`, `--destructive`, `--border`, `--input`, `--ring`, each with `-foreground`.
  - Splitune roles: `--faint-foreground`, `--border-strong`, `--primary-ink`, `--primary-soft`, `--primary-line`, `--signal`, `--unsure`, `--unsure-surface`, `--success`, `--warning`, `--info`, `--edited`, `--surface-raised`, `--surface-sunken`, `*-surface`, `--paper`, `--ink`, `--conf-medium`, `--conf-medium-edge`, `--conf-low`, `--stem-{guitar,bass,drums,vocals,keys,other}`, `*-more` increased-contrast variants, `--elevation-{1,2,3,capsule,play}`, `--glow`, `--read-scale`.
  - Aliases `ALIAS_ROLES` (`--stem-mix`, `--chart-1..5`, `--sidebar-*`, `--focus-width`).
- **Component tokens** (`COMPONENT_TOKENS`)
  - Timeline and score: `--bar-current`, `--loop-fill`, `--loop-edge`, `--score-loop-fill`, `--score-loop-edge`, `--playhead`, `--score-playhead`, `--now-line`, `--staff`, `--waveform-*`, `--hatch`.
  - Beats and keys: `--beat-now/done/slot`, `--key-white/black/left/right` (+`-fg`).
  - Notation: `--fret-guitar`, `--fret-bass`, `--melody-vocals`.
  - Other: `--tile-foreground`, `--scrim`, `--capsule`, `--hud-bg/-fg`.
- **Reading tokens** (`READING_TOKENS`): `--read-tab`, `--read-chord-current`, `--read-chord-next`, `--read-chord-sheet`, `--read-chord`, `--read-bar-number`, `--read-readout`, `--read-label`. Derived from `--read-tab-base` × `--read-factor` per distance, with `--read-calibration` set by the display script.
- **Targets:** `--target-min`, `--target-sm`, `--target`, `--target-practice-2`, `--target-practice`, `--target-stand`. `--control-size` follows density: browse = `--target`, practice = `--target-practice-2`. Exposed as `spacing-target*` utilities.
- **Motion:** `--duration-{fast,base,slow,slower}`, `--stagger`, `--ease-{standard,enter,exit,spring,smooth,snappy}`, `--animate-{rise-in,pop-in,check-draw,shimmer,progress-indeterminate}`.
- **Tailwind theme** (`@theme` in `theme.tailwind.css`)
  - Clears the default colour, font, text, radius, shadow and ease scales, so palette classes such as `bg-red-500` produce nothing.
  - `--spacing: 0.25rem`.
  - Fonts: `--font-sans`, `--font-display`, `--font-mono`, `--font-reading`, `--font-reading-mono`.
  - Radii: `--radius` 0.625rem and `--radius-xs…5xl`.
  - Shadows: `--shadow-{1,2,3,glow,capsule,play}`.
  - Containers: `--container-{library,settings,pricing,marketing,onboarding,form,reading,page,bare}`.
  - Z-index: `--z-{sticky,overlay,popover,toast,hud}`.
  - Text sizes: about 72 `--text-*` entries, including `text-read-*`.
- **Custom variants** (`theme.tailwind.css`): `dark`, `practice`, `stage`, `contrast-more`, `pointer-coarse`, `pointer-fine`.
- **Typed exports** (`index.ts`)
  - Lists: `APPEARANCES` (`light`, `dark`, `stage`), `CONTRASTS`, `DENSITIES` (`browse`, `practice`), `DISTANCES` (`desk`, `stand`, `floor`).
  - Data: `CONTRAST_PAIRS`, `STEMS`, `CONFIDENCE`, `CONFIDENCE_OUTLINE_PX`, `MAX_FLASHES_PER_SECOND`, `BACKGROUND_HEX`.
  - Functions: `readToken()`, `readColor()` (for canvas and alphaTab, which cannot parse OKLCH).

How themes are switched:
- `apps/web/app/ui/display.ts` `applyDisplay()` sets attributes on `<html>`: `data-appearance` (`dark|light|stage`), `data-contrast`, `data-motion`, `data-distance`, `data-reading-font`, `data-score` (`paper|match`). It also toggles the `.dark` class, sets `color-scheme` and the `--read-calibration` variable.
- `DISPLAY_SCRIPT` is injected inline in `<head>` by `routes/__root.tsx`, reading `localStorage['splitune.display']` and the media queries, before first paint.
- Dark is the `:root` default, so the no-JS page is Dark.
- `stage` shares Dark's colours, raises `--read-scale` and raises the distance to at least `stand`.
- Subtrees can show the other theme through any element carrying `data-appearance` (Storybook "Side by side").
- Density is set per shell with `data-density="browse|practice"`.
- The user's choice is stored by `lib/display-store.ts` and applied by `features/system/display-sync.tsx`; the controls are in the account menu, ⌘K, the practice Aa popover and Settings → Display.
- Storybook sets the same attributes from toolbar globals (`.storybook/preview.tsx`).

How tokens reach CSS: `apps/web/app/styles.css` imports `tailwindcss`, `tw-animate-css`, `shadcn/tailwind.css`, then `@splitune/ui-tokens/primitives.css`, `themes.css`, `fonts.css`, `theme.tailwind.css`, plus `@source "../../../packages/notation/src"`. Tailwind v4 (`@tailwindcss/vite`) compiles it. Components use utilities (`bg-card`, `text-muted-foreground`, `text-read-tab`, `rounded-xl`, …) and `var(--token)` references. JS consumers call `readToken()` / `readColor()`. The `theme-color` meta in `__root.tsx` uses `BACKGROUND_HEX`.

### 8.2 `packages/notation` (`@splitune/notation`)
Exports `.` (light entry: types, diagrams, rolls) and `./view` (alphaTab view, loaded lazily on the practice route). Tests in `packages/notation/test/` (`drum-grid`, `fretboard`, `piano-roll`, `score`, `melody`).

| Source file | Role |
|---|---|
| `src/alphatab-view.tsx` | `<AlphaTabView>`: one AlphaTabApi, web-worker render, follows the audio clock |
| `src/external-media.ts` | alphaTab player in external-media mode |
| `src/score.ts` | alphaTex to score model, per-note ink |
| `src/resources.ts` | fonts and colours of the rendered score from tokens (`ScoreTheme`) |
| `src/geometry.ts` | overlay geometry from alphaTab bounds (bar taps, cursor, loop shading) |
| `src/assets.ts` | Bravura font asset |
| `src/chord-diagram.tsx` | `ChordDiagram` |
| `src/fretboard.ts`, `fretboard-diagram.tsx`, `guitar-roll.tsx` | guitar/bass Notes lanes and neck |
| `src/keyboard-diagram.tsx`, `piano-roll.tsx` | piano keyboard and falling notes |
| `src/drum-grid.tsx` | drum grid |
| `src/melody.ts`, `melody-roll.tsx` | vocal melody roll |
| `src/types.ts`, `view.ts`, `index.ts` | shared types, view entry, light entry |

---

## 9. Lint scripts that encode token or UI rules

| Script | Path | What it enforces |
|---|---|---|
| `check-ui-tokens` | `scripts/check-ui-tokens.mjs` (tests: `scripts/check-ui-tokens.test.mjs`) | Run by root `pnpm lint` (`node scripts/check-ui-tokens.mjs`). Base rules on all tracked `apps/**` and `packages/**` source (ts, tsx, js, jsx, mjs, cjs, css) except `packages/ui-tokens/`: no raw colour literals (hex, rgb(), hsl(), oklch() …); no Tailwind palette classes (`bg-red-500`, `text-white` …); no `outline-none` / `outline-hidden` without a `focus-visible:outline-*` replacement, and no CSS `outline: none|0`; no one-off durations, delays or easings (use `--duration-*` / `--ease-*`). Raw-value rules (default scope `apps/web/app/ui/`, change with `--path <dir>`, repeatable): no arbitrary colours (`bg-[white]`, named or system colours, `color-mix()`); no arbitrary radii; no arbitrary font sizes (em multiples and token references pass); no arbitrary shadows; no style-prop colour literals. |
| `biome check .` | `biome.json` (root) | Formatting and lint (includes a11y rules, e.g. `useSemanticElements`), run by `pnpm lint`. |
| `check-db-access` | `scripts/check-db-access.mjs` | Part of `pnpm lint`; database access rule, not UI. |
| copy-keys test | `apps/web/app/copy-keys.test.ts` (unit project) | Every catalogue key exists with its copy in `apps/web/messages/en.json`, every key used in code exists, and screens carry no hard-coded user-facing strings. |
| token tests | `packages/ui-tokens/src/tokens.test.ts`, `contrast.test.ts`, `palette.test.ts` | Primitives are OKLCH and in sRGB, only roles read primitives, component tokens never point at primitives, every `CONTRAST_PAIRS` entry meets its WCAG ratio in every appearance × contrast, forced-colours mapping, CVD separation of stems, no-JS fallbacks. Run via `pnpm test` (turbo). |
| `css-floor` | `apps/web/scripts/css-floor.mjs` (`pnpm --filter @splitune/web css-floor`) | Built CSS in `.output/public/assets/` uses nothing above the Safari 16.4 / Chrome 111 / Firefox 128 floor (no `light-dark()`, relative colour syntax, `@scope`, native nesting). |
| `budget` | `apps/web/scripts/bundle-budget.mjs` (`pnpm --filter @splitune/web budget`, `--enforce` fails) | Practice route JS ≤ 320 KB gzip (alphaTab and WASM excluded). |
| Storybook a11y gate | `apps/web/.storybook/preview.tsx` (`parameters.a11y.test = 'error'`) | axe failures fail every story test. |
| Target-size probes | `app/ui/story-kit.tsx` (`expectTargets`) | Used inside stories to assert control target sizes. |

---

## 10. Storybook, Vitest, Playwright for `apps/web`

Storybook (10.6):
- Config: `apps/web/.storybook/main.ts` (framework `@storybook/react-vite` with `vite.base.ts`, so no Start/Nitro; stories `../app/**/*.stories.tsx` and `./*.stories.tsx`; addons `@storybook/addon-a11y`, `@storybook/addon-vitest`; `staticDirs ['../public']`; head script `DISPLAY_SCRIPT` and Figtree preload), `preview.tsx` (decorator applying display globals and optional side-by-side Dark/Light frames; toolbar globals appearance, contrast, density, distance, motion, pointer, readingFont), `app.tsx` (router/query wrapper for screen stories), `fonts.stories.tsx`.
- Story title groups: `Foundations/`, `Base/`, `Kit/`, `Brand/`, `Screens/`. The `Screens/` stories use fixture data and no network.
- Commands (`apps/web/package.json`): `storybook` (`storybook dev -p 6006`), `storybook:build` (`pnpm run generate && storybook build -o storybook-static`).
- Launch config: `.claude/launch.json` entry `storybook` runs `pnpm --filter @splitune/web storybook --no-open` on port 6006.

Vitest (5.0.5), `apps/web/vitest.config.ts` (extends `vite.base.ts`):
- Project `unit` (node): `app/**/*.test.ts` (co-located tests such as `features/**/model/*.test.ts`, `lib/*.test.ts`, `ui/display.test.ts`, `copy-keys.test.ts`, `manifest.test.ts`). Command: `pnpm --filter @splitune/web test` (runs `generate` first).
- Projects `storybook` (Chromium) and `storybook-webkit` (WebKit, one file at a time): every story is a test with axe. Command: `test:stories` (`vitest run --project=storybook*`).
- Root `pnpm test` = `turbo run test && vitest run --dir scripts` (so `scripts/*.test.mjs` run too). `pnpm typecheck` = turbo.

Playwright e2e:
- Config `apps/web/playwright.config.ts`:
  - `testDir ./e2e`, ignores `visual/**`.
  - `baseURL` and `APP_URL` are `http://localhost:3000`.
  - One worker.
  - `globalSetup ./e2e/global-setup.ts` builds a throwaway database on the compose Postgres, starts Mac workers in `ML_MODE=mock`, builds the example song `e2e-riff` via `apps/api/scripts/examples/build.ts`, and runs the built server on :3000.
  - Projects: chromium, firefox (remote `PW_FIREFOX_WS_ENDPOINT`), webkit, mobile-chrome (Pixel 7), mobile-safari (iPhone 15), tablet-safari (iPad Pro 11 landscape), tablet-chrome (Galaxy Tab S4).
  - `E2E_SMOKE=1` limits to desktop engines and the journey, practice, onboarding and account specs.
- Specs in `apps/web/e2e/`: `a11y`, `account`, `billing`, `fallbacks`, `fix`, `floor` (+`floor/`), `journey`, `mixer` (new), `onboarding`, `perf`, `perf-practice`, `practice`, `practice-keys`, `progress` (new), `pwa`, `security`, `settings`, `speed-ladder`; helpers `helpers.ts` (`signIn`, `wav`, `projectContext`, `collectErrors`), baseline `perf-baseline.json`.
- Commands: `e2e` (`playwright test`), `e2e:smoke`, `e2e:floor` (`E2E_FLOOR=1 playwright test e2e/floor.spec.ts --project chromium`), root `pnpm e2e` (turbo, depends on build).
- Visual regression:
  - Config `apps/web/playwright.visual.config.ts`.
  - Specs `apps/web/e2e/visual/screens.spec.ts`, `components.spec.ts`, `focus.spec.ts`, helper `story.ts` (fixed clock 2026-10-22), `volatile.css`.
  - Baselines in `e2e/visual/__screenshots__/{chromium,webkit}/`.
  - It serves `storybook-static` on port 6106 (`scripts/serve-static.mjs`) and runs in the pinned Linux Playwright image via `scripts/visual.mjs`.
  - Commands: `e2e:visual`, `e2e:visual:update`.
- Other: `lighthouse` (`lhci autorun`, `lighthouserc.json`).

---

## 11. Local dev server, seed and demo data

Dev server:
- `pnpm --filter @splitune/web dev` runs `vite dev`, with `server: { port: 3000, strictPort: true }` in `apps/web/vite.config.ts`.
  - Port 3000, URL `http://localhost:3000`.
  - It reads the repository `.env` (created from `.env.example` by `pnpm run setup`).
  - Needs the compose Postgres and bucket for real data (`infra/docker-compose.yml`).
- Root scripts (`package.json`):
  - `dev` = `docker compose -f infra/docker-compose.yml up -d && turbo run dev`.
  - `dev:all` = `node scripts/dev.mjs` (stack, migrations, web, node-worker and ml-worker in one dashboard).
  - `dev:web` = web and stack only.
  - `dev:remote-workers`, `dev:stack-workers`, `dev:remote-stack`, `workers`, `workers:prod`.
- Env keys relevant to UI work (`.env.example`): `APP_URL`, `PORT`, `DATABASE_URL`, `BETTER_AUTH_URL`, `ML_MODE` (`mock` returns golden fixtures from `packages/contracts/fixtures`, no GPU needed), `BILLING_PROVIDER` (`mock`), `ENABLE_DEV_CLOCK`.
- Storybook (no backend, fixture data): `pnpm --filter @splitune/web storybook` on port 6006 (`.claude/launch.json` `storybook`).
- Only `.claude/launch.json` entry is `storybook`; there is no launch entry for the app server.
- Built-app e2e server: also port 3000, started by `e2e/global-setup.ts`.

Seed and demo data:
- `pnpm seed` → `packages/db/scripts/seed.ts`. It seeds only users `system` (owner of example songs) and `test-user`. It does not seed songs or analyses.
- `pnpm --filter @splitune/db seed:dashboards` → `packages/db/scripts/seed-dashboards.ts` with `synthetic-week.ts` creates synthetic analytics users (ids start with `synthetic-`), songs, analyses, practice sessions and attempts for dashboards (local Grafana), not for UI sign-in.
- Analysed songs locally, three ways:
  1. Sign in, then Add song with a short audio file while workers run with `ML_MODE=mock`. This yields an analysed song from golden fixtures; `e2e/helpers.ts` `wav()` makes a test file, and `e2e/practice-keys.spec.ts` does exactly this.
  2. Use an example song as a guest at `/songs/ill-fate/practice` (also `stitch-up`, `stitch-up-bass`; manifest `apps/api/examples.json`). Its assets must exist in the bucket, built with `pnpm examples:build` (`apps/api/scripts/examples/build.ts`; needs workers running). Visiting `/start` first signs a guest in to it; signed in, onboarding step 4 claims the example into the library.
  3. Storybook only: `features/practice/practice-story-data.ts`, `progress-story-data.ts`, `features/story-fixtures.ts` and `ui/fixtures.ts` provide analysed-song data with no backend.

Test credentials locations (names only, no values printed):
- `packages/db/scripts/seed.ts`: constant `SEED_USERS` (ids `system`, `test-user`, with `email`, `displayName`, `primaryInstrument`, `level` fields). The comment there says these seeded users have no sign-in. To sign in locally, create an account at `/auth/sign-up`.
- `apps/web/e2e/helpers.ts`: constant `E2E_PASSWORD`; function `e2eUsername(label)` (pattern `e2e_<label>_<unique>`); function `signIn(page, label)`, which creates a fresh account through the sign-up form.
- `.env.example` / `.env` (`.env` is untracked): keys `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (optional Google sign-in), `DB_APP_PASSWORD`, `DB_ML_WORKER_PASSWORD`, `DB_NODE_WORKER_PASSWORD`, `DB_MAINTENANCE_PASSWORD`, `DB_DASHBOARD_PASSWORD`, `SMTP_USER`, `SMTP_PASSWORD`. These are service and database secrets, not a UI login.
- No fixed demo username/password exists in the seed or example config; login for UI work is created through the sign-up form.
- Mock billing: `BILLING_WEBHOOK_SECRET` in `.env.example`.
