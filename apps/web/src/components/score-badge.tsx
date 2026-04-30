import { cn } from "@test-evals/ui/lib/utils";

const toneForScore = (value: number) => {
  if (value >= 0.85) {
    return "bg-[color-mix(in_oklab,var(--dash-accent-2)_25%,white)] text-[var(--dash-ink)]";
  }
  if (value >= 0.65) {
    return "bg-[color-mix(in_oklab,var(--dash-accent)_25%,white)] text-[var(--dash-ink)]";
  }
  return "bg-[oklch(0.9_0.05_20)] text-[oklch(0.4_0.1_25)]";
};

export function ScoreBadge({ value, className }: { value: number; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-[4.5rem] items-center justify-center rounded-full px-3 py-1 text-xs font-semibold",
        toneForScore(value),
        className,
      )}
    >
      {value.toFixed(3)}
    </span>
  );
}
