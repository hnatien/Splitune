CREATE TABLE "data_exports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"object_key" text NOT NULL,
	"bytes" integer,
	"error_code" text,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ready_at" timestamp with time zone,
	"expires_at" timestamp with time zone,
	CONSTRAINT "data_exports_status_check" CHECK ("data_exports"."status" in ('pending', 'ready', 'failed', 'expired'))
);
--> statement-breakpoint
CREATE TABLE "schedule_runs" (
	"name" text PRIMARY KEY NOT NULL,
	"last_started_at" timestamp with time zone,
	"last_finished_at" timestamp with time zone,
	"last_status" text,
	"last_error_code" text,
	"last_result" jsonb
);
--> statement-breakpoint
ALTER TABLE "artefacts" ADD COLUMN "purged_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "analytics_events" ADD COLUMN "user_hash" text;--> statement-breakpoint
ALTER TABLE "data_exports" ADD CONSTRAINT "data_exports_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_exports_user_requested_idx" ON "data_exports" USING btree ("user_id","requested_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "analytics_events_user_hash_at_idx" ON "analytics_events" USING btree ("user_hash","at");