import { randomUUID } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { db } from "@test-evals/db";
import { evalAttempt, evalCaseResult, evalRun } from "@test-evals/db/schema/runs";
import type {
  CaseResult,
  CaseScores,
  CaseDetail,
  DatasetFilter,
  FieldAverages,
  PromptStrategy,
  RunRequest,
  RunSummary,
  RunStatus,
  TokenUsage,
} from "@test-evals/shared";
import { computePromptHash, getPrompt } from "@test-evals/llm";
import { loadClinicalSchema } from "../lib/schema";
import { computeRemainingDataset, loadDataset, type DatasetCase } from "../lib/dataset";
import { publishRunEvent } from "../lib/sse";
import { extractClinicalData } from "./extract.service";
import { aggregateFieldAverages, evaluateCase } from "./evaluate.service";

const CONCURRENCY_LIMIT = 5;
const RATE_LIMIT_MAX_RETRIES = 3;
const RATE_LIMIT_BASE_DELAY_MS = 750;

const MODEL_RATES_PER_MILLION: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
  "claude-haiku-4-5-20251001": {
    input: 0.25,
    output: 1.25,
    cacheRead: 0.025,
    cacheWrite: 0.25,
  },
};

export async function startRun(request: RunRequest): Promise<RunSummary> {
  const dataset = await loadDataset(request.dataset_filter);
  const promptHash = await resolvePromptHash(request.strategy);
  const runId = randomUUID();

  await db.insert(evalRun).values({
    id: runId,
    strategy: request.strategy,
    model: request.model,
    promptHash,
    datasetFilter: request.dataset_filter ?? null,
    status: "running",
    totalCases: dataset.length,
    completedCases: 0,
    fieldAverages: emptyFieldAverages(),
    usage: emptyUsage(),
    startedAt: new Date(),
  });

  void executeRun({
    runId,
    strategy: request.strategy,
    model: request.model,
    promptHash,
    dataset,
    force: request.force ?? false,
    initial: buildInitialRunState(),
  });

  const runRow = await getRunRow(runId);
  return toRunSummary(runRow);
}

export async function runHeadless(request: RunRequest): Promise<RunSummary> {
  const dataset = await loadDataset(request.dataset_filter);
  const promptHash = await resolvePromptHash(request.strategy);
  const runId = randomUUID();

  await db.insert(evalRun).values({
    id: runId,
    strategy: request.strategy,
    model: request.model,
    promptHash,
    datasetFilter: request.dataset_filter ?? null,
    status: "running",
    totalCases: dataset.length,
    completedCases: 0,
    fieldAverages: emptyFieldAverages(),
    usage: emptyUsage(),
    startedAt: new Date(),
  });

  return executeRun({
    runId,
    strategy: request.strategy,
    model: request.model,
    promptHash,
    dataset,
    force: request.force ?? false,
    initial: buildInitialRunState(),
  });
}

export async function resumeRun(runId: string): Promise<RunSummary> {
  const runRow = await getRunRow(runId);
  if (runRow.status === "completed") {
    return toRunSummary(runRow);
  }

  const dataset = await loadDataset((runRow.datasetFilter as DatasetFilter) ?? undefined);
  const existingResults = await db
    .select()
    .from(evalCaseResult)
    .where(eq(evalCaseResult.runId, runId));

  const completedIds = new Set(existingResults.map((result) => result.transcriptId));
  const remaining = computeRemainingDataset(dataset, completedIds);

  const initial = buildInitialRunState(existingResults.map((result) => result.scores as CaseScores), existingResults);

  await db
    .update(evalRun)
    .set({ status: "running", lastError: null })
    .where(eq(evalRun.id, runId));

  void executeRun({
    runId,
    strategy: runRow.strategy as PromptStrategy,
    model: runRow.model,
    promptHash: runRow.promptHash,
    dataset: remaining,
    force: false,
    initial,
  });

  return toRunSummary({ ...runRow, status: "running" });
}

export async function listRuns(): Promise<RunSummary[]> {
  const rows = await db.select().from(evalRun).orderBy(desc(evalRun.createdAt));
  return rows.map((row) => toRunSummary(row));
}

export async function getRun(runId: string): Promise<RunSummary | null> {
  const row = await getRunRow(runId, false);
  return row ? toRunSummary(row) : null;
}

export async function getRunCases(runId: string): Promise<CaseResult[]> {
  const runRow = await getRunRow(runId);
  const rows = await db
    .select()
    .from(evalCaseResult)
    .where(eq(evalCaseResult.runId, runId))
    .orderBy(evalCaseResult.transcriptId);

  return rows.map((row) => toCaseResult(row, runRow, []));
}

