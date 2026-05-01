import { BASE_SYSTEM } from "./base";

const COT_STEPS = [
  "Before calling the tool, silently work through each field in order:",
  "1. chief_complaint — find the patient's opening statement or chief concern; copy verbatim if short.",
  "2. vitals — scan for BP pattern (NNN/NN), HR as integer, temp as decimal, SpO2 as integer. Note units.",
  "3. medications — list every drug mentioned. For each: name as stated, dose with unit, frequency (normalize to once/twice/three/four times daily or as needed), route.",
  "4. diagnoses — list only explicitly stated diagnoses or assessments; do not infer from symptoms alone.",
  "5. plan — one short action phrase per distinct action. Split compound sentences. No explanations.",
  "6. follow_up — find an explicit follow-up instruction; convert weeks to days.",
  "Then call the tool with the final values only. Do not output any text.",
].join("\n");

export const cotPrompt = {
  strategy: "cot" as const,
  system: [BASE_SYSTEM, COT_STEPS].join("\n\n"),
};
