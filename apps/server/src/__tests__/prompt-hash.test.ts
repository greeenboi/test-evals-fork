import { describe, expect, test } from "bun:test";

import { computePromptHash } from "@test-evals/llm";

const schema = {
  type: "object",
  properties: {
    chief_complaint: { type: "string" },
  },
  required: ["chief_complaint"],
};

describe("computePromptHash", () => {
  test("stable for identical inputs", () => {
    const hashA = computePromptHash("system prompt", schema);
    const hashB = computePromptHash("system prompt", schema);
    expect(hashA).toBe(hashB);
  });

  test("changes when prompt changes", () => {
    const hashA = computePromptHash("system prompt", schema);
    const hashB = computePromptHash("system prompt v2", schema);
    expect(hashA).not.toBe(hashB);
  });
});