export async function getCaseDetail(
  runId: string,
  transcriptId: string,
): Promise<CaseDetail | null> {
  const runRow = await getRunRow(runId, false);
  if (!runRow) {
    return null;
  }

  const [caseRow] = await db
    .select()
    .from(evalCaseResult)
    .where(and(eq(evalCaseResult.runId, runId), eq(evalCaseResult.transcriptId, transcriptId)));

  if (!caseRow) {
    return null;
  }

  const attempts = await db
    .select()
    .from(evalAttempt)
    .where(and(eq(evalAttempt.runId, runId), eq(evalAttempt.transcriptId, transcriptId)))
    .orderBy(evalAttempt.attemptNumber);

  const dataset = await loadDataset((runRow.datasetFilter as DatasetFilter) ?? undefined);
  const datasetCase = dataset.find((item) => item.id === transcriptId);
  if (!datasetCase) {
    return null;
  }

  return {
    ...toCaseResult(caseRow, runRow, attempts),
    transcript: datasetCase.transcript,
    gold: datasetCase.gold,
  };
}

type ExecuteRunInput = {
  runId: string;
  strategy: PromptStrategy;
  model: string;
  promptHash: string;
  dataset: DatasetCase[];
  force: boolean;
  initial: RunState;
};

type RunState = {
  scores: CaseScores[];
  hallucinationCount: number;
  schemaFailureCount: number;
  usage: TokenUsage;
  completedCases: number;
  startedAt: number;
};

async function executeRun({
  runId,
  strategy,
  model,
  promptHash,
  dataset,
  force,
  initial,
}: ExecuteRunInput): Promise<RunSummary> {
  const limiter = new ConcurrencyLimiter(CONCURRENCY_LIMIT);
  const state = { ...initial };

  try {
    await Promise.all(
      dataset.map((item) =>
        limiter.run(async () => {
          await processCase({ runId, strategy, model, promptHash, datasetCase: item, force, state });
        }),
      ),
    );

    const finalSummary = await finalizeRun(runId, state, "completed", model);
    publishRunEvent(runId, "completed", finalSummary);
    return finalSummary;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown run error";
    const failureSummary = await finalizeRun(runId, state, "failed", model, message);
    publishRunEvent(runId, "failed", failureSummary);
    return failureSummary;
  }
}

async function processCase({
  runId,
  strategy,
  model,
  promptHash,
  datasetCase,
  force,
  state,
}: {
  runId: string;
  strategy: PromptStrategy;
  model: string;
  promptHash: string;
  datasetCase: DatasetCase;
  force: boolean;
  state: RunState;
}) {
  const cached = force ? null : await findCachedCase(datasetCase.id, strategy, model, promptHash);
  let caseResult: CaseResult;

  if (shouldReuseCachedCase(force, cached)) {
    caseResult = cached;
    await db.insert(evalCaseResult).values({
      id: randomUUID(),
      runId,
      transcriptId: datasetCase.id,
      prediction: cached.prediction,
      scores: cached.scores,
      hallucinations: cached.hallucinations,
      schemaValid: cached.schemaValid,
      usage: emptyUsage(),
      wallTimeMs: 0,
    });
  } else {
    const caseStart = Date.now();
    const extraction = await withRateLimitBackoff(() =>
      extractClinicalData({ transcript: datasetCase.transcript, strategy, model }),
    );
    const evaluation = evaluateCase({
      transcript: datasetCase.transcript,
      prediction: extraction.prediction,
      gold: datasetCase.gold,
    });
    const wallTimeMs = Date.now() - caseStart;

    caseResult = {
      transcriptId: datasetCase.id,
      strategy,
      model,
      promptHash: extraction.promptHash,
      prediction: extraction.prediction,
      scores: evaluation.scores,
      hallucinations: evaluation.hallucinations,
      schemaValid: extraction.schemaValid,
      attempts: extraction.attempts,
      usage: extraction.usage,
      wallTimeMs,
    };

    await db.insert(evalCaseResult).values({
      id: randomUUID(),
      runId,
      transcriptId: datasetCase.id,
      prediction: extraction.prediction,
      scores: evaluation.scores,
      hallucinations: evaluation.hallucinations,
      schemaValid: extraction.schemaValid,
      usage: extraction.usage,
      wallTimeMs,
    });

    if (extraction.attempts.length) {
      await db.insert(evalAttempt).values(
        extraction.attempts.map((attempt) => ({
          id: randomUUID(),
          runId,
          transcriptId: datasetCase.id,
          attemptNumber: attempt.attempt,
          promptHash: attempt.promptHash,
          request: attempt.request,
          response: attempt.response,
          validationErrors: attempt.validationErrors,
          usage: attempt.usage,
          durationMs: attempt.durationMs,
        })),
      );
    }
  }

  state.completedCases += 1;
  if (!caseResult.schemaValid) {
    state.schemaFailureCount += 1;
  }
  state.hallucinationCount += caseResult.hallucinations.length;
  state.scores.push(caseResult.scores);
  state.usage = addUsage(state.usage, caseResult.usage);

  const runSummary = await updateRunProgress(runId, state, model);
  publishRunEvent(runId, "progress", runSummary);
  publishRunEvent(runId, "case_completed", caseResult);
}

