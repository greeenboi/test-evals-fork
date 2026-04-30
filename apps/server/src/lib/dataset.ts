import { readFile, readdir } from "node:fs/promises";
import type { ClinicalExtraction, DatasetFilter } from "@test-evals/shared";

export type DatasetCase = {
  id: string;
  transcript: string;
  gold: ClinicalExtraction;
};

export async function loadDataset(filter?: DatasetFilter): Promise<DatasetCase[]> {
  const baseUrl = new URL("../../../../data/", import.meta.url);
  const transcriptsUrl = new URL("transcripts/", baseUrl);
  const goldUrl = new URL("gold/", baseUrl);

  const transcriptFiles = (await readdir(transcriptsUrl))
    .filter((name) => name.endsWith(".txt"))
    .sort();

  const cases: DatasetCase[] = [];

  for (const file of transcriptFiles) {
    const id = file.replace(".txt", "");
    const transcript = await readFile(new URL(file, transcriptsUrl), "utf-8");
    const goldPath = new URL(`${id}.json`, goldUrl);
    const goldRaw = await readFile(goldPath, "utf-8");
    const gold = JSON.parse(goldRaw) as ClinicalExtraction;
    cases.push({ id, transcript, gold });
  }

  return applyDatasetFilter(cases, filter);
}

export function computeRemainingDataset(
  cases: DatasetCase[],
  completedIds: Set<string>,
): DatasetCase[] {
  return cases.filter((item) => !completedIds.has(item.id));
}

export function applyDatasetFilter(cases: DatasetCase[], filter?: DatasetFilter): DatasetCase[] {
  if (!filter) {
    return cases;
  }

  let filtered = cases;
  if (filter.includeIds?.length) {
    const include = new Set(filter.includeIds);
    filtered = filtered.filter((item) => include.has(item.id));
  }

  if (filter.excludeIds?.length) {
    const exclude = new Set(filter.excludeIds);
    filtered = filtered.filter((item) => !exclude.has(item.id));
  }

  if (typeof filter.limit === "number") {
    filtered = filtered.slice(0, Math.max(0, filter.limit));
  }

  return filtered;
}
