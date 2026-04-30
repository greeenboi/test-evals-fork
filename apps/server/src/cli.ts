import { runHeadless } from "./services/runner.service";
import type { PromptStrategy, RunRequest } from "@test-evals/shared";

const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

const args = process.argv.slice(2);
const flags = parseArgs(args);

const strategy = (flags.strategy ?? "zero_shot") as PromptStrategy;
const model = flags.model ?? DEFAULT_MODEL;

const request: RunRequest = {
  strategy,
  model,
  dataset_filter: {
    includeIds: flags.include ? flags.include.split(",").filter(Boolean) : undefined,
    excludeIds: flags.exclude ? flags.exclude.split(",").filter(Boolean) : undefined,
    limit: flags.limit ? Number(flags.limit) : undefined,
  },
  force: flags.force === "true",
};

const summary = await runHeadless(request);
console.log(formatSummary(summary));

function parseArgs(argv: string[]): Record<string, string> {
  const result: Record<string, string> = {};
  for (const arg of argv) {
    if (!arg.startsWith("--")) {
      continue;
    }
    const [key, value] = arg.slice(2).split("=") as [string, string?];
    result[key] = value ?? "";
  }
  return result;
}

function formatSummary(summary: {
  runId: string;
  status: string;
  strategy: string;
  model: string;
  fieldAverages: { overall: number; chief_complaint: number; vitals: number; medications_f1: number; diagnoses_f1: number; plan_f1: number; follow_up: number };
  costUsd: number;
  wallTimeMs: number;
}) {
  const rows: [string, number][] = [
    ["overall", summary.fieldAverages.overall],
    ["chief_complaint", summary.fieldAverages.chief_complaint],
    ["vitals", summary.fieldAverages.vitals],
    ["medications_f1", summary.fieldAverages.medications_f1],
    ["diagnoses_f1", summary.fieldAverages.diagnoses_f1],
    ["plan_f1", summary.fieldAverages.plan_f1],
    ["follow_up", summary.fieldAverages.follow_up],
  ];

  const formatted = rows
    .map(([label, value]) => `${label.padEnd(18)} ${value.toFixed(3)}`)
    .join("\n");

  return [
    `Run: ${summary.runId}`,
    `Status: ${summary.status}`,
    `Strategy: ${summary.strategy}`,
    `Model: ${summary.model}`,
    `Cost: $${summary.costUsd.toFixed(4)}`,
    `Wall time: ${(summary.wallTimeMs / 1000).toFixed(1)}s`,
    "",
    "Field Averages:",
    formatted,
  ].join("\n");
}
