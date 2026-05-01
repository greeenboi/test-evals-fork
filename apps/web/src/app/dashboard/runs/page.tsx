import RunsList from "@/components/runs-list";

export default function RunsPage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-(--dash-ink-soft)">Runs</p>
        <h1 className="text-2xl">Evaluation runs</h1>
        <p className="text-sm text-(--dash-ink-soft)">
          Launch new evaluations and track strategy performance over time.
        </p>
      </div>
      <RunsList />
    </section>
  );
}
