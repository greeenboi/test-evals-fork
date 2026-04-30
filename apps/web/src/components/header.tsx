"use client";
import Link from "next/link";

import { ModeToggle } from "./mode-toggle";
import UserMenu from "./user-menu";

export default function Header() {
  const links = [
    { to: "/", label: "Home" },
    { to: "/dashboard", label: "Dashboard" },
    { to: "/dashboard/runs", label: "Runs" },
    { to: "/dashboard/compare", label: "Compare" },
  ] as const;

  return (
    <div className="border-b border-[var(--dash-border)] bg-white/70 backdrop-blur">
      <div className="flex flex-row items-center justify-between px-4 py-3">
        <nav className="flex gap-4 text-sm font-medium uppercase tracking-[0.2em] text-[var(--dash-ink-soft)]">
          {links.map(({ to, label }) => {
            return (
              <Link key={to} href={to} className="transition hover:text-[var(--dash-accent)]">
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="flex items-center gap-2">
          <ModeToggle />
          <UserMenu />
        </div>
      </div>
    </div>
  );
}
