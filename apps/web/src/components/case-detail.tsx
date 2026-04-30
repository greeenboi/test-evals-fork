"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@test-evals/ui/components/card";
import type { CaseDetail } from "@test-evals/shared";

import { getCaseDetail } from "@/lib/api-client";

export default function CaseDetail({ runId, transcriptId }: { runId: string; transcriptId: string }) {
  const [detail, setDetail] = useState<CaseDetail | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    getCaseDetail(runId, transcriptId)
      .then((data) => {
        if (active) {
          setDetail(data);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [runId, transcriptId]);

  const highlightedTranscript = useMemo(() => {
    if (!detail?.prediction) {
      return detail?.transcript ?? "";
    }
    const values = collectPredictionValues(detail.prediction);
    return highlightTranscript(detail.transcript, values);
  }, [detail]);

  if (loading || !detail) {
    return <p className="text-sm text-muted-foreground">Loading case details...</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="border border-[var(--dash-border)] bg-white/90">
        <CardHeader>
          <CardTitle className="text-base">Transcript {detail.transcriptId}</CardTitle>
          <CardDescription>Highlighted where predictions appear in the text.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="whitespace-pre-wrap rounded-2xl border border-[var(--dash-border)] bg-white/70 p-4 text-sm"
            dangerouslySetInnerHTML={{ __html: highlightedTranscript }}
          />
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="border border-[var(--dash-border)] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Gold</CardTitle>
            <CardDescription>Ground truth extraction.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-cool)]/30 p-4 text-xs">
              {JSON.stringify(detail.gold, null, 2)}
            </pre>
          </CardContent>
        </Card>
        <Card className="border border-[var(--dash-border)] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Prediction</CardTitle>
            <CardDescription>LLM output after validation.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="overflow-auto rounded-2xl border border-[var(--dash-border)] bg-[var(--dash-warm)]/35 p-4 text-xs">
              {JSON.stringify(detail.prediction, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </div>

      <Card className="border border-[var(--dash-border)] bg-white/90">
        <CardHeader>
          <CardTitle className="text-base">Field-level diff</CardTitle>
          <CardDescription>Gold vs prediction summary.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {buildDiffRows(detail).map((row) => (
            <div
              key={row.field}
              className="grid gap-2 rounded-2xl border border-[var(--dash-border)] bg-white/80 p-3 sm:grid-cols-[180px_1fr_1fr]"
            >
              <span className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                {row.field}
              </span>
              <span className="text-xs text-[var(--dash-ink-soft)]">Gold</span>
              <span className="text-xs text-[var(--dash-ink-soft)]">Prediction</span>
              <span className="text-sm text-[var(--dash-ink)]">{row.gold}</span>
              <span className="text-sm text-[var(--dash-ink)]">{row.prediction}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {detail.attempts.length > 0 && (
        <Card className="border border-[var(--dash-border)] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">LLM trace</CardTitle>
            <CardDescription>Each attempt with request, response, and validation errors.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detail.attempts.map((attempt) => (
              <div
                key={`attempt-${attempt.attempt}`}
                className="rounded-2xl border border-[var(--dash-border)] bg-white/80 p-4"
              >
                <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                  <span>Attempt {attempt.attempt}</span>
                  <span>Duration {attempt.durationMs}ms</span>
                  <span>Input {attempt.usage.inputTokens}</span>
                  <span>Output {attempt.usage.outputTokens}</span>
                  <span>Cache read {attempt.usage.cacheReadTokens}</span>
                  <span>Cache write {attempt.usage.cacheWriteTokens}</span>
                </div>
                {attempt.validationErrors?.length ? (
                  <div className="mt-3 rounded-xl border border-[var(--dash-border)] bg-[oklch(0.98_0.04_30)]/60 p-3 text-xs">
                    <p className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                      Validation errors
                    </p>
                    <ul className="mt-2 list-disc pl-5 text-[var(--dash-ink)]">
                      {attempt.validationErrors.map((error) => (
                        <li key={error}>{error}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <div className="mt-3 grid gap-3 lg:grid-cols-2">
                  <pre className="overflow-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-cool)]/30 p-3 text-xs">
                    {JSON.stringify(attempt.request, null, 2)}
                  </pre>
                  <pre className="overflow-auto rounded-xl border border-[var(--dash-border)] bg-[var(--dash-warm)]/30 p-3 text-xs">
                    {JSON.stringify(attempt.response, null, 2)}
                  </pre>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {detail.hallucinations.length > 0 && (
        <Card className="border border-[var(--dash-border)] bg-white/90">
          <CardHeader>
            <CardTitle className="text-base">Hallucinations</CardTitle>
            <CardDescription>Values not grounded in the transcript.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {detail.hallucinations.map((finding, index) => (
              <div
                key={`${finding.field}-${index}`}
                className="rounded-2xl border border-[var(--dash-border)] bg-[oklch(0.97_0.04_20)]/60 p-3"
              >
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
                  {finding.field}
                </p>
                <p className="text-sm">{finding.value}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function collectPredictionValues(prediction: CaseDetail["prediction"]): string[] {
  if (!prediction) {
    return [];
  }

  const values: Array<string> = [];
  values.push(prediction.chief_complaint);
  values.push(prediction.vitals.bp ?? "");
  values.push(prediction.vitals.hr?.toString() ?? "");
  values.push(prediction.vitals.temp_f?.toString() ?? "");
  values.push(prediction.vitals.spo2?.toString() ?? "");

  prediction.medications.forEach((med) => {
    values.push(med.name, med.dose ?? "", med.frequency ?? "", med.route ?? "");
  });

  prediction.diagnoses.forEach((dx) => {
    values.push(dx.description, dx.icd10 ?? "");
  });

  prediction.plan.forEach((item) => values.push(item));

  values.push(prediction.follow_up.reason ?? "");
  values.push(prediction.follow_up.interval_days?.toString() ?? "");

  return values.filter((value) => value.length > 2);
}

function highlightTranscript(transcript: string, values: string[]): string {
  let html = escapeHtml(transcript);
  values.forEach((value) => {
    const escaped = escapeRegExp(value.trim());
    if (!escaped) return;
    const regex = new RegExp(escaped, "gi");
    html = html.replace(regex, (match) => {
      return `<mark style=\"background: color-mix(in oklab, var(--dash-accent) 20%, white); padding: 0 0.2em; border-radius: 0.4em;\">${match}</mark>`;
    });
  });
  return html;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildDiffRows(detail: CaseDetail) {
  const prediction = detail.prediction;
  const gold = detail.gold;

  return [
    {
      field: "chief_complaint",
      gold: gold.chief_complaint,
      prediction: prediction?.chief_complaint ?? "null",
    },
    {
      field: "vitals",
      gold: JSON.stringify(gold.vitals),
      prediction: JSON.stringify(prediction?.vitals ?? null),
    },
    {
      field: "medications",
      gold: JSON.stringify(gold.medications),
      prediction: JSON.stringify(prediction?.medications ?? []),
    },
    {
      field: "diagnoses",
      gold: JSON.stringify(gold.diagnoses),
      prediction: JSON.stringify(prediction?.diagnoses ?? []),
    },
    {
      field: "plan",
      gold: JSON.stringify(gold.plan),
      prediction: JSON.stringify(prediction?.plan ?? []),
    },
    {
      field: "follow_up",
      gold: JSON.stringify(gold.follow_up),
      prediction: JSON.stringify(prediction?.follow_up ?? null),
    },
  ];
}
