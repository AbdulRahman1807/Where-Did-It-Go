import Link from "next/link";
import { CategoryTag, RiskBadge, StatusBadge } from "@/components/ui/Badge";
import type { CaseSnapshot } from "@/lib/types";

export function CaseCard({ c }: { c: CaseSnapshot }) {
  return (
    <Link
      href={`/investigations/${c.incident_id}`}
      className="focus-ring group block rounded-lg border border-border-subtle bg-surface p-5 transition-colors duration-150 hover:border-border-medium hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="font-display text-lg font-medium tracking-tight text-text-primary">
          {c.incident_id}
        </div>
        <StatusBadge status={c.status} />
      </div>

      <div className="mt-1 text-sm text-text-secondary">{c.title}</div>

      <p className="mt-3 line-clamp-2 text-sm text-text-tertiary">{c.summary}</p>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <CategoryTag category={c.category} />
        {c.risk_level && <RiskBadge level={c.risk_level} />}
        {c.round ? (
          <span className="text-xs text-text-tertiary">
            Round {c.round}
            {c.max_rounds ? ` / ${c.max_rounds}` : ""}
          </span>
        ) : null}
      </div>
    </Link>
  );
}
