export type SetScore = {
  precision: number;
  recall: number;
  f1: number;
  matched: number;
  predicted: number;
  gold: number;
};

export type DiagnosisScore = SetScore & {
  icd10_bonus: number;
};

export type VitalsScore = {
  bp: number;
  hr: number;
  temp_f: number;
  spo2: number;
  average: number;
};

export type FollowUpScore = {
  interval_days: number;
  reason: number;
  average: number;
};

export type CaseScores = {
  chief_complaint: number;
  vitals: VitalsScore;
  medications: SetScore;
  diagnoses: DiagnosisScore;
  plan: SetScore;
  follow_up: FollowUpScore;
  overall: number;
};

export type FieldAverages = {
  chief_complaint: number;
  vitals: number;
  medications_f1: number;
  diagnoses_f1: number;
  plan_f1: number;
  follow_up: number;
  overall: number;
};

export type HallucinationFinding = {
  field: string;
  value: string;
  evidence: string | null;
  similarity: number | null;
};
