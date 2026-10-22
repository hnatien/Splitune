-- Data lifecycle, privacy self-service, analytics and dashboards (step 15; 15 §3–§4, 16 §2–§3).

-- Product events are keyed by a salted user hash (0013): the API inserts a visitor's or a user's
-- events as `app`, the node worker its analysis events. Neither can read them back.
CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT TO app
  WITH CHECK (true);
--> statement-breakpoint
GRANT INSERT ON analytics_events TO node_worker;
--> statement-breakpoint
CREATE POLICY analytics_events_worker ON analytics_events FOR INSERT TO node_worker
  WITH CHECK (true);
--> statement-breakpoint

-- "Download my data": the API records the request and enqueues the node worker's job in one
-- transaction, then reads the request back for its status; the worker (maintenance) fills it in.
GRANT SELECT, INSERT ON data_exports TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON data_exports, schedule_runs TO maintenance;
--> statement-breakpoint
ALTER TABLE data_exports ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY data_exports_owner ON data_exports TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());
--> statement-breakpoint

-- The API enqueues `export_user_data` and `delete_account` for its own user only (payload
-- { user_id, … }, no analysis); like jobs_owner_cleanup, the node worker checks the payload again.
CREATE POLICY jobs_owner_account ON jobs TO app
  USING (
    kind IN ('export_user_data', 'delete_account')
    AND analysis_id IS NULL
    AND payload ->> 'user_id' = app_user_id()
  )
  WITH CHECK (
    kind IN ('export_user_data', 'delete_account')
    AND runner = 'node'
    AND analysis_id IS NULL
    AND payload ->> 'user_id' = app_user_id()
  );
--> statement-breakpoint

-- Nightly pg_dump (25 §7) runs as maintenance, which needs the identity sequences' values and the
-- migration journal (schema drizzle) too, so a restored dump knows which migrations it holds.
GRANT SELECT ON ALL SEQUENCES IN SCHEMA public TO maintenance;
--> statement-breakpoint
GRANT USAGE ON SCHEMA drizzle TO maintenance;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA drizzle TO maintenance;
--> statement-breakpoint
GRANT SELECT ON ALL SEQUENCES IN SCHEMA drizzle TO maintenance;
--> statement-breakpoint

-- Dashboards (16 §3): read-only views over events, practice data and the pipeline's own tables,
-- for Grafana or psql. They aggregate across users (owner rights, no RLS), expose no titles,
-- emails, object keys or user ids, and are the only thing role dashboard_reader can read.
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'dashboard_reader') THEN
    CREATE ROLE dashboard_reader NOLOGIN;
  END IF;
END
$$;
--> statement-breakpoint
CREATE SCHEMA dashboards;
--> statement-breakpoint

-- Activation: the onboarding funnel and the two north-star timings (targets: first isolated
-- playback p50 ≤ 60 s for uploads, first slowed loop p50 ≤ 5 min, ≥ 60 % reaching a slowed loop).
CREATE VIEW dashboards.activation_daily AS
SELECT
  (at AT TIME ZONE 'UTC')::date AS day,
  count(*) FILTER (WHERE name = 'onboarding_step_viewed' AND props ->> 'step' = 'instrument') AS onboarding_started,
  count(*) FILTER (WHERE name = 'example_song_opened') AS example_opened,
  count(*) FILTER (WHERE name = 'first_isolated_playback') AS first_playback,
  count(*) FILTER (WHERE name = 'first_loop_reduced_speed') AS first_slowed_loop,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'ms_since_song_selected')::numeric)
    FILTER (WHERE name = 'first_isolated_playback') / 1000)::numeric, 1) AS first_playback_p50_s,
  round((percentile_cont(0.5) WITHIN GROUP (ORDER BY (props ->> 'ms_since_landing')::numeric)
    FILTER (WHERE name = 'first_loop_reduced_speed') / 1000)::numeric, 1) AS first_slowed_loop_p50_s,
  round(100.0 * count(*) FILTER (WHERE name = 'first_loop_reduced_speed')
    / nullif(count(*) FILTER (WHERE name = 'onboarding_step_viewed' AND props ->> 'step' = 'instrument'), 0), 1)
    AS slowed_loop_pct
