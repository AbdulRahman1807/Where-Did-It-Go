"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { RiskBadge } from "@/components/ui/Badge";
import { EvidenceCard } from "./EvidenceCard";
import type { ReviewSubmission } from "@/lib/api";
import type { StreamReviewRequiredEvent } from "@/lib/types";

type Decision = ReviewSubmission["decision"];

export function ReviewPanel({
  payload,
  streaming,
  onDecide,
}: {
  payload: StreamReviewRequiredEvent["payload"];
  streaming: boolean;
  onDecide: (submission: ReviewSubmission) => void;
}) {
  const [feedback, setFeedback] = useState("");
  const [pending, setPending] = useState<Decision | null>(null);

  const submit = (decision: Decision) => {
    setPending(decision);
    onDecide({
      decision,
      feedback_text: feedback,
      modified_recommendation: decision === "modify" ? feedback : undefined,
    });
  };

  return (
    <div className="overflow-hidden rounded-lg border-2 border-amber bg-surface">
      <div className="border-b border-amber/30 bg-amber-dim/30 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <div className="font-display text-lg font-medium text-amber">Human review required</div>
          <RiskBadge level={payload.risk_level} />
        </div>
        <div className="mt-2 text-sm text-amber/90">
          <span className="font-medium">Why are you seeing this? </span>
          {payload.review_reasons.join(" ")}
        </div>
      </div>

      <div className="space-y-5 px-6 py-5">
        <div>
          <div className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">Finding</div>
          <div className="mt-1 font-display text-base font-medium text-text-primary">
            {payload.finding.likely_cause}
          </div>
          <p className="mt-1 text-sm text-text-secondary">{payload.finding.explanation}</p>
        </div>

        {payload.evidence.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Evidence
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {payload.evidence.map((item) => (
                <EvidenceCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        <div className="rounded-md border border-cyan/25 bg-cyan-dim/25 px-4 py-4">
          <div className="text-[11px] font-medium uppercase tracking-widest text-cyan">Recommendation</div>
          <div className="mt-1.5 font-display text-base font-medium text-text-primary">
            {payload.recommendation.action}
          </div>
          <p className="mt-1.5 text-sm text-text-secondary">{payload.recommendation.rationale}</p>
        </div>

        <div>
          <label htmlFor="review-feedback" className="text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
            Feedback (used to guide the agent if you reject, ask for more investigation, or modify)
          </label>
          <textarea
            id="review-feedback"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="e.g. Check whether the item was moved recently."
            rows={3}
            disabled={streaming}
            className="focus-ring mt-2 w-full resize-none rounded-md border border-border-medium bg-surface-2 px-3 py-2.5 text-sm text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <Button variant="primary" disabled={streaming} onClick={() => submit("approve")}>
            {pending === "approve" && streaming ? "Approving…" : "Approve"}
          </Button>
          <Button variant="secondary" disabled={streaming} onClick={() => submit("investigate_more")}>
            {pending === "investigate_more" && streaming ? "Sending…" : "Investigate more"}
          </Button>
          <Button variant="secondary" disabled={streaming || !feedback.trim()} onClick={() => submit("modify")}>
            Modify
          </Button>
          <Button variant="secondary" disabled={streaming} onClick={() => submit("reject")}>
            {pending === "reject" && streaming ? "Rejecting…" : "Reject"}
          </Button>
          <Button variant="danger" disabled={streaming} onClick={() => submit("escalate")}>
            {pending === "escalate" && streaming ? "Escalating…" : "Escalate"}
          </Button>
        </div>
        <p className="text-xs text-text-tertiary">
          Modify requires feedback text -- it becomes the revised recommendation.
        </p>
      </div>
    </div>
  );
}
