"use client";

import { useParams } from "next/navigation";

import CaseDetail from "@/components/case-detail";

export default function CaseDetailPage() {
  const params = useParams<{ id: string; transcriptId: string }>();
  const runId = params?.id;
  const transcriptId = params?.transcriptId;

  if (!runId || !transcriptId) {
    return <p className="text-sm text-muted-foreground">Loading case...</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <CaseDetail runId={runId} transcriptId={transcriptId} />
    </section>
  );
}