FROM analytics_events
WHERE name IN ('onboarding_step_viewed', 'example_song_opened', 'first_isolated_playback', 'first_loop_reduced_speed')
GROUP BY 1;
--> statement-breakpoint
CREATE VIEW dashboards.onboarding_funnel AS
SELECT
  date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
  props ->> 'step' AS step,
  count(*) AS views
FROM analytics_events
WHERE name = 'onboarding_step_viewed'
GROUP BY 1, 2;
--> statement-breakpoint

-- Practice quality: passes per session, clean-pass ratio, keyboard/pedal share, best clean tempo.
CREATE VIEW dashboards.practice_quality_weekly AS
WITH passes AS (
  SELECT session_id, count(*) AS passes, count(*) FILTER (WHERE outcome = 'clean') AS clean
  FROM practice_attempts
  GROUP BY session_id
),
best AS (
  SELECT
    date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
    loop_clip_id,
    max(tempo_pct) AS best_clean_pct
  FROM practice_attempts
  WHERE outcome = 'clean' AND loop_clip_id IS NOT NULL
  GROUP BY 1, 2
),
weekly_best AS (
  SELECT week, count(*) AS clips, percentile_cont(0.5) WITHIN GROUP (ORDER BY best_clean_pct) AS median_best_clean_pct
  FROM best
  GROUP BY week
),
sessions AS (
  SELECT
    date_trunc('week', s.started_at AT TIME ZONE 'UTC')::date AS week,
    count(*) AS sessions,
    coalesce(sum(p.passes), 0) AS passes,
    coalesce(sum(p.clean), 0) AS clean_passes,
    count(*) FILTER (WHERE s.input_mode IN ('keyboard', 'pedal')) AS keyboard_pedal_sessions
  FROM practice_sessions s
  LEFT JOIN passes p ON p.session_id = s.id
  GROUP BY 1
)
SELECT
  s.week,
  s.sessions,
  s.passes,
  round(s.passes::numeric / s.sessions, 2) AS passes_per_session,
  round(100.0 * s.clean_passes / nullif(s.passes, 0), 1) AS clean_pass_pct,
  round(100.0 * s.keyboard_pedal_sessions / s.sessions, 1) AS keyboard_pedal_session_pct,
  coalesce(b.clips, 0) AS clips_with_clean_pass,
  b.median_best_clean_pct
FROM sessions s
LEFT JOIN weekly_best b ON b.week = s.week;
--> statement-breakpoint
CREATE VIEW dashboards.practice_input_weekly AS
SELECT
  date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
  props ->> 'input_mode' AS input_mode,
  count(*) AS actions
FROM analytics_events
WHERE name IN ('loop_pass_completed', 'speed_changed')
GROUP BY 1, 2;
--> statement-breakpoint

-- Trust: per model_id@version, how often its stage fell back or failed and how much learners
-- corrected or reported its output (correction ops on the artefact the stage produced).
CREATE VIEW dashboards.trust_by_model AS
WITH runs AS (
  SELECT r.analysis_id, r.stage, r.status, (m ->> 'model_id') || '@' || (m ->> 'version') AS model
  FROM stage_runs r
  CROSS JOIN LATERAL jsonb_array_elements(r.model_refs) AS m
  WHERE r.stage IN ('beats', 'separate', 'chords') OR r.stage LIKE 'notes.%'
),
corrections AS (
  SELECT
    a.analysis_id,
    a.kind,
    count(*) FILTER (WHERE c.op ->> 'op' NOT IN ('mark_correct', 'report_wrong')) AS corrections,
    count(*) FILTER (WHERE c.op ->> 'op' = 'report_wrong') AS reports
  FROM correction_ops c
  JOIN artefacts a ON a.id = c.artefact_id
  GROUP BY 1, 2
)
SELECT
  runs.stage,
  runs.model,
  count(DISTINCT runs.analysis_id) AS analyses,
  round(100.0 * count(*) FILTER (WHERE runs.status = 'fallback') / count(*), 1) AS fallback_pct,
  round(100.0 * count(*) FILTER (WHERE runs.status = 'failed') / count(*), 1) AS failed_pct,
  coalesce(sum(c.corrections), 0) AS corrections,
  coalesce(sum(c.reports), 0) AS reports,
  round(coalesce(sum(c.corrections), 0)::numeric / count(DISTINCT runs.analysis_id), 2) AS corrections_per_analysis
