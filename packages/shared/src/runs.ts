import type { ClinicalExtraction, PromptStrategy } from "./extraction";
import type { CaseScores, FieldAverages, HallucinationFinding } from "./evaluation";

export type RunStatus = "pending" | "running" | "completed" | "failed" | "canceled";

export type TokenUsage = {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
};

export type LlmAttempt = {
  attempt: number;
  promptHash: string;
  request: unknown;
  response: unknown;
  validationErrors: string[] | null;
  usage: TokenUsage;
  durationMs: number;
};

export type CaseResult = {
  transcriptId: string;
  strategy: PromptStrategy;
  model: string;
  promptHash: string;
  prediction: ClinicalExtraction | null;
  scores: CaseScores;
  hallucinations: HallucinationFinding[];
  schemaValid: boolean;
  attempts: LlmAttempt[];
  usage: TokenUsage;
  wallTimeMs: number;
};

export type CaseDetail = CaseResult & {
  transcript: string;
  gold: ClinicalExtraction;
};

export type DatasetFilter = {
  includeIds?: string[];
  excludeIds?: string[];
  limit?: number;
};

export type RunRequest = {
  strategy: PromptStrategy;
  model: string;
  dataset_filter?: DatasetFilter;
  force?: boolean;
};

export type RunSummary = {
  runId: string;
  status: RunStatus;
  strategy: PromptStrategy;
  model: string;
  promptHash: string;
  totalCases: number;
  completedCases: number;
  fieldAverages: FieldAverages;
  hallucinationCount: number;
  schemaFailureCount: number;
  usage: TokenUsage;
  wallTimeMs: number;
  costUsd: number;
};
