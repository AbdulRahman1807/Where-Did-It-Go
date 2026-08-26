import clsx from "clsx";
import { Panel } from "@/components/ui/Panel";
import { RiskBadge } from "@/components/ui/Badge";
import type { CaseSnapshot } from "@/lib/types";

export function OutcomePanel({ caseData }: { caseData: CaseSnapshot }) {
  const outcome = caseData.outcome;
  if (!outcome) return null;
  const resolved = outcome.outcome_type === "resolved";

  return (
    <Panel
      className={clsx("border-2", resolved ? "border-green" : "border-red")}
      eyebrow={resolved ? "Outcome — Resolved" : "Outcome — Escalated"}
      title={
        typeof outcome.finding === "object" && outcome.finding && "likely_cause" in outcome.finding
          ? outcome.finding.likely_cause
          : "Outcome recorded"
      }
      action={<RiskBadge level={outcome.risk_level} />}
    >
      <div className="space-y-4 px-5 py-5">
        {outcome.recommendation && "action" in outcome.recommendation && (
          <div>
            <div className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              {resolved ? "Action taken" : "Recommended action"}
            </div>
            <div className="mt-1 text-sm text-text-primary">{outcome.recommendation.action}</div>
          </div>
        )}

        {!resolved && outcome.reasons && outcome.reasons.length > 0 && (
          <div className="rounded-md border border-red/30 bg-red-dim/30 px-4 py-3 text-sm text-red">
            <div className="font-medium">Why this was escalated</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-red/90">
              {outcome.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}

        {caseData.human_feedback_history.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Review history
            </div>
            <ol className="space-y-2">
              {caseData.human_feedback_history.map((f, i) => (
                <li key={i} className="rounded-md border border-border-subtle bg-surface-2 px-3 py-2 text-sm">
                  <span className="text-text-tertiary">Round {f.round} —</span>{" "}
                  <span className="capitalize text-text-primary">{f.decision.replace("_", " ")}</span>
                  {f.feedback_text && <span className="text-text-secondary"> — &quot;{f.feedback_text}&quot;</span>}
                </li>
              ))}
            </ol>
          </div>
        )}

        <div className="text-xs text-text-tertiary">
          Decided {new Date(outcome.decided_at).toLocaleString()}
          {outcome.rounds ? ` · ${outcome.rounds} investigation round${outcome.rounds > 1 ? "s" : ""}` : ""}
        </div>
      </div>
    </Panel>
  );
}
