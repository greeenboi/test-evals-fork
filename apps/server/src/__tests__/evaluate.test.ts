import { describe, expect, test } from "bun:test";

import { evaluateCase } from "../services/evaluate.service";
import type { ClinicalExtraction } from "@test-evals/shared";

const baseExtraction: ClinicalExtraction = {
  chief_complaint: "headache",
  vitals: { bp: null, hr: null, temp_f: null, spo2: null },
  medications: [],
  diagnoses: [],
  plan: [],
  follow_up: { interval_days: null, reason: null },
};

describe("evaluateCase", () => {
  test("matches medications with normalized dose/frequency", () => {
    const transcript = "Patient takes lisinopril 10 mg daily.";
    const prediction: ClinicalExtraction = {
      ...baseExtraction,
      medications: [
        { name: "lisinopril", dose: "10 mg", frequency: "daily", route: "PO" },
      ],
    };
    const gold: ClinicalExtraction = {
      ...baseExtraction,
      medications: [
        { name: "lisinopril", dose: "10mg", frequency: "once daily", route: "oral" },
      ],
    };

    const result = evaluateCase({ transcript, prediction, gold });
    expect(result.scores.medications.f1).toBeCloseTo(1, 3);
  });

  test("computes set-F1 for plan items", () => {
    const transcript = "Plan: rest, fluids, acetaminophen.";
    const prediction: ClinicalExtraction = {
      ...baseExtraction,
      plan: ["rest", "fluids"],
    };
    const gold: ClinicalExtraction = {
      ...baseExtraction,
      plan: ["rest"],
    };

    const result = evaluateCase({ transcript, prediction, gold });
    expect(result.scores.plan.precision).toBeCloseTo(0.5, 3);
    expect(result.scores.plan.recall).toBeCloseTo(1, 3);
    expect(result.scores.plan.f1).toBeCloseTo(0.666, 2);
  });

  test("flags hallucinations when values are missing in transcript", () => {
    const transcript = "Patient reports headache.";
    const prediction: ClinicalExtraction = {
      ...baseExtraction,
      medications: [{ name: "metformin", dose: "500 mg", frequency: "daily", route: "PO" }],
    };

    const result = evaluateCase({ transcript, prediction, gold: baseExtraction });
    expect(result.hallucinations.length).toBeGreaterThan(0);
  });

  test("does not flag grounded values", () => {
    const transcript = "Patient reports headache and takes ibuprofen 200 mg daily.";
    const prediction: ClinicalExtraction = {
      ...baseExtraction,
      medications: [{ name: "ibuprofen", dose: "200 mg", frequency: "daily", route: "PO" }],
    };

    const result = evaluateCase({ transcript, prediction, gold: baseExtraction });
    expect(result.hallucinations.length).toBe(0);
  });
});
