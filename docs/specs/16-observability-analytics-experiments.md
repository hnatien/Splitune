---
title: Observability, product analytics and experiments
workstream: engineering
last_researched: 2026-10-20
confidence: medium
---

# Observability, product analytics and experiments

Instrumentation for three audiences: engineers (errors, traces, SLOs), the business (cost per song, conversion, retention) and product research (the measurement plan in `research/product/feature-roadmap-beginner-to-intermediate.md`, fake-door pricing, feature experiments).

> **Personal mode is current (`25-personal-mode.md`).** Tools become free/self-hosted: Sentry → structured logs in Railway (optional GlitchTip), Axiom → optional Railway tracing on `app` and a local `grafana/otel-lgtm` container for the Mac workers, PostHog → an `analytics_events` Postgres table written by the same typed `track()` wrapper, dashboards in Grafana or plain SQL, flags in a `feature_flags` table / YAML. The event taxonomy, dashboards' content and alerts below stay the same; cost alerts become compute-time alerts (queue length, minutes per analysis).

## TL;DR
- **Errors:** Sentry in web, API and ML workers (URLs scrubbed — presigned URLs are credentials). **Traces/logs:** OpenTelemetry → Axiom, one trace per analysis (`analysis_id` attribute) spanning API, Inngest steps and Modal stages. **Product analytics, flags, experiments:** PostHog.
- **Typed event taxonomy** in `packages/analytics` shared by web and API; events never contain audio, titles, file names or emails.
- **North-star metrics from the roadmap measurement plan** are dashboards from day one of beta: time-to-first-isolated-playback, time-to-first-slowed-loop, loop completions, clean passes and tempo reached, correction rate, fallback rate, file-step drop-off, cost per analysis, week-4 retention.
- **Cost ledger** per analysis (vendor minutes + GPU seconds) with alerts at the D10 break-even ($0.28 per analysis) and on Free cost per signup.

## 1. Telemetry stack
| Signal | Tool | Notes |
|---|---|---|
| Frontend errors | Sentry browser SDK | Release + sourcemaps; `beforeSend` strips query strings from URLs; session replay **off** in Sentry (PostHog replay with masking instead, opt-in) |
| API/worker errors | `@sentry/node`, `sentry-sdk` (Python) | Error codes as tags; no request bodies |
| Traces | OpenTelemetry SDK (Node, Python) → OTLP → Axiom | Trace context propagated API → Inngest event payload (`traceparent`) → Modal request → callback |
| Logs | Structured JSON (pino / structlog) → Axiom | Fields: `analysis_id`, `stage`, `user_hash` (salted), `error_code`, timings |
| Metrics | Derived in Axiom from logs/spans + Postgres views | SLO burn alerts |
| Product events | PostHog (EU or US cloud per counsel) | Autocapture off; explicit events only |
| Uptime | Axiom monitors or Better Stack-style checks on `/internal/health`, web, SSE | |

## 2. Event taxonomy (excerpt, `packages/analytics/src/events.ts`)
| Event | Properties | Feeds |
|---|---|---|
| `onboarding_step_viewed` | step, instrument, level | Onboarding funnel |
| `example_song_opened` | example_id | M13 |
| `first_isolated_playback` | ms_since_song_selected, source (example \| upload) | Time-to-first-isolated-playback (target p50 ≤60 s for uploads) |
| `loop_created` | method (tap \| numeric \| drag), bars | M6 |
| `loop_pass_completed` | tempo_pct, outcome (clean \| not_yet \| unrated), input_mode | Loop completions, clean passes |
| `first_loop_reduced_speed` | ms_since_landing | Time-to-first-loop (target p50 ≤5 min) |
| `speed_changed`, `mix_preset_applied`, `level_changed`, `view_changed` | values | Feature usage |
| `youtube_link_pasted` → `file_prompt_shown` → `file_added` \| `file_prompt_abandoned` | — | **File-step drop-off** (D1 risk R3) |
| `upload_started` / `upload_completed` / `upload_failed` | bytes_bucket, mime, error_code | Import success (target ≥95%) |
| `analysis_requested` | type (welcome \| full \| lite), instrument | Usage, plan design |
| `analysis_stage_completed` | stage, duration_ms, status, model_ref | Pipeline latency |
| `analysis_done` | status, total_ms, recommended_view per instrument, cost_bucket | Fallback rate, reliability |
| `correction_made` | op type, entity kind, model_ref | **Correction rate** per 100 displayed notes/chords |
| `wrong_reported` | entity kind, model_ref | Correction rate |
| `paywall_viewed` / `upgrade_clicked` / `checkout_completed` | trigger, plan, price_variant | Conversion |
| `pricing_cta_clicked` | plan, price_variant | Fake-door test (Phase 0) |
| `subscription_cancelled` | reason (optional survey), tenure_days | Retention, billing trust |
| `display_settings_changed` | appearance (system \| light \| dark \| stage), score_surface, distance (desk \| stand \| floor), calibration_pct, hyperlegible, reduced_motion, contrast | Validates the display defaults in `26-design-system.md` (paper score in Dark, distance presets, Stage) |
| `audio_underrun` | browser, device_class, rate, preset | Audio health |
| `in_app_browser_banner_viewed` / `_opened_external` | app | Discovery funnel |
| `capability_probe` (person props) | webcodecs, opus_ok, output_latency, webgpu, wake_lock, midi | Browser compatibility (`24-browser-compatibility.md`) |

