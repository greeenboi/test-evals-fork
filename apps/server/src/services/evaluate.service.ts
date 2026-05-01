import type {
  CaseScores,
  ClinicalExtraction,
  DiagnosisScore,
  FieldAverages,
  FollowUpScore,
  HallucinationFinding,
  SetScore,
  VitalsScore,
} from "@test-evals/shared";

const TEXT_MATCH_THRESHOLD = 0.8;
const DIAGNOSIS_MATCH_THRESHOLD = 0.6;

// Standard clinical abbreviations that are valid schema outputs but never appear
// verbatim in transcripts. Checking them for hallucinations produces only false positives.
const ROUTE_SYNONYMS: Record<string, string[]> = {
  po: ["by mouth", "oral", "orally", "mouth"],
  iv: ["intravenous", "intravenously", "iv drip", "iv push"],
  im: ["intramuscular", "intramuscularly", "injection"],
  sq: ["subcutaneous", "subcutaneously", "subcut"],
  sl: ["sublingual", "under the tongue"],
  intranasal: ["nasal", "nostril", "nose", "nasal spray"],
  topical: ["topically", "skin", "apply", "cream", "ointment", "gel"],
  inhaled: ["inhaler", "inhale", "nebulizer", "puffer"],
  ophthalmic: ["eye", "eyes", "drops", "optic"],
};

export type EvaluationResult = {
  scores: CaseScores;
  hallucinations: HallucinationFinding[];
};

export function evaluateCase({
  transcript,
  prediction,
  gold,
}: {
  transcript: string;
  prediction: ClinicalExtraction | null;
  gold: ClinicalExtraction;
}): EvaluationResult {
  if (!prediction) {
    return {
      scores: emptyScores(),
      hallucinations: [],
    };
  }

  const chiefComplaintScore = fuzzyMatch(prediction.chief_complaint, gold.chief_complaint);
  const vitalsScore = scoreVitals(prediction.vitals, gold.vitals);
  const medicationsScore = scoreMedications(prediction.medications, gold.medications);
  const diagnosesScore = scoreDiagnoses(prediction.diagnoses, gold.diagnoses);
  const planScore = scorePlan(prediction.plan, gold.plan);
  const followUpScore = scoreFollowUp(prediction.follow_up, gold.follow_up);

  const overall = average([
    chiefComplaintScore,
    vitalsScore.average,
    medicationsScore.f1,
    diagnosesScore.f1,
    planScore.f1,
    followUpScore.average,
  ]);

  return {
    scores: {
      chief_complaint: chiefComplaintScore,
      vitals: vitalsScore,
      medications: medicationsScore,
      diagnoses: diagnosesScore,
      plan: planScore,
      follow_up: followUpScore,
      overall,
    },
    hallucinations: detectHallucinations(transcript, prediction),
  };
}

