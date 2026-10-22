-- Example songs (step 13, 03 "Example songs"): claiming one gives the user an analysis whose
-- artefact rows point at the shared, Splitune-owned objects under assets/examples/. app may insert
-- artefacts for its own user only (artefacts_owner) and only such example rows (this policy), so
-- it can never forge an artefact that points into another user's prefix.
GRANT INSERT ON artefacts TO app;
--> statement-breakpoint
CREATE POLICY artefacts_example_insert ON artefacts AS RESTRICTIVE FOR INSERT TO app
  WITH CHECK (object_key LIKE 'assets/examples/%');
