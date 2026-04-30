import { describe, expect, test } from "bun:test";

import { extractWithRetries, TOOL_NAME } from "@test-evals/llm";

const schema = {
  type: "object",
  properties: {
    chief_complaint: { type: "string" },
  },
  required: ["chief_complaint"],
  additionalProperties: false,
};

describe("extractWithRetries", () => {
  test("retries when schema validation fails", async () => {
    let callCount = 0;

    const fakeClient = {
      messages: {
        create: async () => {
          callCount += 1;
          if (callCount === 1) {
            return {
              content: [
                {
                  type: "tool_use",
                  name: TOOL_NAME,
                  input: { chief_complaint: 42 },
                },
              ],
              usage: { input_tokens: 10, output_tokens: 5 },
            };
          }
          return {
            content: [
              {
                type: "tool_use",
                name: TOOL_NAME,
                input: { chief_complaint: "cough" },
              },
            ],
            usage: { input_tokens: 10, output_tokens: 5 },
          };
        },
      },
    } as unknown;

    const result = await extractWithRetries({
      transcript: "Patient has cough",
      strategy: "zero_shot",
      model: "claude-haiku-4-5-20251001",
      schema,
      client: fakeClient as never,
      maxAttempts: 2,
    });

    expect(callCount).toBe(2);
    expect(result.prediction?.chief_complaint).toBe("cough");
    expect(result.attempts[0]!.validationErrors?.length).toBeGreaterThan(0);
  });
});
