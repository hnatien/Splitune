-- Mock billing and allowances (step 14, 14 §2–§4, 23 §2).

-- The webhook handler records each applied provider event for its user (idempotency by event id)
-- and updates that user's subscription row, both as `app` inside withUser().
GRANT SELECT, INSERT ON billing_events TO app;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON billing_events TO maintenance;
--> statement-breakpoint
ALTER TABLE billing_events ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY billing_events_owner ON billing_events TO app
  USING (user_id = app_user_id())
  WITH CHECK (user_id = app_user_id());
--> statement-breakpoint

-- Failed and fallback-only runs never use an allowance (23 §2, F5). Whichever role ends the
-- analysis (the Node worker's finalize, a failed finalize, a cancellation), its reservation in
-- usage_ledger is released in the same transaction. Fallback-only = the type's headline output is
-- missing: stems for a Full or Welcome analysis, chords for a Lite one. The workers have no access
-- to usage_ledger, so the function runs as its owner.
CREATE FUNCTION release_unearned_usage() RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
  AS $$
BEGIN
  IF NEW.status IN ('failed', 'cancelled') OR NOT EXISTS (
    SELECT 1 FROM stage_runs r
    WHERE r.analysis_id = NEW.id
      AND r.stage = CASE WHEN NEW.analysis_type = 'lite' THEN 'chords' ELSE 'stem_post' END
      AND r.status IN ('done', 'fallback')
  ) THEN
    DELETE FROM usage_ledger WHERE analysis_id = NEW.id;
  END IF;
  RETURN NULL;
END
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION release_unearned_usage() FROM PUBLIC;
--> statement-breakpoint
CREATE TRIGGER analyses_release_unearned_usage AFTER UPDATE OF status ON analyses
  FOR EACH ROW
  WHEN (
    OLD.status IS DISTINCT FROM NEW.status
    AND NEW.status IN ('done', 'partial', 'failed', 'cancelled')
  )
  EXECUTE FUNCTION release_unearned_usage();
