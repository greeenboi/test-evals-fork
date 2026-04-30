import { Hono } from "hono";
import type { RunRequest } from "@test-evals/shared";
import {
  getCaseDetail,
  getRun,
  getRunCases,
  listRuns,
  resumeRun,
  startRun,
} from "../services/runner.service";
import { createRunEventStream } from "../lib/sse";

export const runsRouter = new Hono();

runsRouter.get("/", async (c) => {
  const runs = await listRuns();
  return c.json(runs);
});

runsRouter.post("/", async (c) => {
  const body = (await c.req.json()) as RunRequest;
  const run = await startRun(body);
  return c.json(run, 201);
});

runsRouter.post("/:id/resume", async (c) => {
  const run = await resumeRun(c.req.param("id"));
  return c.json(run);
});

runsRouter.get("/:id", async (c) => {
  const run = await getRun(c.req.param("id"));
  if (!run) {
    return c.json({ error: "Run not found" }, 404);
  }
  return c.json(run);
});

runsRouter.get("/:id/cases", async (c) => {
  const cases = await getRunCases(c.req.param("id"));
  return c.json(cases);
});

runsRouter.get("/:id/cases/:transcriptId", async (c) => {
  const result = await getCaseDetail(c.req.param("id"), c.req.param("transcriptId"));
  if (!result) {
    return c.json({ error: "Case not found" }, 404);
  }
  return c.json(result);
});

runsRouter.get("/:id/stream", (c) => {
  const runId = c.req.param("id");
  const stream = createRunEventStream(runId, c.req.raw.signal);
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
});