export function aggregateFieldAverages(cases: CaseScores[]): FieldAverages {
  if (cases.length === 0) {
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

  return {
    chief_complaint: average(cases.map((item) => item.chief_complaint)),
    vitals: average(cases.map((item) => item.vitals.average)),
    medications_f1: average(cases.map((item) => item.medications.f1)),
    diagnoses_f1: average(cases.map((item) => item.diagnoses.f1)),
    plan_f1: average(cases.map((item) => item.plan.f1)),
    follow_up: average(cases.map((item) => item.follow_up.average)),
    overall: average(cases.map((item) => item.overall)),
  };
}

function scoreVitals(
  predicted: ClinicalExtraction["vitals"],
  gold: ClinicalExtraction["vitals"],
): VitalsScore {
  const bp = compareText(predicted.bp, gold.bp);
  const hr = compareNumber(predicted.hr, gold.hr, 1);
  const temp_f = compareNumber(predicted.temp_f, gold.temp_f, 0.2);
  const spo2 = compareNumber(predicted.spo2, gold.spo2, 1);
  const averageScore = average([bp, hr, temp_f, spo2]);

  return { bp, hr, temp_f, spo2, average: averageScore };
}

function scoreMedications(
  predicted: ClinicalExtraction["medications"],
  gold: ClinicalExtraction["medications"],
): SetScore {
  const matches = matchSets(predicted, gold, isMedicationMatch);
  return setScore(matches.matched, predicted.length, gold.length);
}

function scoreDiagnoses(
  predicted: ClinicalExtraction["diagnoses"],
  gold: ClinicalExtraction["diagnoses"],
): DiagnosisScore {
  const matches = matchSets(predicted, gold, (a, b) =>
    fuzzyMatch(a.description, b.description) >= DIAGNOSIS_MATCH_THRESHOLD,
  );
  const base = setScore(matches.matched, predicted.length, gold.length);
  const icd10Matches = matches.pairs.filter(([pred, truth]) =>
    normalizeIcd10(pred.icd10) && normalizeIcd10(truth.icd10)
      ? normalizeIcd10(pred.icd10) === normalizeIcd10(truth.icd10)
      : false,
  ).length;
  const icd10_bonus = matches.matched === 0 ? 0 : icd10Matches / matches.matched;

  return { ...base, icd10_bonus };
}

const PLAN_MATCH_THRESHOLD = 0.5;

function scorePlan(predicted: string[], gold: string[]): SetScore {
  const matches = matchSets(predicted, gold, (a, b) => fuzzyMatch(a, b) >= PLAN_MATCH_THRESHOLD);
  return setScore(matches.matched, predicted.length, gold.length);
}

function scoreFollowUp(
  predicted: ClinicalExtraction["follow_up"],
  gold: ClinicalExtraction["follow_up"],
): FollowUpScore {
  const interval_days = compareNumber(predicted.interval_days, gold.interval_days, 1);
  const reason = compareText(predicted.reason, gold.reason);
  const averageScore = average([interval_days, reason]);
  return { interval_days, reason, average: averageScore };
}

function isMedicationMatch(
  predicted: ClinicalExtraction["medications"][number],
  gold: ClinicalExtraction["medications"][number],
): boolean {
  const nameScore = fuzzyMatch(predicted.name, gold.name);
  if (nameScore < TEXT_MATCH_THRESHOLD) {
    return false; // wrong drug — no credit
  }
  const doseMatch = normalizeDose(predicted.dose) === normalizeDose(gold.dose) ? 1 : 0;
  const frequencyMatch =
    normalizeFrequency(predicted.frequency) === normalizeFrequency(gold.frequency) ? 1 : 0;
  // Name must be right; dose+frequency contribute partial credit (0.4 + 0.3 + 0.3)
  const weighted = 0.4 * nameScore + 0.3 * doseMatch + 0.3 * frequencyMatch;
  return weighted >= 0.4; // passes if name is right, sub-fields are optional bonus
}

function matchSets<T>(
  predicted: T[],
  gold: T[],
  isMatch: (a: T, b: T) => boolean,
): { matched: number; pairs: Array<[T, T]> } {
  const usedGold = new Set<number>();
  const pairs: Array<[T, T]> = [];

  for (const pred of predicted) {
    let matchIndex: number | null = null;
    for (let idx = 0; idx < gold.length; idx += 1) {
      if (usedGold.has(idx)) {
        continue;
      }
      if (isMatch(pred, gold[idx]!)) {
        matchIndex = idx;
        break;
      }
    }

    if (matchIndex !== null) {
      usedGold.add(matchIndex);
      pairs.push([pred, gold[matchIndex]!]);
    }
  }

  return { matched: pairs.length, pairs };
}

function setScore(matched: number, predicted: number, gold: number): SetScore {
  if (predicted === 0 && gold === 0) {
    return { precision: 1, recall: 1, f1: 1, matched: 0, predicted: 0, gold: 0 };
  }

  const precision = predicted === 0 ? 0 : matched / predicted;
  const recall = gold === 0 ? 0 : matched / gold;
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);

  return { precision, recall, f1, matched, predicted, gold };
}

function compareText(a: string | null, b: string | null): number {
  if (!a && !b) {
    return 1;
  }
  if (!a || !b) {
    return 0;
  }
  return fuzzyMatch(a, b);
}

function compareNumber(a: number | null, b: number | null, tolerance: number): number {
  if (a === null && b === null) {
    return 1;
  }
  if (a === null || b === null) {
    return 0;
  }
  return Math.abs(a - b) <= tolerance ? 1 : 0;
}