## 3. Dashboards
| Dashboard | Panels |
|---|---|
| Activation | Onboarding funnel; time-to-first-isolated-playback; time-to-first-slowed-loop; % reaching a slowed loop in session 1 (target ≥60%) |
| Practice quality | Loop passes per session; clean-pass ratio; median best-clean-tempo per clip over weeks; keyboard/pedal share of actions |
| Trust | Correction rate and report rate per instrument and `model_id@version`; fallback rate (guitar ≤40%, bass ≤20% proposals); rough-stem share |
| Pipeline | p50/p95 per stage; time to beat grid; time to full; failure rate (≤2%); vendor latency; cold starts |
| Cost | Cost per analysis (by type, instrument, vendor); cost per active user; cost per paying user vs net revenue; Free cost per signup |
| Funnel & money | Paste-link → file-added rate; free → paid; price-variant conversion; refunds; cancellations; billing support tickets |
| Retention | D1/D7/week-4 retention by cohort and acquisition source; sessions/week |
| Platform | Errors, underruns and practice sessions by browser/version/device class |

## 4. Alerts (routed to on-call channel)
| Alert | Condition |
|---|---|
| Pipeline failure spike | analysis failure rate >5% over 30 min |
| Latency regression | p50 full analysis >120 s over 1 h, or beat grid p50 >15 s |
| Vendor outage | vendor error rate >20% over 10 min → auto-suggest vendor switch flag |
| Cost | 7-day mean cost per full analysis >$0.28; vendor spend +30% WoW; Free cost per signup >$0.50 |
| Abuse | one user >3× fair-use Lite or many failed uploads |
| Errors | new Sentry issue with >50 users in 1 h |
| Audio health | underrun rate per browser doubles WoW |
| Compliance | deletion/sweeper job failures; DMCA queue item older than SLA |

## 5. Experiments and flags
- PostHog feature flags for every MVP/v1 feature (kill switches), vendor routing (`separation.vendor`), plan parameters (`plan.free.lite_per_month`, …) and UI variants.
- Planned experiments: price variants ($8 / $9.99 / $12) with fake door then real checkout; Lite allowance 3/5/10; page-flip vs scroll default for tab; default starting speed 70% vs 80%; rest beat between loops on/off; manual vs auto speed trainer (later).
- Guardrail metrics on every experiment: correction rate, refunds, cost per signup, week-1 retention.

## 6. Privacy rules for telemetry
- Pseudonymous ids (PostHog distinct id = salted hash of user id); no emails, titles, file names, YouTube ids or audio-derived features in events.
- Consent banner where required; analytics must fail closed (app works if blocked — e.g., Brave shields).
- Session replay opt-in with all inputs and notation canvases masked.
- Retention: product events 12 months, logs 30 days, traces 14 days (adjust with counsel).

