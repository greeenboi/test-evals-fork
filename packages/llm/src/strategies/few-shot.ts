import { BASE_SYSTEM } from "./base";

const EXAMPLES = [
  "Example 1:",
  "Transcript: Patient reports sore throat and cough for 3 days. Vitals: BP 120/80, HR 88, Temp 99.1, SpO2 98. No current meds. Dx: viral URI. Plan: rest, fluids, OTC acetaminophen. Follow up in 7 days if not improved.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "sore throat and cough for 3 days",
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
  "Transcript: Patient here for medication refill. Taking metformin 500 mg BID by mouth. No vitals recorded. Plan: refill metformin, labs in 2 weeks. Follow up in 2 weeks for lab review.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "medication refill",
      vitals: { bp: null, hr: null, temp_f: null, spo2: null },
      medications: [
        {
          name: "metformin",
          dose: "500 mg",
          frequency: "twice daily",
          route: "PO",
        },
      ],
      diagnoses: [],
      plan: ["refill metformin", "labs in 2 weeks"],
      follow_up: { interval_days: 14, reason: "lab review" },
    },
    null,
    2,
  ),
  "",
  "Example 3:",
  "Transcript: Patient has chest tightness and wheezing. Assessment: asthma exacerbation. Plan: albuterol inhaler, start prednisone burst, avoid triggers. No follow-up scheduled.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "chest tightness and wheezing",
      vitals: { bp: null, hr: null, temp_f: null, spo2: null },
      medications: [
        { name: "albuterol inhaler", dose: null, frequency: null, route: null },
        { name: "prednisone", dose: null, frequency: null, route: null },
      ],
      diagnoses: [{ description: "moderate asthma exacerbation" }],
      plan: ["albuterol inhaler", "start prednisone burst", "avoid triggers"],
      follow_up: { interval_days: null, reason: null },
    },
    null,
    2,
  ),
  "",
  "Example 4:",
  "Transcript: 52-year-old with hypertension and type 2 diabetes. BP 148/92, HR 76, Temp 98.6F, SpO2 99. On lisinopril 10 mg daily PO and metformin 1000 mg BID PO. Plan: increase lisinopril to 20 mg, continue metformin, dietary counseling, recheck BP in office, labs including HbA1c. Return in 4 weeks.",
  "Output:",
  JSON.stringify(
    {
      chief_complaint: "hypertension and type 2 diabetes",
      vitals: { bp: "148/92", hr: 76, temp_f: 98.6, spo2: 99 },
      medications: [
        { name: "lisinopril", dose: "10 mg", frequency: "once daily", route: "PO" },
        { name: "metformin", dose: "1000 mg", frequency: "twice daily", route: "PO" },
      ],
      diagnoses: [
        { description: "hypertension" },
        { description: "type 2 diabetes" },
      ],
      plan: [
        "increase lisinopril to 20 mg",
        "continue metformin",
        "dietary counseling",
        "recheck BP in office",
        "labs including HbA1c",
      ],
      follow_up: { interval_days: 28, reason: null },
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