function fuzzyMatch(a: string, b: string): number {
  const tokensA = tokenize(a);
  const tokensB = tokenize(b);
  if (tokensA.length === 0 && tokensB.length === 0) {
    return 1;
  }
  if (tokensA.length === 0 || tokensB.length === 0) {
    return 0;
  }

  const setA = new Set(tokensA);
  const setB = new Set(tokensB);
  let intersection = 0;
  for (const token of setA) {
    if (setB.has(token)) {
      intersection += 1;
    }
  }
  const union = setA.size + setB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function tokenize(text: string): string[] {
  return normalizeText(text)
    .split(" ")
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeDose(value: string | null): string | null {
  if (!value) {
    return null;
  }
  return value.toLowerCase().replace(/\s+/g, "").trim();
}

function normalizeFrequency(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const normalized = normalizeText(value);
  if (["bid", "b i d", "twice daily", "2x daily", "2x day", "2x per day"].includes(normalized)) {
    return "twice daily";
  }
  if (["qd", "q d", "daily", "once daily", "once a day"].includes(normalized)) {
    return "once daily";
  }
  if (["tid", "t i d", "three times daily", "3x daily", "3x per day"].includes(normalized)) {
    return "three times daily";
  }
  if (["qid", "q i d", "four times daily", "4x daily", "4x per day"].includes(normalized)) {
    return "four times daily";
  }
  if (["prn", "as needed"].includes(normalized)) {
    return "as needed";
  }
  return normalized;
}

function normalizeIcd10(value: string | undefined): string | null {
  if (!value) {
    return null;
  }
  return value.toUpperCase().replace(/\s+/g, "").trim();
}

function detectHallucinations(
  transcript: string,
  prediction: ClinicalExtraction,
): HallucinationFinding[] {
  const findings: HallucinationFinding[] = [];
  const transcriptNorm = normalizeText(transcript);

  const isGrounded = (valueText: string): boolean => {
    const normalizedValue = normalizeText(valueText);
    if (!normalizedValue) {
      return true;
    }
    if (transcriptNorm.includes(normalizedValue)) {
      return true;
    }
    // Check route synonyms so "PO" grounded by "by mouth", "oral", etc.
    const routeSynonyms = ROUTE_SYNONYMS[normalizedValue];
    if (routeSynonyms?.some((syn) => transcriptNorm.includes(syn))) {
      return true;
    }
    return fuzzyMatch(valueText, transcript) >= TEXT_MATCH_THRESHOLD;
  };

  const checkValue = (field: string, value: string | number | null | undefined) => {
    if (value === null || value === undefined) {
      return;
    }
    const valueText = String(value);
    if (!valueText.trim()) {
      return;
    }
    if (!isGrounded(valueText)) {
      findings.push({ field, value: valueText, evidence: null, similarity: fuzzyMatch(valueText, transcript) });
    }
  };

  checkValue("chief_complaint", prediction.chief_complaint);
  checkValue("vitals.bp", prediction.vitals.bp);
  checkValue("vitals.hr", prediction.vitals.hr);
  checkValue("vitals.temp_f", prediction.vitals.temp_f);
  checkValue("vitals.spo2", prediction.vitals.spo2);

  prediction.medications.forEach((med, index) => {
    checkValue(`medications[${index}].name`, med.name);
    checkValue(`medications[${index}].dose`, med.dose);
    checkValue(`medications[${index}].frequency`, med.frequency);
    checkValue(`medications[${index}].route`, med.route);
  });

  prediction.diagnoses.forEach((dx, index) => {
    checkValue(`diagnoses[${index}].description`, dx.description);
    // ICD-10 codes are valid schema outputs derived from diagnoses — they are never
    // stated verbatim in transcripts, so checking them would only produce false positives.
  });

  prediction.plan.forEach((item, index) => {
    checkValue(`plan[${index}]`, item);
  });

  checkValue("follow_up.interval_days", prediction.follow_up.interval_days);
  checkValue("follow_up.reason", prediction.follow_up.reason);

  return findings.filter((finding) => finding.evidence === null);
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function emptyScores(): CaseScores {
  return {
    chief_complaint: 0,
    vitals: { bp: 0, hr: 0, temp_f: 0, spo2: 0, average: 0 },
    medications: { precision: 0, recall: 0, f1: 0, matched: 0, predicted: 0, gold: 0 },
    diagnoses: { precision: 0, recall: 0, f1: 0, matched: 0, predicted: 0, gold: 0, icd10_bonus: 0 },
    plan: { precision: 0, recall: 0, f1: 0, matched: 0, predicted: 0, gold: 0 },
    follow_up: { interval_days: 0, reason: 0, average: 0 },
    overall: 0,
  };
}
