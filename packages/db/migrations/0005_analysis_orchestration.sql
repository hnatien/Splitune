ALTER TABLE "analyses" ADD COLUMN "base_analysis_id" uuid;--> statement-breakpoint
ALTER TABLE "jobs" ADD COLUMN "soft_depends_on" bigint[] DEFAULT '{}'::bigint[] NOT NULL;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_base_analysis_id_analyses_id_fk" FOREIGN KEY ("base_analysis_id") REFERENCES "public"."analyses"("id") ON DELETE set null ON UPDATE no action;