## Implementation notes (step 13, 2026-10-22)
- **Taxonomy location (deviation):** the event schemas are `AnalyticsEvent` in `@splitune/contracts` (`api/analytics.ts`), because `POST /v1/events` crosses a process boundary (contracts first); `@splitune/analytics` holds the typed `createTracker()` (batching ≤ 20, best effort). Built so far: `onboarding_step_viewed {step, instrument, level}`, `example_song_opened {example_id}`, `first_isolated_playback {ms_since_song_selected, source}`, `first_loop_reduced_speed {ms_since_landing, tempo_pct}` (plus the slowed tempo).
- The web sends them with a keepalive `fetch` (`lib/analytics.ts`), flushed when the page is hidden; rows land in `analytics_events` with `user_id` null for visitors. The rest of the taxonomy is step 15.

## Implementation notes (step 15, 2026-10-22)
- **Taxonomy:** `AnalyticsEvent` (browser, `POST /v1/events`) and `ServerAnalyticsEvent` (API: `analysis_requested`, `checkout_completed`, `subscription_cancelled`; node worker after finalize: `analysis_stage_completed` per stage run, `analysis_done`) in `@splitune/contracts`. Props are allow-listed by the schemas (undeclared props are stripped; machine codes and `model_id@version` are regex-checked); a test bans identifying prop names. Deviations from §2: `input_mode` uses practice sessions' `touch|keyboard|pedal`; `loop_created.method` adds `clip` (a saved clip chosen); YouTube embed events stay dormant (personal mode imports links: `link_import_started`, success from `url_import` stage runs); `capability_probe.output_latency_ms` is null (no AudioContext before a gesture); `audio_underrun.preset` is the engine tier.
- **Pseudonymous key:** `analytics_events.user_id` was replaced by `user_hash` = HMAC-SHA-256(`ANALYTICS_SALT`, user id) truncated (migration 0013; earlier rows keep no key). API and node worker share the salt; account deletion removes a user's events by hash.
- **Browser:** `lib/track.ts` only queues; the sender (`lib/telemetry.ts`) attaches from the after-first-render chunk (`lib/after-render.ts`, also the service worker) and adds device context. `browser` is derived from the user agent **for reporting only** (24's no-UA-sniffing rule is about behaviour). Practice route budget raised to **302 KB** gzip by the owner for the practice events (doc 10 §9).
- **Dashboards:** 13 views in schema `dashboards` (migration 0014; activation, onboarding funnel, practice quality and input share, trust per model, chords-only fallback, stage/analysis latency, compute per analysis, import funnel, platform health, conversion, display choices), readable by role `dashboard_reader` only. `docker compose -f infra/docker-compose.yml --profile observability up -d` runs `grafana/otel-lgtm:0.35.0` (Grafana on :3001, OTLP on :4317/:4318) with a provisioned Postgres datasource and five dashboards (`infra/grafana`). `pnpm --filter @splitune/db seed:dashboards` seeds a synthetic week locally.
- **Traces:** `@splitune/analytics/tracing` starts an OTLP/HTTP tracer only when `OTEL_EXPORTER_OTLP_ENDPOINT` is set (API: a span per request; node worker: a span per job and per lifecycle run, with `analysis_id`). The Python ML worker is not traced (its JSON logs already carry `analysis_id`). GlitchTip skipped.
- **Flags:** `FLAGS` in contracts (defaults: `import.url`, `examples` on; `v1.*` off), `createFlags()` in the API (30 s cache, row wins over default); `/v1/me` returns every declared flag evaluated. Gates: link import (kill switch → `import.url_broken`), example list/URLs, loop `trainer` (`v1.speed_trainer`).
- **Daily digest:** node worker, SMTP, `DIGEST_EMAIL_TO`: finished analyses by status, failed jobs by kind/code, failed lifecycle runs, runnable backlog per runner, workers offline > 2 min and analyses that waited for one, database/bucket/ML-cache/dump sizes with growth since yesterday, bucket vs the R2 10 GB-month free tier (≥ 80 % counts as a problem). "Offline periods" are approximated by heartbeat age and `analysis.waiting` events (no heartbeat history is kept).
## Open questions
- PostHog region (EU vs US) and consent requirements (QL6).
- Whether self-assessment (clean pass) correlates with expert ratings (roadmap open question) — run a sampled study in beta.

## Sources
Cross-linked: `research/product/feature-roadmap-beginner-to-intermediate.md` (measurement plan), `research/product/recommendations-and-decisions.md` D10 (break-even), `23-plans-free-and-paid.md`, `24-browser-compatibility.md`. Tool pricing/versions: `00-tech-stack.md`.
