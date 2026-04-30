"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@test-evals/ui/components/card";
import type { FieldAverages, RunSummary } from "@test-evals/shared";

import { listRuns } from "@/lib/api-client";

export default function RunCompare() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [leftId, setLeftId] = useState<string>("");
  const [rightId, setRightId] = useState<string>("");

  useEffect(() => {
    listRuns().then((data) => {
      setRuns(data);
      if (data.length >= 2) {
        setLeftId(data[0].runId);
        setRightId(data[1].runId);
      }
    });
  }, []);

  const leftRun = runs.find((run) => run.runId === leftId) ?? null;
  const rightRun = runs.find((run) => run.runId === rightId) ?? null;

  const rows = useMemo(() => {
    if (!leftRun || !rightRun) return [];
    return buildDeltaRows(leftRun.fieldAverages, rightRun.fieldAverages);
  }, [leftRun, rightRun]);

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-[var(--dash-border)] bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Compare runs</CardTitle>
          <CardDescription>Pick two runs to see per-field deltas.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <RunSelect label="Run A" value={leftId} onChange={setLeftId} runs={runs} />
          <RunSelect label="Run B" value={rightId} onChange={setRightId} runs={runs} />
        </CardContent>
      </Card>

      {leftRun && rightRun && (
        <Card className="border border-[var(--dash-border)] bg-white/95">
          <CardHeader>
            <CardTitle className="text-base">Field deltas</CardTitle>
            <CardDescription>
              Positive values favor Run A. Negative values favor Run B.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            {rows.map((row) => (
              <div
                key={row.field}
                className="grid gap-2 rounded-2xl border border-[var(--dash-border)] bg-white/85 p-3 sm:grid-cols-[160px_1fr_1fr_1fr]"
              >
                <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                  {row.field}
                </span>
                <span className="text-xs text-[var(--dash-ink-soft)]">A: {row.left.toFixed(3)}</span>
                <span className="text-xs text-[var(--dash-ink-soft)]">B: {row.right.toFixed(3)}</span>
                <span className={row.delta >= 0 ? "text-[var(--dash-accent)]" : "text-[oklch(0.55_0.2_25)]"}>
                  {row.delta >= 0 ? "+" : ""}{row.delta.toFixed(3)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!leftRun || !rightRun ? (
        <p className="text-sm text-muted-foreground">Select two runs to compare.</p>
      ) : null}
    </div>
  );
}

function RunSelect({
  label,
  value,
  onChange,
  runs,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  runs: RunSummary[];
}) {
  return (
    <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-full border border-[var(--dash-border)] bg-white px-4 py-2 text-sm"
      >
        <option value="">Select a run</option>
        {runs.map((run) => (
          <option key={run.runId} value={run.runId}>
            {run.strategy} · {run.model} · {run.runId.slice(0, 6)}
          </option>
        ))}
      </select>
    </label>
  );
}

function buildDeltaRows(left: FieldAverages, right: FieldAverages) {
  return [
    { field: "overall", left: left.overall, right: right.overall },
    { field: "chief_complaint", left: left.chief_complaint, right: right.chief_complaint },
    { field: "vitals", left: left.vitals, right: right.vitals },
    { field: "medications_f1", left: left.medications_f1, right: right.medications_f1 },
    { field: "diagnoses_f1", left: left.diagnoses_f1, right: right.diagnoses_f1 },
    { field: "plan_f1", left: left.plan_f1, right: right.plan_f1 },
    { field: "follow_up", left: left.follow_up, right: right.follow_up },
  ].map((row) => ({
    ...row,
    delta: row.left - row.right,
  }));
}
