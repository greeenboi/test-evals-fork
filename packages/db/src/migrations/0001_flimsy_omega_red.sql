CREATE TABLE "eval_attempt" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"transcript_id" text NOT NULL,
	"attempt_number" integer NOT NULL,
	"prompt_hash" text NOT NULL,
	"request" jsonb NOT NULL,
	"response" jsonb,
	"validation_errors" jsonb,
	"usage" jsonb NOT NULL,
	"duration_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_case_result" (
	"id" text PRIMARY KEY NOT NULL,
	"run_id" text NOT NULL,
	"transcript_id" text NOT NULL,
	"prediction" jsonb NOT NULL,
	"scores" jsonb NOT NULL,
	"hallucinations" jsonb NOT NULL,
	"schema_valid" boolean NOT NULL,
	"usage" jsonb NOT NULL,
	"wall_time_ms" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "eval_run" (
	"id" text PRIMARY KEY NOT NULL,
	"strategy" text NOT NULL,
	"model" text NOT NULL,
	"prompt_hash" text NOT NULL,
	"dataset_filter" jsonb,
	"status" text NOT NULL,
	"total_cases" integer NOT NULL,
	"completed_cases" integer DEFAULT 0 NOT NULL,
	"field_averages" jsonb,
	"hallucination_count" integer DEFAULT 0 NOT NULL,
	"schema_failure_count" integer DEFAULT 0 NOT NULL,
	"usage" jsonb,
	"cost_usd" double precision DEFAULT 0 NOT NULL,
	"wall_time_ms" integer DEFAULT 0 NOT NULL,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "eval_attempt" ADD CONSTRAINT "eval_attempt_run_id_eval_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "eval_case_result" ADD CONSTRAINT "eval_case_result_run_id_eval_run_id_fk" FOREIGN KEY ("run_id") REFERENCES "public"."eval_run"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eval_attempt_run_idx" ON "eval_attempt" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "eval_attempt_transcript_idx" ON "eval_attempt" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "eval_case_result_run_idx" ON "eval_case_result" USING btree ("run_id");--> statement-breakpoint
CREATE INDEX "eval_case_result_transcript_idx" ON "eval_case_result" USING btree ("transcript_id");--> statement-breakpoint
CREATE INDEX "eval_run_status_idx" ON "eval_run" USING btree ("status");