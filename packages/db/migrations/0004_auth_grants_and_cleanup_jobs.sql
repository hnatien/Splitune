-- Grants for the tables of 0003 and the API's object-cleanup jobs (step 04).
--
-- auth_sessions, auth_accounts, auth_verifications and rate_limits are used only by the table owner
-- (Better Auth's Drizzle adapter and the API's rate limiter run outside withUser()). app and the
-- workers get nothing; maintenance needs them for account deletion and sweeping.
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions, auth_accounts, auth_verifications, rate_limits TO maintenance;
--> statement-breakpoint

-- Deleting a song (03 "Retention and deletion") removes its rows and, in the same transaction,
-- enqueues a `delete_prefix` job for the node worker with the song's object prefixes. Such a job has
-- no analysis, so jobs_owner does not cover it. This policy lets app insert and read back only
-- cleanup jobs for its own prefixes: payload { user_id, prefixes: ["u/<user_id>/…/", …] }, with no
-- '.' or '..' segments. The worker re-validates every prefix before deleting.
CREATE POLICY jobs_owner_cleanup ON jobs TO app
  USING (kind = 'delete_prefix' AND analysis_id IS NULL AND payload ->> 'user_id' = app_user_id())
  WITH CHECK (
    kind = 'delete_prefix'
    AND runner = 'node'
    AND analysis_id IS NULL
    AND payload ->> 'user_id' = app_user_id()
    AND CASE
      WHEN jsonb_typeof(payload -> 'prefixes') = 'array' THEN
        jsonb_array_length(payload -> 'prefixes') > 0
        AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(payload -> 'prefixes') AS p(value)
          WHERE jsonb_typeof(p.value) <> 'string'
            OR NOT starts_with(p.value #>> '{}', 'u/' || app_user_id() || '/')
            OR (p.value #>> '{}') ~ '(^|/)\.\.?(/|$)'
            OR right(p.value #>> '{}', 1) <> '/'
        )
      ELSE false
    END
  );
