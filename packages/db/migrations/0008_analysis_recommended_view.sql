ALTER TABLE "analyses" ADD COLUMN "recommended_view" text;--> statement-breakpoint
ALTER TABLE "analyses" ADD CONSTRAINT "analyses_recommended_view_check" CHECK ("analyses"."recommended_view" in ('tab', 'notation', 'roll', 'drum_grid', 'f0', 'chords_only'));--> statement-breakpoint

-- finalize (node worker) writes the view it recommends together with the analysis' end state.
GRANT UPDATE (recommended_view) ON analyses TO node_worker;
