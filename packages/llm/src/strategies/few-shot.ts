import { BASE_SYSTEM } from "./base";

const EXAMPLES = [
  "Example 1:",
  "Transcript: Patient reports sore throat and cough for 3 days. Vitals: BP 120/80, HR 88, Temp 99.1, SpO2 98. No current meds. Dx: viral URI. Plan: rest, fluids, OTC acetaminophen. Follow up in 7 days if not improved.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "sore throat and cough",
      vitals: { bp: "120/80", hr: 88, temp_f: 99.1, spo2: 98 },
      medications: [],
      diagnoses: [{ description: "viral URI", icd10: "J06.9" }],
      plan: ["rest", "fluids", "OTC acetaminophen"],
      follow_up: { interval_days: 7, reason: "if not improved" },
    },
    null,
    2,
  ),
  "",
  "Example 2:",
  "Transcript: Patient here for medication refill. Taking lisinopril 10 mg daily by mouth. No vitals recorded. Plan: refill lisinopril, labs in 30 days. Follow up in 30 days for lab review.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "medication refill",
      vitals: { bp: null, hr: null, temp_f: null, spo2: null },
      medications: [
        {
          name: "lisinopril",
          dose: "10 mg",
          frequency: "daily",
          route: "PO",
        },
      ],
      diagnoses: [],
      plan: ["refill lisinopril", "labs in 30 days"],
      follow_up: { interval_days: 30, reason: "lab review" },
    },
    null,
    2,
  ),
].join("\n");

export const fewShotPrompt = {
  strategy: "few_shot" as const,
  system: [
    BASE_SYSTEM,
    "Use the examples for formatting and level of detail.",
    EXAMPLES,
    "Now extract the fields for the provided transcript.",
  ].join("\n\n"),
};
