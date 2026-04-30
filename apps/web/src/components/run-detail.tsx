"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@test-evals/ui/components/card";
import type { CaseResult, RunSummary } from "@test-evals/shared";

import { getRun, getRunCases, subscribeToRunEvents } from "@/lib/api-client";
import { ScoreBadge } from "@/components/score-badge";

export default function RunDetail({ runId }: { runId: string }) {
  const [run, setRun] = useState<RunSummary | null>(null);
  const [cases, setCases] = useState<CaseResult[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    Promise.all([getRun(runId), getRunCases(runId)])
      .then(([summary, caseRows]) => {
        if (!active) return;
        setRun(summary);
        setCases(caseRows);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    const unsubscribe = subscribeToRunEvents(runId, (event, data) => {
      if (event === "progress") {
        setRun(data as RunSummary);
      }
      if (event === "case_completed") {
        setCases((prev) => {
          const incoming = data as CaseResult;
          const existing = prev.find((item) => item.transcriptId === incoming.transcriptId);
          if (existing) {
            return prev.map((item) => (item.transcriptId === incoming.transcriptId ? incoming : item));
          }
          return [...prev, incoming];
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [runId]);

  const sortedCases = useMemo(
    () => [...cases].sort((a, b) => a.transcriptId.localeCompare(b.transcriptId)),
    [cases],
  );

  if (loading || !run) {
    return <p className="text-sm text-muted-foreground">Loading run details...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-[var(--dash-border)] bg-white/90">
        <CardHeader>
          <CardTitle className="text-lg">Run {run.runId}</CardTitle>
          <CardDescription>
            {run.strategy} · {run.model} · {run.status}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-cool)]/40 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">Overall</p>
            <ScoreBadge value={run.fieldAverages.overall} className="mt-3" />
          </div>
          <div className="space-y-2 text-xs text-[var(--dash-ink-soft)]">
            <p>Cases: {run.completedCases}/{run.totalCases}</p>
            <p>Hallucinations: {run.hallucinationCount}</p>
            <p>Schema failures: {run.schemaFailureCount}</p>
          </div>
          <div className="space-y-2 text-xs text-[var(--dash-ink-soft)]">
            <p>Cost: ${run.costUsd.toFixed(4)}</p>
            <p>Wall time: {(run.wallTimeMs / 1000).toFixed(1)}s</p>
            <p>Prompt hash: {run.promptHash.slice(0, 8)}...</p>
          </div>
        </CardContent>
      </Card>

      <Card className="border border-[var(--dash-border)] bg-white/90">
        <CardHeader>
          <CardTitle className="text-base">Field averages</CardTitle>
          <CardDescription>Higher is better.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <FieldScore label="Chief complaint" value={run.fieldAverages.chief_complaint} />
          <FieldScore label="Vitals" value={run.fieldAverages.vitals} />
          <FieldScore label="Medications F1" value={run.fieldAverages.medications_f1} />
          <FieldScore label="Diagnoses F1" value={run.fieldAverages.diagnoses_f1} />
          <FieldScore label="Plan F1" value={run.fieldAverages.plan_f1} />
          <FieldScore label="Follow up" value={run.fieldAverages.follow_up} />
        </CardContent>
      </Card>

      <Card className="border border-[var(--dash-border)] bg-white/95">
        <CardHeader>
          <CardTitle className="text-base">Cases</CardTitle>
          <CardDescription>Click a case to inspect grounding and traces.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] gap-3 border-b border-[var(--dash-border)] pb-2 text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
            <span>Case</span>
            <span>Overall</span>
            <span>Med F1</span>
            <span>Dx F1</span>
            <span>Plan F1</span>
          </div>
          {sortedCases.map((item) => (
            <Link
              key={item.transcriptId}
              href={`/dashboard/runs/${run.runId}/cases/${item.transcriptId}`}
              className="grid grid-cols-[120px_1fr_1fr_1fr_1fr] items-center gap-3 rounded-2xl border border-[var(--dash-border)] bg-white/80 px-3 py-2 transition hover:border-[var(--dash-accent)]"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.15em] text-[var(--dash-ink-soft)]">
                {item.transcriptId}
              </span>
              <ScoreBadge value={item.scores.overall} />
              <ScoreBadge value={item.scores.medications.f1} />
              <ScoreBadge value={item.scores.diagnoses.f1} />
              <ScoreBadge value={item.scores.plan.f1} />
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function FieldScore({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-[var(--dash-border)] bg-white/80 px-3 py-2">
      <span className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">{label}</span>
      <ScoreBadge value={value} />
    </div>
  );
}
