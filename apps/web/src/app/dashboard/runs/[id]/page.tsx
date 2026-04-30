import RunDetail from "@/components/run-detail";

export default function RunDetailPage({ params }: { params: { id: string } }) {
  return (
    <section className="flex flex-col gap-4">
      <RunDetail runId={params.id} />
    </section>
  );
}
