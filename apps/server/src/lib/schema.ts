import { readFile } from "node:fs/promises";

let cachedSchema: Record<string, unknown> | null = null;

export async function loadClinicalSchema(): Promise<Record<string, unknown>> {
  if (cachedSchema) {
    return cachedSchema;
  }

  const schemaUrl = new URL("../../../../data/schema.json", import.meta.url);
  const raw = await readFile(schemaUrl, "utf-8");
  cachedSchema = JSON.parse(raw) as Record<string, unknown>;
  return cachedSchema;
}
