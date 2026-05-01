import { readFile } from "node:fs/promises";

let cachedSchema: Record<string, unknown> | null = null;

export async function loadClinicalSchema(): Promise<Record<string, unknown>> {
  if (cachedSchema) {
    return cachedSchema;
  }

  const schemaUrl = new URL("../../../../data/schema.json", import.meta.url);
  const raw = await readFile(schemaUrl, "utf-8");
  const parsed = JSON.parse(raw) as Record<string, unknown>;

  // Strip JSON Schema meta-schema keywords. AJV v8 tries to resolve $schema
  // as a meta-schema URI and throws when it can't find the draft-2020-12
  // spec in its built-in registry. $id has no effect on validation either.
  delete parsed.$schema;
  delete parsed.$id;

  cachedSchema = parsed;
  return cachedSchema;
}
