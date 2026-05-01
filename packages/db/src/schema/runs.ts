import { index, integer, jsonb, pgTable, text, timestamp, boolean, doublePrecision } from "drizzle-orm/pg-core";

export const evalRun = pgTable(
  "eval_run",
  {
    id: text("id").primaryKey(),
    strategy: text("strategy").notNull(),
    model: text("model").notNull(),
    promptHash: text("prompt_hash").notNull(),
    datasetFilter: jsonb("dataset_filter"),
    status: text("status").notNull(),
    totalCases: integer("total_cases").notNull(),
    completedCases: integer("completed_cases").notNull().default(0),
    fieldAverages: jsonb("field_averages"),
    hallucinationCount: integer("hallucination_count").notNull().default(0),
    schemaFailureCount: integer("schema_failure_count").notNull().default(0),
    usage: jsonb("usage"),
    costUsd: doublePrecision("cost_usd").notNull().default(0),
    wallTimeMs: integer("wall_time_ms").notNull().default(0),
    lastError: text("last_error"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    startedAt: timestamp("started_at"),
    completedAt: timestamp("completed_at"),
  },
  (table) => [index("eval_run_status_idx").on(table.status)],
);

export const evalCaseResult = pgTable(
  "eval_case_result",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => evalRun.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").notNull(),
    prediction: jsonb("prediction"),
    scores: jsonb("scores").notNull(),
    hallucinations: jsonb("hallucinations").notNull(),
    schemaValid: boolean("schema_valid").notNull(),
    usage: jsonb("usage").notNull(),
    wallTimeMs: integer("wall_time_ms").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("eval_case_result_run_idx").on(table.runId),
    index("eval_case_result_transcript_idx").on(table.transcriptId),
  ],
);

export const evalAttempt = pgTable(
  "eval_attempt",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => evalRun.id, { onDelete: "cascade" }),
    transcriptId: text("transcript_id").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    promptHash: text("prompt_hash").notNull(),
    request: jsonb("request").notNull(),
    response: jsonb("response"),
    validationErrors: jsonb("validation_errors"),
    usage: jsonb("usage").notNull(),
    durationMs: integer("duration_ms").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("eval_attempt_run_idx").on(table.runId),
    index("eval_attempt_transcript_idx").on(table.transcriptId),
  ],
);