FROM runs
LEFT JOIN corrections c ON c.analysis_id = runs.analysis_id AND c.kind = runs.stage
GROUP BY 1, 2;
--> statement-breakpoint
-- Fallback to the chords-only view per requested instrument (proposals: guitar ≤ 40 %, bass ≤ 20 %).
CREATE VIEW dashboards.view_fallback_weekly AS
SELECT
  date_trunc('week', finished_at AT TIME ZONE 'UTC')::date AS week,
  requested_instrument AS instrument,
  count(*) AS analyses,
  round(100.0 * count(*) FILTER (WHERE recommended_view = 'chords_only') / count(*), 1) AS chords_only_pct
FROM analyses
WHERE status IN ('done', 'partial') AND finished_at IS NOT NULL
GROUP BY 1, 2;
--> statement-breakpoint

-- Pipeline latency per stage, and per analysis to the beat grid and to the end (targets on the Mac:
-- beat grid ≤ 15 s, full ≤ 3 min, Lite ≤ 20 s; 25 §5).
CREATE VIEW dashboards.stage_latency_daily AS
SELECT
  (finished_at AT TIME ZONE 'UTC')::date AS day,
  stage,
  count(*) AS runs,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY extract(epoch FROM finished_at - started_at))::numeric, 1) AS p50_s,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY extract(epoch FROM finished_at - started_at))::numeric, 1) AS p95_s,
  count(*) FILTER (WHERE status = 'fallback') AS fallbacks,
  round(100.0 * count(*) FILTER (WHERE status = 'failed') / count(*), 1) AS failed_pct
FROM stage_runs
WHERE started_at IS NOT NULL AND finished_at IS NOT NULL
GROUP BY 1, 2;
--> statement-breakpoint
CREATE VIEW dashboards.analysis_compute AS
SELECT
  a.id AS analysis_id,
  (a.created_at AT TIME ZONE 'UTC')::date AS day,
  a.analysis_type AS type,
  a.requested_instrument AS instrument,
  a.status,
  round(extract(epoch FROM a.finished_at - a.created_at)::numeric, 1) AS wall_s,
  round(extract(epoch FROM max(r.finished_at) FILTER (WHERE r.stage = 'beats') - a.created_at)::numeric, 1) AS beat_grid_s,
  round(coalesce(sum(extract(epoch FROM r.finished_at - r.started_at)), 0)::numeric, 1) AS compute_s,
  round(coalesce(sum(r.gpu_seconds), 0)::numeric, 1) AS gpu_s
FROM analyses a
LEFT JOIN stage_runs r ON r.analysis_id = a.id
GROUP BY a.id;
--> statement-breakpoint
CREATE VIEW dashboards.analysis_latency_daily AS
SELECT
  day,
  type,
  count(*) AS analyses,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY wall_s)::numeric, 1) AS wall_p50_s,
  round(percentile_cont(0.95) WITHIN GROUP (ORDER BY wall_s)::numeric, 1) AS wall_p95_s,
  round(percentile_cont(0.5) WITHIN GROUP (ORDER BY beat_grid_s)::numeric, 1) AS beat_grid_p50_s,
  round(avg(compute_s), 1) AS compute_mean_s,
  round(avg(gpu_s), 1) AS gpu_mean_s,
  round(100.0 * count(*) FILTER (WHERE status = 'failed') / count(*), 1) AS failed_pct
FROM dashboards.analysis_compute
WHERE status IN ('done', 'partial', 'failed')
GROUP BY 1, 2;
--> statement-breakpoint