async function finalizeRun(
  runId: string,
  state: RunState,
  status: RunStatus,
  model: string,
  lastError?: string,
): Promise<RunSummary> {
  const wallTimeMs = Date.now() - state.startedAt;
  const fieldAverages = aggregateFieldAverages(state.scores);
  const summary = await updateRunRow(runId, {
    status,
    completedCases: state.completedCases,
    fieldAverages,
    hallucinationCount: state.hallucinationCount,
    schemaFailureCount: state.schemaFailureCount,
    usage: state.usage,
    costUsd: estimateCost(state.usage, model),
    wallTimeMs,
    lastError: lastError ?? null,
    completedAt: status === "completed" ? new Date() : null,
  });

  return toRunSummary(summary);
}

async function updateRunProgress(runId: string, state: RunState, model: string): Promise<RunSummary> {
  const wallTimeMs = Date.now() - state.startedAt;
  const fieldAverages = aggregateFieldAverages(state.scores);
  const summary = await updateRunRow(runId, {
    completedCases: state.completedCases,
    fieldAverages,
    hallucinationCount: state.hallucinationCount,
    schemaFailureCount: state.schemaFailureCount,
    usage: state.usage,
    costUsd: estimateCost(state.usage, model),
    wallTimeMs,
  });
  return toRunSummary(summary);
}

async function updateRunRow(
  runId: string,
  values: Partial<typeof evalRun.$inferInsert>,
): Promise<typeof evalRun.$inferSelect> {
  await db.update(evalRun).set(values).where(eq(evalRun.id, runId));
  return getRunRow(runId);
}

async function getRunRow(runId: string, required = true): Promise<typeof evalRun.$inferSelect> {
  const [row] = await db.select().from(evalRun).where(eq(evalRun.id, runId));
  if (!row && required) {
    throw new Error("Run not found");
  }
  return row as typeof evalRun.$inferSelect;
}

async function resolvePromptHash(strategy: PromptStrategy): Promise<string> {
  const schema = await loadClinicalSchema();
  const prompt = getPrompt(strategy);
  return computePromptHash(prompt.system, schema);
}

async function findCachedCase(
  transcriptId: string,
  strategy: PromptStrategy,
  model: string,
  promptHash: string,
): Promise<CaseResult | null> {
  const [row] = await db
    .select({
      caseResult: evalCaseResult,
      run: evalRun,
    })
    .from(evalCaseResult)
    .innerJoin(evalRun, eq(evalCaseResult.runId, evalRun.id))
    .where(
      and(
        eq(evalCaseResult.transcriptId, transcriptId),
        eq(evalRun.strategy, strategy),
        eq(evalRun.model, model),
        eq(evalRun.promptHash, promptHash),
      ),
    )
    .orderBy(desc(evalRun.createdAt))
    .limit(1);

  if (!row) {
    return null;
  }

  return toCaseResult(row.caseResult, row.run, []);
}

function toRunSummary(row: typeof evalRun.$inferSelect): RunSummary {
  return {
    runId: row.id,
    status: row.status as RunStatus,
    strategy: row.strategy as PromptStrategy,
    model: row.model,
    promptHash: row.promptHash,
    totalCases: row.totalCases,
    completedCases: row.completedCases,
    fieldAverages: (row.fieldAverages as FieldAverages) ?? emptyFieldAverages(),
    hallucinationCount: row.hallucinationCount,
    schemaFailureCount: row.schemaFailureCount,
    usage: (row.usage as TokenUsage) ?? emptyUsage(),
    wallTimeMs: row.wallTimeMs,
    costUsd: row.costUsd,
  };
}

