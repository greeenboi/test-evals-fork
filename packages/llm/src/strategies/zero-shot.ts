import { BASE_SYSTEM } from "./base";

export const zeroShotPrompt = {
  strategy: "zero_shot" as const,
  system: [
    BASE_SYSTEM,
    "Return the best single extraction for the provided transcript.",
  ].join("\n\n"),
};