-- Import funnel: file uploads (browser events) and link imports (url_import stage runs).
CREATE VIEW dashboards.import_funnel_daily AS
WITH files AS (
  SELECT
    (at AT TIME ZONE 'UTC')::date AS day,
    count(*) FILTER (WHERE name = 'upload_started') AS started,
    count(*) FILTER (WHERE name = 'upload_completed') AS completed,
    count(*) FILTER (WHERE name = 'upload_failed') AS failed
  FROM analytics_events
  WHERE name IN ('upload_started', 'upload_completed', 'upload_failed')
  GROUP BY 1
),
links AS (
  SELECT
    (coalesce(finished_at, started_at) AT TIME ZONE 'UTC')::date AS day,
    count(*) AS started,
    count(*) FILTER (WHERE status IN ('done', 'fallback')) AS completed,
    count(*) FILTER (WHERE status = 'failed') AS failed
  FROM stage_runs
  WHERE stage = 'url_import' AND coalesce(finished_at, started_at) IS NOT NULL
  GROUP BY 1
)
SELECT
  coalesce(f.day, l.day) AS day,
  coalesce(f.started, 0) AS file_started,
  coalesce(f.completed, 0) AS file_completed,
  coalesce(f.failed, 0) AS file_failed,
  round(100.0 * f.completed / nullif(f.started, 0), 1) AS file_success_pct,
  coalesce(l.started, 0) AS link_started,
  coalesce(l.completed, 0) AS link_completed,
  coalesce(l.failed, 0) AS link_failed,
  round(100.0 * l.completed / nullif(l.started, 0), 1) AS link_success_pct
FROM files f
FULL JOIN links l ON l.day = f.day;
--> statement-breakpoint

-- Platform health: capability probes and audio underruns per browser family and device class.
CREATE VIEW dashboards.platform_health_weekly AS
SELECT
  date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
  props ->> 'browser' AS browser,
  props ->> 'device_class' AS device_class,
  count(*) FILTER (WHERE name = 'capability_probe') AS probes,
  count(*) FILTER (WHERE name = 'audio_underrun') AS underruns,
  round(count(*) FILTER (WHERE name = 'audio_underrun')::numeric
    / nullif(count(*) FILTER (WHERE name = 'capability_probe'), 0), 2) AS underruns_per_probe,
  round(100.0 * count(*) FILTER (WHERE name = 'capability_probe' AND (props ->> 'webcodecs')::boolean)
    / nullif(count(*) FILTER (WHERE name = 'capability_probe'), 0), 1) AS webcodecs_pct
FROM analytics_events
WHERE name IN ('capability_probe', 'audio_underrun')
GROUP BY 1, 2, 3;
--> statement-breakpoint

-- Funnel & money (mock billing): paywall → upgrade click → checkout, cancellations.
CREATE VIEW dashboards.conversion_weekly AS
SELECT
  date_trunc('week', at AT TIME ZONE 'UTC')::date AS week,
  count(*) FILTER (WHERE name = 'paywall_viewed') AS paywall_viewed,
  count(*) FILTER (WHERE name = 'upgrade_clicked') AS upgrade_clicked,
  count(*) FILTER (WHERE name = 'checkout_completed') AS checkout_completed,
  count(*) FILTER (WHERE name = 'subscription_cancelled') AS cancelled
FROM analytics_events
WHERE name IN ('paywall_viewed', 'upgrade_clicked', 'checkout_completed', 'subscription_cancelled')
GROUP BY 1;
--> statement-breakpoint

-- Display defaults (26 open questions): what learners choose.
CREATE VIEW dashboards.display_choices AS
SELECT setting, choice, count(*) AS changes
FROM analytics_events
CROSS JOIN LATERAL jsonb_each_text(props) AS p(setting, choice)
WHERE name = 'display_settings_changed' AND setting <> 'calibration_pct'
GROUP BY 1, 2;
--> statement-breakpoint

GRANT USAGE ON SCHEMA dashboards TO dashboard_reader, maintenance;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA dashboards TO dashboard_reader, maintenance;
