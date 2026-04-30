import Anthropic from "@anthropic-ai/sdk";
import Ajv, { type ErrorObject } from "ajv";
import { createHash } from "node:crypto";
import type { ClinicalExtraction, LlmAttempt, PromptStrategy, TokenUsage } from "@test-evals/shared";
import { cotPrompt, fewShotPrompt, zeroShotPrompt } from "./strategies";

export const TOOL_NAME = "extract_clinical_data";
const DEFAULT_MAX_TOKENS = 1200;

type JsonSchema = Record<string, unknown>;

type PromptTemplate = {
  strategy: PromptStrategy;
  system: string;
};

type AnthropicUsage = {
  input_tokens?: number;
  output_tokens?: number;
  cache_read_input_tokens?: number;
  cache_creation_input_tokens?: number;
};

const PROMPTS: Record<PromptStrategy, PromptTemplate> = {
  zero_shot: zeroShotPrompt,
  few_shot: fewShotPrompt,
  cot: cotPrompt,
};

export type ExtractOptions = {
  transcript: string;
  strategy: PromptStrategy;
  model: string;
  schema: JsonSchema;
  maxAttempts?: number;
  client: Anthropic;
};

export type ExtractResult = {
  promptHash: string;
  prediction: ClinicalExtraction | null;
  attempts: LlmAttempt[];
  usage: TokenUsage;
};

export function getPrompt(strategy: PromptStrategy): PromptTemplate {
  return PROMPTS[strategy];
}

export function computePromptHash(systemPrompt: string, schema: JsonSchema): string {
  const hash = createHash("sha256");
  hash.update(systemPrompt);
  hash.update("\n");
  hash.update(JSON.stringify(schema));
  return hash.digest("hex");
}

export async function extractWithRetries({
  transcript,
  strategy,
  model,
  schema,
  maxAttempts = 3,
  client,
}: ExtractOptions): Promise<ExtractResult> {
  const prompt = getPrompt(strategy);
  const promptHash = computePromptHash(prompt.system, schema);
  const validator = new Ajv({ allErrors: true, strict: false }).compile(schema);
  const attempts: LlmAttempt[] = [];
  let prediction: ClinicalExtraction | null = null;
  let validationErrors: string[] | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = await runAttempt({
      transcript,
      model,
      schema,
      prompt,
      promptHash,
      validator,
      attempt,
      validationErrors,
      client,
    });
    attempts.push(result.attempt);

    if (!result.attempt.validationErrors) {
      prediction = result.prediction;
      break;
    }

    validationErrors = result.attempt.validationErrors;
  }

  const usage = attempts.reduce((total, attempt) => addUsage(total, attempt.usage), emptyUsage());

  return {
    promptHash,
    prediction,
    attempts,
    usage,
  };
}

type RunAttemptParams = {
  transcript: string;
  model: string;
  schema: JsonSchema;
  prompt: PromptTemplate;
  promptHash: string;
  validator: ReturnType<Ajv["compile"]>;
  attempt: number;
  validationErrors: string[] | null;
  client: Anthropic;
};

type RunAttemptResult = {
  attempt: LlmAttempt;
  prediction: ClinicalExtraction | null;
};

async function runAttempt({
  transcript,
  model,
  schema,
  prompt,
  promptHash,
  validator,
  attempt,
  validationErrors,
  client,
}: RunAttemptParams): Promise<RunAttemptResult> {
  const userContent: Array<{
    type: "text";
    text: string;
    cache_control?: { type: "ephemeral" };
  }> = [
    {
      type: "text",
      text: `Transcript:\n${transcript}`,
      cache_control: { type: "ephemeral" },
    },
  ];

  if (validationErrors?.length) {
    userContent.push({
      type: "text",
      text: `The previous output failed JSON Schema validation:\n${validationErrors.join("\n")}`,
      cache_control: { type: "ephemeral" },
    });
  }

  type MessageCreateParams = Parameters<Anthropic["messages"]["create"]>[0];
  const request: MessageCreateParams = {
    model,
    max_tokens: DEFAULT_MAX_TOKENS,
    temperature: 0,
    system: [{ type: "text", text: prompt.system, cache_control: { type: "ephemeral" } }],
    messages: [
      {
        role: "user",
        content: userContent,
      },
    ],
    tools: [
      {
        name: TOOL_NAME,
        description: "Extract structured clinical data from the transcript.",
        input_schema: { type: "object" as const, ...schema },
      },
    ],
    tool_choice: { type: "tool", name: TOOL_NAME },
  };

  const startedAt = Date.now();
  const response = (await client.messages.create(request)) as Anthropic.Message;
  const durationMs = Date.now() - startedAt;

  const toolUse = response.content.find(
    (block): block is Anthropic.ToolUseBlock =>
      block.type === "tool_use" && (block as Anthropic.ToolUseBlock).name === TOOL_NAME,
  );

  const candidate = toolUse?.input ?? null;
  let finalErrors: string[] | null = null;
  let prediction: ClinicalExtraction | null = null;

  if (!toolUse) {
    finalErrors = ["Model response missing extract_clinical_data tool call."];
  } else if (!validator(candidate)) {
    finalErrors = formatAjvErrors(validator.errors);
  } else {
    prediction = candidate as ClinicalExtraction;
  }

  const attemptUsage = toUsage(response.usage as AnthropicUsage | undefined);

  const attemptRecord: LlmAttempt = {
    attempt,
    promptHash,
    request,
    response,
    validationErrors: finalErrors,
    usage: attemptUsage,
    durationMs,
  };

  return { attempt: attemptRecord, prediction };
}

function formatAjvErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors?.length) {
    return ["Unknown schema validation error."];
  }

  return errors.map((error) => {
    const location = error.instancePath || "root";
    const message = error.message ?? "failed validation";
    return `${location}: ${message}`;
  });
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

function toUsage(usage: AnthropicUsage | undefined): TokenUsage {
  return {
    inputTokens: usage?.input_tokens ?? 0,
    outputTokens: usage?.output_tokens ?? 0,
    cacheReadTokens: usage?.cache_read_input_tokens ?? 0,
    cacheWriteTokens: usage?.cache_creation_input_tokens ?? 0,
  };
}
