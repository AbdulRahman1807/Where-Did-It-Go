"use client";

import Link from "next/link";
import { useInvestigation } from "@/lib/useInvestigation";
import { StatusBadge, RiskBadge, CategoryTag } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { TopBar } from "@/components/layout/TopBar";
import { Timeline } from "./Timeline";
import { FindingPanel } from "./FindingPanel";
import { ActivityFeed } from "./ActivityFeed";
import { ReviewPanel } from "./ReviewPanel";
import { OutcomePanel } from "./OutcomePanel";
import { AuditTrail } from "./AuditTrail";
import { TracePanel } from "./TracePanel";

export function InvestigationWorkspace({ incidentId }: { incidentId: string }) {
  const { caseData, loading, streaming, activity, reviewPayload, error, start, review } =
    useInvestigation(incidentId);

  // Whether a failed stream can be safely retried by calling start() again.
  // If the case never got going, or is paused for review, or already
  // reached a terminal outcome, "Retry" doesn't apply -- the backend only
  // resumes runs that were interrupted mid-round (see RETRYABLE_STATUSES in
  // backend/app/api/routes.py).
  const isRetryable =
    !!caseData?.started && !["awaiting_review", "resolved", "escalated"].includes(caseData.status);

  // Detected proactively, not just after a failed action: a case can arrive
  // from the initial snapshot already sitting in a retryable status (the
  // previous session's stream was interrupted -- tab closed, network drop,
  // rate limit -- before it reached a review pause or a terminal outcome).
  // Without this, the only way to discover that was to click something and
  // get a reactive error; this surfaces it immediately on load instead.
  const looksInterrupted = isRetryable && !streaming && !error;

  return (
    <div className="flex min-h-screen flex-col">
      <TopBar
        right={
          caseData && (
            <>
              {caseData.risk_level && <RiskBadge level={caseData.risk_level} />}
              <StatusBadge status={caseData.status} />
            </>
          )
        }
      />

      <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-8">
        {loading && <div className="text-sm text-text-tertiary">Loading incident…</div>}

        {!loading && !caseData && (
          <div className="rounded-lg border border-red/30 bg-red-dim/30 px-5 py-4 text-sm text-red">
            No incident found with id {incidentId}.
          </div>
        )}

        {caseData && (
          <>
            <Link
              href="/investigations"
              className="focus-ring mb-4 inline-flex items-center gap-1.5 text-xs uppercase tracking-widest text-text-tertiary hover:text-text-primary"
            >
              <span aria-hidden>←</span> All investigations
            </Link>

            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="font-display text-2xl font-medium tracking-tight text-text-primary">
                  {caseData.incident_id}
                </h1>
                <CategoryTag category={caseData.category} />
              </div>
              <p className="mt-1 text-sm text-text-secondary">{caseData.summary}</p>
              <div className="mt-2 text-xs text-text-tertiary">
                Task {caseData.task_id} · Order {caseData.order_id}
              </div>
            </div>

            {error && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-red/30 bg-red-dim/30 px-4 py-3 text-sm text-red">
                <span>{error}</span>
                {isRetryable && (
                  <Button variant="danger" disabled={streaming} onClick={start}>
                    {streaming ? "Retrying…" : "Retry"}
                  </Button>
                )}
              </div>
            )}

            {!error && looksInterrupted && (
              <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber/30 bg-amber-dim/30 px-4 py-3 text-sm text-amber">
                <span>
                  This investigation was interrupted before reaching a review point or an outcome --
                  likely a dropped connection or a temporary service issue. Nothing gathered so far
                  was lost.
                </span>
                <Button variant="secondary" disabled={streaming} onClick={start}>
                  {streaming ? "Resuming…" : "Resume investigation"}
                </Button>
              </div>
            )}

            {!caseData.started && (
              <div className="space-y-6">
                <TracePanel incidentId={caseData.incident_id} />
                <div className="rounded-lg border border-border-subtle bg-surface px-6 py-10 text-center">
                  <p className="mx-auto max-w-md text-sm text-text-secondary">
                    This incident hasn&apos;t been investigated yet. Starting will gather operational
                    evidence and check applicable procedures before producing a finding.
                  </p>
                  <Button variant="primary" className="mt-5" disabled={streaming} onClick={start}>
                    {streaming ? "Starting investigation…" : "Begin investigation"}
                  </Button>
                </div>
              </div>
            )}

            {caseData.started && (
              <div className="space-y-6">
                {caseData.status === "awaiting_review" && reviewPayload && (
                  <ReviewPanel payload={reviewPayload} streaming={streaming} onDecide={review} />
                )}

                {(caseData.status === "resolved" || caseData.status === "escalated") && (
                  <OutcomePanel caseData={caseData} />
                )}

                <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
                  <div className="lg:sticky lg:top-20 lg:self-start">
                    <Timeline caseData={caseData} streaming={streaming} />
                  </div>
                  <div className="space-y-6">
                    {caseData.status !== "awaiting_review" && (
                      <FindingPanel caseData={caseData} streaming={streaming} />
                    )}
                    <TracePanel incidentId={caseData.incident_id} />
                    <ActivityFeed history={caseData.activity_log} live={activity} streaming={streaming} />
                    <AuditTrail incidentId={caseData.incident_id} />
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
