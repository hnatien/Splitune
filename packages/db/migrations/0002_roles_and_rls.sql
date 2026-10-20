-- Roles, grants and row-level security (17-security.md §2, 25-personal-mode.md §5).
--
-- Roles are cluster-wide and created NOLOGIN here; `pnpm db:roles` gives them a password from the
-- environment so the Mac workers can log in. Grants are per database and listed explicitly: a
-- migration that adds a table must grant it to the roles that need it (tests enforce RLS and the
-- maintenance grant on every table).
--
--   app          API requests. withUser() switches to it with SET LOCAL ROLE and sets app.user_id;
--                RLS limits every user table to that user.
--   ml_worker    Python worker on the Mac: queue, stage runs, artefacts, events, status columns.
--   node_worker  Node worker on the Mac: same grants as ml_worker.
--   maintenance  Sweepers, deletion cascade, DMCA. BYPASSRLS, so it needs a superuser to create.

DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'app') THEN
    CREATE ROLE app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'ml_worker') THEN
    CREATE ROLE ml_worker NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'node_worker') THEN
    CREATE ROLE node_worker NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'maintenance') THEN
    CREATE ROLE maintenance NOLOGIN BYPASSRLS;
  END IF;
END
$$;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO app, ml_worker, node_worker, maintenance;
--> statement-breakpoint

-- The user of the current transaction, or NULL outside withUser() (so policies match nothing).
CREATE FUNCTION app_user_id() RETURNS text
  LANGUAGE sql STABLE
  AS $$ SELECT nullif(current_setting('app.user_id', true), '') $$;
--> statement-breakpoint

-- app ------------------------------------------------------------------------------------------
GRANT SELECT, UPDATE ON users TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON songs, loop_clips, youtube_refs, sync_points TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON uploads, analyses, practice_sessions, practice_attempts, subscriptions TO app;
--> statement-breakpoint
GRANT SELECT, INSERT ON correction_ops, jobs TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, DELETE ON usage_ledger TO app;
--> statement-breakpoint
GRANT SELECT ON artefacts, stage_runs, job_events, feature_flags, worker_heartbeats TO app;
--> statement-breakpoint
GRANT INSERT ON analytics_events, audit_log TO app;
--> statement-breakpoint

-- ml_worker, node_worker -----------------------------------------------------------------------
-- Raw uploads reach the worker as object keys in the job payload, so there is no uploads grant.
GRANT SELECT, INSERT, UPDATE ON jobs, stage_runs, artefacts, worker_heartbeats TO ml_worker, node_worker;
--> statement-breakpoint
GRANT SELECT, INSERT ON job_events TO ml_worker, node_worker;
--> statement-breakpoint
GRANT SELECT ON analyses TO ml_worker, node_worker;
--> statement-breakpoint
GRANT UPDATE (status, progress, workflow_run_id, cost_usd_estimate, finished_at) ON analyses TO ml_worker, node_worker;
--> statement-breakpoint
-- decode fills audio_hash and duration_s; url_import reads source_url. No titles or player state.
GRANT SELECT (id, user_id, source_kind, source_url, instrument, duration_s, audio_hash, status) ON songs TO ml_worker, node_worker;
--> statement-breakpoint
GRANT UPDATE (status, duration_s, audio_hash) ON songs TO ml_worker, node_worker;
--> statement-breakpoint

-- maintenance ----------------------------------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO maintenance;
--> statement-breakpoint

-- Row-level security ---------------------------------------------------------------------------
-- Not FORCEd: the table owner (migrations, Better Auth, seeds) keeps full access. WITH CHECK also
-- requires the parent row to be visible, because foreign-key checks ignore RLS and would otherwise
-- let a user attach rows to another user's song or artefact.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY users_owner ON users TO app
  USING (id = app_user_id());
--> statement-breakpoint

ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY songs_owner ON songs TO app
  USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY songs_worker ON songs TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY uploads_owner ON uploads TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND (song_id IS NULL OR EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id)));
--> statement-breakpoint

ALTER TABLE youtube_refs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY youtube_refs_owner ON youtube_refs TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id));
--> statement-breakpoint

ALTER TABLE sync_points ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY sync_points_owner ON sync_points TO app
  USING (EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id));
--> statement-breakpoint

ALTER TABLE analyses ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY analyses_owner ON analyses TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id));
--> statement-breakpoint
CREATE POLICY analyses_worker ON analyses TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE stage_runs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY stage_runs_owner ON stage_runs TO app
  USING (EXISTS (SELECT 1 FROM analyses a WHERE a.id = analysis_id));
--> statement-breakpoint
CREATE POLICY stage_runs_worker ON stage_runs TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE artefacts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY artefacts_owner ON artefacts TO app
  USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY artefacts_worker ON artefacts TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE correction_ops ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY correction_ops_owner ON correction_ops TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND EXISTS (SELECT 1 FROM artefacts a WHERE a.id = artefact_id));
--> statement-breakpoint

ALTER TABLE loop_clips ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY loop_clips_owner ON loop_clips TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id));
--> statement-breakpoint

ALTER TABLE practice_sessions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY practice_sessions_owner ON practice_sessions TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id));
--> statement-breakpoint

ALTER TABLE practice_attempts ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY practice_attempts_owner ON practice_attempts TO app
  USING (user_id = app_user_id())
  WITH CHECK (
    user_id = app_user_id()
    AND EXISTS (SELECT 1 FROM practice_sessions ps WHERE ps.id = session_id)
    AND (loop_clip_id IS NULL OR EXISTS (SELECT 1 FROM loop_clips lc WHERE lc.id = loop_clip_id))
  );
--> statement-breakpoint

ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY subscriptions_owner ON subscriptions TO app
  USING (user_id = app_user_id());
--> statement-breakpoint

ALTER TABLE usage_ledger ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY usage_ledger_owner ON usage_ledger TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id() AND (analysis_id IS NULL OR EXISTS (SELECT 1 FROM analyses a WHERE a.id = analysis_id)));
--> statement-breakpoint

ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
-- The API only enqueues and reads jobs of its user's analyses; maintenance jobs have no analysis.
CREATE POLICY jobs_owner ON jobs TO app
  USING (EXISTS (SELECT 1 FROM analyses a WHERE a.id = analysis_id));
--> statement-breakpoint
CREATE POLICY jobs_worker ON jobs TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE job_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY job_events_owner ON job_events TO app
  USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY job_events_worker ON job_events TO ml_worker, node_worker
  USING (true);
--> statement-breakpoint

ALTER TABLE analytics_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY analytics_events_insert ON analytics_events FOR INSERT TO app
  WITH CHECK (user_id IS NULL OR user_id = app_user_id());
