import RunCompare from "@/components/run-compare";

export default function ComparePage() {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">Compare</p>
        <h1 className="text-2xl">Strategy showdown</h1>
        <p className="text-sm text-[var(--dash-ink-soft)]">
          See which prompt strategy wins each field.
        </p>
      </div>
      <RunCompare />
    </section>
  );
}
