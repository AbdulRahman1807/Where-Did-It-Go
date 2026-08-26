"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { listCases } from "@/lib/api";
import type { CaseSnapshot } from "@/lib/types";
import { CaseCard } from "@/components/dashboard/CaseCard";
import { TopBar } from "@/components/layout/TopBar";

function StatTile({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-5 py-4">
      <div className={`font-display text-3xl font-medium ${tone ?? "text-text-primary"}`}>{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-text-tertiary">{label}</div>
    </div>
  );
}

export default function DashboardPage() {
  const [cases, setCases] = useState<CaseSnapshot[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const NETWORK_ERROR =
    "Could not reach the investigation service. Confirm the backend is running at the configured API address.";

  const load = () => {
    setError(null);
    listCases().then(setCases).catch(() => setError(NETWORK_ERROR));
  };

  useEffect(() => {
    // error already starts null (see useState above), so the initial fetch
    // doesn't need to reset it the way the manual "Refresh" button does.
    listCases().then(setCases).catch(() => setError(NETWORK_ERROR));
  }, []);

  const awaitingReview = cases?.filter((c) => c.status === "awaiting_review") ?? [];
  const active = cases?.filter((c) => c.started && !["awaiting_review", "resolved", "escalated"].includes(c.status)) ?? [];
  const open = cases?.filter((c) => !c.started) ?? [];
  const closed = cases?.filter((c) => c.status === "resolved" || c.status === "escalated") ?? [];

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-10">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="font-display text-3xl font-medium tracking-tight">Investigations</h1>
            <p className="mt-1 text-sm text-text-secondary">
              Open pick-exception incidents and their current investigation status.
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <button
              onClick={load}
              className="focus-ring rounded-md border border-border-subtle px-3 py-2 text-xs uppercase tracking-wide text-text-secondary hover:text-text-primary"
            >
              Refresh
            </button>
            <Link
              href="/investigations/new"
              className="focus-ring rounded-md border border-cyan bg-cyan px-3 py-2 text-xs font-medium uppercase tracking-wide text-void hover:bg-text-primary hover:border-text-primary"
            >
              File exception
            </Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red/30 bg-red-dim/30 px-4 py-3 text-sm text-red">
            <span>{error}</span>
            <button
              onClick={load}
              className="focus-ring rounded-md border border-red/30 px-3 py-1.5 text-xs uppercase tracking-wide text-red hover:bg-red/10"
            >
              Retry
            </button>
          </div>
        )}

        {cases && (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile label="Awaiting review" value={awaitingReview.length} tone="text-amber" />
            <StatTile label="In progress" value={active.length} tone="text-cyan" />
            <StatTile label="Not started" value={open.length} />
            <StatTile label="Closed" value={closed.length} tone="text-green" />
          </div>
        )}

        {!cases && !error && <div className="mt-10 text-sm text-text-tertiary">Loading incidents…</div>}

        {cases && cases.length === 0 && (
          <div className="mt-10 rounded-lg border border-border-subtle bg-surface px-6 py-10 text-center text-sm text-text-tertiary">
            No incidents on record. New pick exceptions will appear here as they&apos;re reported.
          </div>
        )}

        {cases && cases.length > 0 && (
          <div className="mt-10 space-y-10">
            {awaitingReview.length > 0 && (
              <Section title="Awaiting review" cases={awaitingReview} />
            )}
            {active.length > 0 && <Section title="In progress" cases={active} />}
            {open.length > 0 && <Section title="Not started" cases={open} />}
            {closed.length > 0 && <Section title="Recently closed" cases={closed} />}
          </div>
        )}
      </main>
      <footer className="border-t border-border-subtle px-6 py-6 text-center text-xs text-text-tertiary">
        <Link href="/" className="focus-ring hover:text-text-secondary">
          Where Did It Go?
        </Link>{" "}
        — synthetic operational data, for demonstration only.
      </footer>
    </div>
  );
}

function Section({ title, cases }: { title: string; cases: CaseSnapshot[] }) {
  return (
    <section>
      <h2 className="mb-3 text-xs font-medium uppercase tracking-widest text-text-tertiary">{title}</h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {cases.map((c) => (
          <CaseCard key={c.incident_id} c={c} />
        ))}
      </div>
    </section>
  );
}
