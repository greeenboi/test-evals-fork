import { env } from "@test-evals/env/web";
import type { CaseDetail, CaseResult, RunRequest, RunSummary } from "@test-evals/shared";

const BASE_URL = env.NEXT_PUBLIC_SERVER_URL.replace(/\/$/, "");

type FetchOptions = Omit<RequestInit, "body"> & { body?: unknown };

type RunEventHandler = (event: string, data: unknown) => void;

export async function apiFetch<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers ?? {}),
    },
    credentials: "include",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || "Request failed");
  }

  return (await response.json()) as T;
}

export async function pingServer(): Promise<boolean> {
  const response = await fetch(`${BASE_URL}/`, {
    credentials: "include",
  });
  return response.ok;
}

export function listRuns() {
  return apiFetch<RunSummary[]>("/api/v1/runs");
}

export function startRun(request: RunRequest) {
  return apiFetch<RunSummary>("/api/v1/runs", { method: "POST", body: request });
}

export function getRun(runId: string) {
  return apiFetch<RunSummary>(`/api/v1/runs/${runId}`);
}

export function getRunCases(runId: string) {
  return apiFetch<CaseResult[]>(`/api/v1/runs/${runId}/cases`);
}

export function getCaseDetail(runId: string, transcriptId: string) {
  return apiFetch<CaseDetail>(`/api/v1/runs/${runId}/cases/${transcriptId}`);
}

export function subscribeToRunEvents(runId: string, handler: RunEventHandler) {
  const source = new EventSource(`${BASE_URL}/api/v1/runs/${runId}/stream`, {
    withCredentials: true,
  });

  const handleEvent = (event: MessageEvent) => {
    handler(event.type, event.data ? JSON.parse(event.data) : null);
  };

  source.addEventListener("progress", handleEvent);
  source.addEventListener("case_completed", handleEvent);
  source.addEventListener("completed", handleEvent);
  source.addEventListener("failed", handleEvent);

  source.addEventListener("open", () => handler("open", { runId }));

  return () => source.close();
}
