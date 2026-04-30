export type PromptStrategy = "zero_shot" | "few_shot" | "cot";

export type Vitals = {
  bp: string | null;
  hr: number | null;
  temp_f: number | null;
  spo2: number | null;
};

export type Medication = {
  name: string;
  dose: string | null;
  frequency: string | null;
  route: string | null;
};

export type Diagnosis = {
  description: string;
  icd10?: string;
};

export type FollowUp = {
  interval_days: number | null;
  reason: string | null;
};

export type ClinicalExtraction = {
  chief_complaint: string;
  vitals: Vitals;
  medications: Medication[];
  diagnoses: Diagnosis[];
  plan: string[];
  follow_up: FollowUp;
};
