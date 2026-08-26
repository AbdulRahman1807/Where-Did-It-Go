import clsx from "clsx";
import type { CaseStatus, RiskLevel } from "@/lib/types";

const STATUS_LABEL: Record<CaseStatus, string> = {
  open: "Not started",
  investigating: "Investigating",
  awaiting_review: "Awaiting review",
  investigating_again: "Investigating again",
  approved: "Approved",
  rejected: "Rejected",
  escalated: "Escalated",
  resolved: "Resolved",
};

const STATUS_TONE: Record<CaseStatus, "cyan" | "amber" | "green" | "red" | "grey"> = {
  open: "grey",
  investigating: "cyan",
  awaiting_review: "amber",
  investigating_again: "cyan",
  approved: "green",
  rejected: "amber",
  escalated: "red",
  resolved: "green",
};

const TONE_CLASSES: Record<string, string> = {
  cyan: "text-cyan border-cyan/40 bg-cyan-dim/40",
  green: "text-green border-green/40 bg-green-dim/40",
  amber: "text-amber border-amber/40 bg-amber-dim/40",
  red: "text-red border-red/40 bg-red-dim/40",
  grey: "text-text-secondary border-border-medium bg-surface-2",
};

export function StatusBadge({ status, className }: { status: CaseStatus; className?: string }) {
  const tone = STATUS_TONE[status] ?? "grey";
  const isLive = status === "investigating" || status === "investigating_again";
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
        TONE_CLASSES[tone],
        className
      )}
    >
      {isLive && <span className="h-1.5 w-1.5 rounded-full bg-current animate-pulse" aria-hidden />}
      {STATUS_LABEL[status] ?? status}
    </span>
  );
}

const RISK_LABEL: Record<RiskLevel, string> = { low: "Low risk", medium: "Medium risk", high: "High risk" };
const RISK_TONE: Record<RiskLevel, string> = {
  low: TONE_CLASSES.green,
  medium: TONE_CLASSES.amber,
  high: TONE_CLASSES.red,
};

export function RiskBadge({ level, className }: { level: RiskLevel; className?: string }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium uppercase tracking-wide",
        RISK_TONE[level],
        className
      )}
    >
      <span
        className={clsx(
          "h-1.5 w-1.5 rounded-full",
          level === "low" && "bg-green",
          level === "medium" && "bg-amber",
          level === "high" && "bg-red"
        )}
        aria-hidden
      />
      {RISK_LABEL[level]}
    </span>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  normal: "Normal",
  edge: "Edge case",
  failure: "Failure",
  high_risk: "High risk",
  evidence: "Evidence",
};

export function CategoryTag({ category }: { category: string | null }) {
  if (!category) return null;
  return (
    <span className="inline-flex items-center rounded border border-border-subtle bg-surface-2 px-2 py-0.5 text-[11px] uppercase tracking-wide text-text-tertiary">
      {CATEGORY_LABEL[category] ?? category}
    </span>
  );
}
