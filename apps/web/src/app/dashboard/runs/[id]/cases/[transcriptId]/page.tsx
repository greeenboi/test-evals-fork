import CaseDetail from "@/components/case-detail";

export default function CaseDetailPage({
  params,
}: {
  params: { id: string; transcriptId: string };
}) {
  return (
    <section className="flex flex-col gap-4">
      <CaseDetail runId={params.id} transcriptId={params.transcriptId} />
    </section>
  );
}
