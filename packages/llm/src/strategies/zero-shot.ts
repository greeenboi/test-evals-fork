import { BASE_SYSTEM } from "./base";

export const zeroShotPrompt = {
  strategy: "zero_shot" as const,
  system: [
    BASE_SYSTEM,
    "Return the best single extraction for the provided transcript.",
    "Do not include any text outside the tool call.",
  ].join("\n\n"),
};
