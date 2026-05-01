"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@test-evals/ui/components/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@test-evals/ui/components/card";
import type { PromptStrategy, RunSummary } from "@test-evals/shared";

import { listRuns, startRun } from "@/lib/api-client";
import { ScoreBadge } from "@/components/score-badge";

const STRATEGIES: PromptStrategy[] = ["zero_shot", "few_shot", "cot"];
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export default function RunsList() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [strategy, setStrategy] = useState<PromptStrategy>("zero_shot");
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);

  useEffect(() => {
    let active = true;
    listRuns()
      .then((data) => {
        if (active) {
          setRuns(data);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const handleStart = async () => {
    setStarting(true);
    try {
      const run = await startRun({ strategy, model });
      setRuns((prev) => [run, ...prev]);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-[var(--dash-border)] bg-white/80">
        <CardHeader>
          <CardTitle className="text-lg">Start a new run</CardTitle>
          <CardDescription>Pick a prompt strategy and model to evaluate.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_1fr_auto]">
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--dash-ink-soft)">
            Strategy
            <select
              value={strategy}
              onChange={(event) => setStrategy(event.target.value as PromptStrategy)}
              className="rounded-full border border-(--dash-border) bg-white px-4 py-2 text-sm"
            >
              {STRATEGIES.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-(--dash-ink-soft)">
            Model
            <input
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className="rounded-full border border-(--dash-border) bg-white px-4 py-2 text-sm"
            />
          </label>
          <div className="flex items-end">
            <Button onClick={handleStart} disabled={starting} className="rounded-full">
              {starting ? "Starting..." : "Start run"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {loading && <p className="text-sm text-muted-foreground">Loading runs...</p>}
        {!loading && runs.length === 0 && (
          <p className="text-sm text-muted-foreground">No runs yet. Start one above.</p>
        )}
        {runs.map((run) => (
          <Card key={run.runId} className="border border-(--dash-border) bg-white/90">
            <CardHeader>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base">{run.strategy}</CardTitle>
                  <CardDescription className="text-xs uppercase tracking-[0.2em]">
                    {run.model}
                  </CardDescription>
                </div>
                <span className="rounded-full border border-(--dash-border) px-3 py-1 text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                  {run.status}
                </span>
              </div>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="text-xs uppercase tracking-[0.2em] text-(--dash-ink-soft)">
                  Overall
                </span>
                <ScoreBadge value={run.fieldAverages.overall} />
              </div>
              <div className="grid gap-2 text-xs text-(--dash-ink-soft)">
                <span>Cases: {run.completedCases}/{run.totalCases}</span>
                <span>Cost: ${run.costUsd.toFixed(4)}</span>
                <span>Wall time: {(run.wallTimeMs / 1000).toFixed(1)}s</span>
              </div>
              <Link
                className="text-sm font-semibold text-(--dash-accent) hover:underline"
                href={`/dashboard/runs/${run.runId}`}
              >
                View run details
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
