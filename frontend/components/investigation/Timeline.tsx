import clsx from "clsx";
import { Panel } from "@/components/ui/Panel";
import type { CaseSnapshot } from "@/lib/types";

type StepState = "done" | "active" | "pending" | "skipped" | "attention";

interface Step {
  label: string;
  state: StepState;
}

function deriveSteps(c: CaseSnapshot, streaming: boolean): Step[] {
  const hasEvidence = c.evidence.length > 0;
  const hasFinding = !!c.finding;
  const hasRecommendation = !!c.recommendation;
  const reviewHappened = c.human_feedback_history.length > 0;
  const isTerminal = c.status === "resolved" || c.status === "escalated";

  const steps: Step[] = [
    { label: "Incident received", state: c.started ? "done" : "pending" },
    {
      label: "Gathering evidence",
      state: hasEvidence ? "done" : c.started && streaming ? "active" : "pending",
    },
    {
      label: "Finding formed",
      state: hasFinding ? "done" : hasEvidence && streaming ? "active" : "pending",
    },
    {
      label: "Recommendation ready",
      state: hasRecommendation ? "done" : hasFinding && streaming ? "active" : "pending",
    },
  ];

  if (c.status === "awaiting_review") {
    steps.push({ label: "Human review", state: "attention" });
  } else if (reviewHappened) {
    steps.push({ label: "Human review", state: "done" });
  } else if (c.review.required || isTerminal) {
    steps.push({ label: "Human review", state: isTerminal ? "skipped" : "pending" });
  }

  if (isTerminal) {
    steps.push({
      label: c.status === "resolved" ? "Resolved" : "Escalated",
      state: "done",
    });
  } else if (c.started) {
    steps.push({ label: "Outcome", state: "pending" });
  }

  return steps;
}

const DOT_CLASSES: Record<StepState, string> = {
  done: "bg-green border-green",
  active: "bg-cyan border-cyan animate-pulse",
  attention: "bg-amber border-amber animate-pulse",
  pending: "bg-transparent border-border-medium",
  skipped: "bg-transparent border-border-subtle",
};

const LABEL_CLASSES: Record<StepState, string> = {
  done: "text-text-primary",
  active: "text-cyan",
  attention: "text-amber font-medium",
  pending: "text-text-tertiary",
  skipped: "text-text-tertiary line-through decoration-border-medium",
};

export function Timeline({ caseData, streaming }: { caseData: CaseSnapshot; streaming: boolean }) {
  const steps = deriveSteps(caseData, streaming);

  return (
    <Panel
      eyebrow={caseData.round ? `Round ${caseData.round}${caseData.max_rounds ? ` of ${caseData.max_rounds}` : ""}` : "Investigation"}
      title="Progress"
    >
      <ol className="px-5 py-5">
        {steps.map((step, i) => (
          <li key={step.label} className="relative flex items-start gap-3 pb-6 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className="absolute left-[5px] top-3 h-full w-px bg-border-subtle"
                aria-hidden
              />
            )}
            <span
              className={clsx("relative z-10 mt-1 h-2.5 w-2.5 shrink-0 rounded-full border-2", DOT_CLASSES[step.state])}
              aria-hidden
            />
            <span className={clsx("text-sm", LABEL_CLASSES[step.state])}>{step.label}</span>
          </li>
        ))}
      </ol>
    </Panel>
  );
}
