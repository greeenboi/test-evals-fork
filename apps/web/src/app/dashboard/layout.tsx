import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { authClient } from "@/lib/auth-client";

const NAV_ITEMS = [
  { href: "/dashboard/runs", label: "Runs" },
  { href: "/dashboard/compare", label: "Compare" },
];

export default async function DashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const session = await authClient.getSession({
    fetchOptions: {
      headers: await headers(),
      throw: true,
    },
  });

  if (!session?.user) {
    redirect("/login");
  }

  return (
    <div className="min-h-svh">
      <div className="grid gap-6 px-4 py-6 md:grid-cols-[300px_1fr]">
        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl border border-[var(--dash-border)] bg-white/80 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">Evaluator</p>
            <p className="mt-2 text-lg">Welcome, {session.user.name}</p>
            <p className="text-xs text-[var(--dash-ink-soft)]">{session.user.email}</p>
          </div>
          <nav className="flex flex-col gap-2">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-[var(--dash-border)] bg-white/70 px-4 py-2 text-sm font-semibold text-[var(--dash-ink)] transition hover:border-[var(--dash-accent)]"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </aside>
        <main className="flex flex-col gap-6">{children}</main>
      </div>
    </div>
  );
}
