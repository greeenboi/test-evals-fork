"use client";

import { useParams } from "next/navigation";

import RunDetail from "@/components/run-detail";

export default function RunDetailPage() {
  const params = useParams<{ id: string }>();
  const runId = params?.id;

  if (!runId) {
    return <p className="text-sm text-muted-foreground">Loading run...</p>;
  }

  return (
    <section className="flex flex-col gap-4">
      <RunDetail runId={runId} />
    </section>
  );
}
