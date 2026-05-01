import { BASE_SYSTEM } from "./base";

export const cotPrompt = {
  strategy: "cot" as const,
  system: [
    BASE_SYSTEM,
    "Reason through the transcript step by step, but do not reveal your reasoning.",
    "Only call the tool with the final extracted fields.",
    "Do not include any text outside the tool call.",
  ].join("\n\n"),
};