function toCaseResult(
  row: typeof evalCaseResult.$inferSelect,
  runRow: typeof evalRun.$inferSelect,
  attempts: Array<typeof evalAttempt.$inferSelect>,
): CaseResult {
  return {
    transcriptId: row.transcriptId,
    strategy: runRow.strategy as PromptStrategy,
    model: runRow.model,
    promptHash: runRow.promptHash,
    prediction: row.prediction as CaseResult["prediction"],
    scores: row.scores as CaseResult["scores"],
    hallucinations: row.hallucinations as CaseResult["hallucinations"],
    schemaValid: row.schemaValid,
    attempts: attempts.map((attempt) => ({
      attempt: attempt.attemptNumber,
      promptHash: attempt.promptHash,
      request: attempt.request,
      response: attempt.response,
      validationErrors: attempt.validationErrors as string[] | null,
      usage: attempt.usage as TokenUsage,
      durationMs: attempt.durationMs,
    })),
    usage: row.usage as TokenUsage,
    wallTimeMs: row.wallTimeMs,
  };
}

function emptyUsage(): TokenUsage {
  return {
    inputTokens: 0,
    outputTokens: 0,
    cacheReadTokens: 0,
    cacheWriteTokens: 0,
  };
}

function addUsage(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    cacheWriteTokens: a.cacheWriteTokens + b.cacheWriteTokens,
  };
}

function emptyFieldAverages(): FieldAverages {
  return {
    chief_complaint: 0,
    vitals: 0,
    medications_f1: 0,
    diagnoses_f1: 0,
    plan_f1: 0,
    follow_up: 0,
    overall: 0,
  };
}

function buildInitialRunState(scores: CaseScores[] = [], results: Array<typeof evalCaseResult.$inferSelect> = []): RunState {
  return {
    scores: [...scores],
    hallucinationCount: results.reduce((count, row) => count + (row.hallucinations as Array<unknown>).length, 0),
    schemaFailureCount: results.reduce((count, row) => count + (row.schemaValid ? 0 : 1), 0),
    usage: results.reduce((total, row) => addUsage(total, row.usage as TokenUsage), emptyUsage()),
    completedCases: scores.length,
    startedAt: Date.now(),
  };
}

function estimateCost(usage: TokenUsage, model = "claude-haiku-4-5-20251001"): number {
  const rates = MODEL_RATES_PER_MILLION[model];
  if (!rates) {
    return 0;
  }

  const inputCost = (usage.inputTokens / 1_000_000) * rates.input;
  const outputCost = (usage.outputTokens / 1_000_000) * rates.output;
  const cacheReadCost = (usage.cacheReadTokens / 1_000_000) * rates.cacheRead;
  const cacheWriteCost = (usage.cacheWriteTokens / 1_000_000) * rates.cacheWrite;

  return inputCost + outputCost + cacheReadCost + cacheWriteCost;
}

async function withRateLimitBackoff<T>(operation: () => Promise<T>): Promise<T> {
  return withRateLimitBackoffConfig(operation);
}

export async function withRateLimitBackoffConfig<T>(
  operation: () => Promise<T>,
  {
    baseDelayMs = RATE_LIMIT_BASE_DELAY_MS,
    maxRetries = RATE_LIMIT_MAX_RETRIES,
  }: { baseDelayMs?: number; maxRetries?: number } = {},
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt += 1;
      if (!isRateLimitError(error) || attempt > maxRetries) {
        throw error;
      }
      const delayMs = baseDelayMs * Math.pow(2, attempt - 1);
      await delay(delayMs);
    }
  }
}

export function shouldReuseCachedCase(force: boolean, cached: CaseResult | null): cached is CaseResult {
  return !force && cached !== null;
}

function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }
  const status = (error as { status?: number }).status;
  return status === 429;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

class ConcurrencyLimiter {
  private readonly limit: number;
  private active = 0;
  private queue: Array<() => void> = [];

  constructor(limit: number) {
    this.limit = Math.max(1, limit);
  }

  async run<T>(fn: () => Promise<T>): Promise<T> {
    await this.acquire();
    try {
      return await fn();
    } finally {
      this.release();
    }
  }

  private acquire(): Promise<void> {
    if (this.active < this.limit) {
      this.active += 1;
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.queue.push(() => {
        this.active += 1;
        resolve();
      });
    });
  }

  private release() {
    this.active -= 1;
    const next = this.queue.shift();
    if (next) {
      next();
    }
  }
}
