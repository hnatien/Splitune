-- SSE streams read job_events in id order after a cursor (Last-Event-ID). Ids come from a
-- sequence at insert time, but writers commit in their own order: an event that got id N and
-- committed after N+1 was already streamed would never be sent. So an event's id is taken only
-- once its transaction holds its analysis' row lock (kept until commit): within one analysis, ids
-- then follow commit order. Every event-writing transaction locks that row anyway (status and
-- progress updates), so it is one lock and no new lock ordering. Runs as the table owner so every
-- writer (app, ml_worker, node_worker) can take the lock and the sequence value.
CREATE FUNCTION job_events_in_commit_order() RETURNS trigger
  LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
  AS $$
BEGIN
  PERFORM 1 FROM analyses WHERE id = NEW.analysis_id FOR UPDATE;
  NEW.id := nextval(pg_get_serial_sequence('job_events', 'id'));
  RETURN NEW;
END
$$;
--> statement-breakpoint
CREATE TRIGGER job_events_in_commit_order BEFORE INSERT ON job_events
  FOR EACH ROW EXECUTE FUNCTION job_events_in_commit_order();
