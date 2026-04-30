import { describe, expect, test } from "bun:test";

import { applyDatasetFilter, computeRemainingDataset } from "../lib/dataset";
import type { DatasetCase } from "../lib/dataset";
import { shouldReuseCachedCase, withRateLimitBackoffConfig } from "../services/runner.service";

const makeCase = (id: string): DatasetCase => ({
  id,
  transcript: "example",
  gold: {
    chief_complaint: "pain",
    vitals: { bp: null, hr: null, temp_f: null, spo2: null },
    medications: [],
    diagnoses: [],
    plan: [],
    follow_up: { interval_days: null, reason: null },
  },
});

describe("dataset helpers", () => {
  test("filters include/exclude/limit", () => {
    const cases = [makeCase("case_001"), makeCase("case_002"), makeCase("case_003")];
    const filtered = applyDatasetFilter(cases, { includeIds: ["case_001", "case_003"], limit: 1 });
    expect(filtered.map((item) => item.id)).toEqual(["case_001"]);
  });

  test("computes remaining dataset for resumability", () => {
    const cases = [makeCase("case_001"), makeCase("case_002")];
    const remaining = computeRemainingDataset(cases, new Set(["case_001"]));
    expect(remaining.map((item) => item.id)).toEqual(["case_002"]);
  });
});

describe("runner helpers", () => {
  test("reuses cached case when not forced", () => {
    expect(shouldReuseCachedCase(false, { transcriptId: "case_001" } as never)).toBe(true);
    expect(shouldReuseCachedCase(true, { transcriptId: "case_001" } as never)).toBe(false);
    expect(shouldReuseCachedCase(false, null)).toBe(false);
  });

  test("backs off and retries on 429 errors", async () => {
    let attempts = 0;
    const result = await withRateLimitBackoffConfig(
      async () => {
        attempts += 1;
        if (attempts < 3) {
          const error = new Error("rate limited") as Error & { status?: number };
          error.status = 429;
          throw error;
        }
        return "ok";
      },
      { baseDelayMs: 1, maxRetries: 3 },
    );

    expect(result).toBe("ok");
    expect(attempts).toBe(3);
  });
});
