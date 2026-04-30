import Anthropic from "@anthropic-ai/sdk";
import { env } from "@test-evals/env/server";
import { extractWithRetries } from "@test-evals/llm";
import type { ClinicalExtraction, LlmAttempt, PromptStrategy, TokenUsage } from "@test-evals/shared";
import { loadClinicalSchema } from "../lib/schema";

const anthropicClient = new Anthropic({
  apiKey: env.ANTHROPIC_API_KEY,
});

export type ExtractionResult = {
  promptHash: string;
  prediction: ClinicalExtraction | null;
  attempts: LlmAttempt[];
  usage: TokenUsage;
  schemaValid: boolean;
};

export async function extractClinicalData({
  transcript,
  strategy,
  model,
}: {
  transcript: string;
  strategy: PromptStrategy;
  model: string;
}): Promise<ExtractionResult> {
  const schema = await loadClinicalSchema();
  const result = await extractWithRetries({
    transcript,
    strategy,
    model,
    schema,
    client: anthropicClient,
  });

  return {
    promptHash: result.promptHash,
    prediction: result.prediction,
    attempts: result.attempts,
    usage: result.usage,
    schemaValid: result.prediction !== null,
  };
}
