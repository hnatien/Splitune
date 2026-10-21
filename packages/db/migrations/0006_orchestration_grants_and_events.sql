-- Analysis orchestration (step 09): SSE wake-ups, the API's own job events, URL-import metadata.

-- Every job event wakes the API's SSE streams of its analysis (LISTEN job_events, payload =
-- analysis id), whichever role wrote it. Delivered on commit, like the jobs_<runner> NOTIFY.
CREATE FUNCTION notify_job_event() RETURNS trigger
  LANGUAGE plpgsql
  AS $$
BEGIN
  PERFORM pg_notify('job_events', NEW.analysis_id::text);
  RETURN NULL;
END
$$;
--> statement-breakpoint
CREATE TRIGGER job_events_notify AFTER INSERT ON job_events
  FOR EACH ROW EXECUTE FUNCTION notify_job_event();
--> statement-breakpoint

-- app writes two kinds of events for its user's analyses: `analysis.waiting` (no fresh worker
-- heartbeat) and `stage.completed` for the decode and beats an analysis reuses from its base
-- analysis. Everything else stays the workers' (job_events_owner becomes read-only).
GRANT INSERT ON job_events TO app;
--> statement-breakpoint
DROP POLICY job_events_owner ON job_events;
--> statement-breakpoint
CREATE POLICY job_events_owner ON job_events FOR SELECT TO app
  USING (user_id = app_user_id());
--> statement-breakpoint
CREATE POLICY job_events_owner_insert ON job_events FOR INSERT TO app
  WITH CHECK (
    user_id = app_user_id()
    AND EXISTS (SELECT 1 FROM analyses a WHERE a.id = analysis_id)
    AND (
      event ->> 'type' = 'analysis.waiting'
      OR (event ->> 'type' = 'stage.completed' AND event ->> 'stage' IN ('decode', 'beats'))
    )
  );
--> statement-breakpoint

-- A base analysis must be one of the user's own (FK checks ignore RLS). A policy on analyses
-- can't query analyses itself (infinite recursion), so the check runs as the table owner.
CREATE FUNCTION app_owns_analysis(analysis_id uuid) RETURNS boolean
  LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
  AS $$ SELECT EXISTS (SELECT 1 FROM analyses a WHERE a.id = analysis_id AND a.user_id = app_user_id()) $$;
--> statement-breakpoint
DROP POLICY analyses_owner ON analyses;
--> statement-breakpoint
CREATE POLICY analyses_owner ON analyses TO app
  USING (user_id = app_user_id())
  WITH CHECK (
    user_id = app_user_id()
    AND EXISTS (SELECT 1 FROM songs s WHERE s.id = song_id)
    AND (base_analysis_id IS NULL OR app_owns_analysis(base_analysis_id))
  );
--> statement-breakpoint

-- url_import stores the downloaded video's title and artist on its song. Write-only: the workers
-- still cannot read titles (no SELECT on those columns).
GRANT UPDATE (title, artist) ON songs TO ml_worker;
