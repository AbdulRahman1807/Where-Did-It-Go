import clsx from "clsx";
import type { EvidenceItem } from "@/lib/types";

const STANCE_STYLES: Record<EvidenceItem["stance"], { border: string; label: string; dot: string }> = {
  supports: { border: "border-l-green", label: "Supports finding", dot: "bg-green" },
  conflicts: { border: "border-l-red", label: "Conflicts", dot: "bg-red" },
  neutral: { border: "border-l-border-medium", label: "Context", dot: "bg-grey" },
};

export function EvidenceCard({ item }: { item: EvidenceItem }) {
  const style = STANCE_STYLES[item.stance];
  return (
    <div className={clsx("rounded-md border border-border-subtle border-l-2 bg-surface-2 p-4", style.border)}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded border border-border-subtle px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
            {item.source_type === "procedural" ? "Procedure" : "Operational"}
          </span>
          <span className="font-display text-sm font-medium text-text-primary">{item.source_name}</span>
        </div>
        <span className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-text-tertiary">
          <span className={clsx("h-1.5 w-1.5 rounded-full", style.dot)} aria-hidden />
          {style.label}
        </span>
      </div>
      <p className="mt-2 text-sm leading-relaxed text-text-secondary">{item.summary}</p>
    </div>
  );
}
