-- analytics_events is keyed by user_hash from now on (16 §6). The insert policy of 0002 checks
-- user_id, so it goes first; 0014 creates its replacement. Rows written before this migration keep
-- no user key (the salt is not known to SQL).
DROP POLICY "analytics_events_insert" ON "analytics_events";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP CONSTRAINT "analytics_events_user_id_users_id_fk";
--> statement-breakpoint
DROP INDEX "analytics_events_user_at_idx";--> statement-breakpoint
ALTER TABLE "analytics_events" DROP COLUMN "user_id";