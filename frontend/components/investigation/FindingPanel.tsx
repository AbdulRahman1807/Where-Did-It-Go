import { Panel } from "@/components/ui/Panel";
import { EvidenceCard } from "./EvidenceCard";
import type { CaseSnapshot } from "@/lib/types";

export function FindingPanel({ caseData, streaming }: { caseData: CaseSnapshot; streaming: boolean }) {
  const { finding, recommendation, evidence, unresolved_questions } = caseData;
  // The item-trace evidence item is computed from the records and has its own
  // panel; this banner is for conflicts between the other evidence items.
  const conflicts = evidence.filter((e) => e.stance === "conflicts" && !e.source_name.startsWith("Item trace"));

  if (!finding && !streaming) {
    return (
      <Panel eyebrow="Current finding" title="No finding yet">
        <div className="px-5 py-8 text-sm text-text-tertiary">
          The investigation hasn&apos;t produced a finding yet. Start the investigation to gather evidence.
        </div>
      </Panel>
    );
  }

  return (
    <Panel eyebrow="Current finding" title={finding ? finding.likely_cause : "Investigating…"}>
      <div className="space-y-5 px-5 py-5">
        {finding && (
          <p className="text-sm leading-relaxed text-text-secondary">
            <span className="mr-1.5 text-[11px] uppercase tracking-wide text-text-tertiary">
              Inference —
            </span>
            {finding.explanation}
          </p>
        )}

        {conflicts.length > 0 && (
          <div className="rounded-md border border-red/30 bg-red-dim/30 px-4 py-3 text-sm text-red">
            <div className="font-medium">Evidence conflict detected</div>
            <p className="mt-1 text-red/90">
              {conflicts.length === 1
                ? `${conflicts[0].source_name} conflicts with other evidence.`
                : `${conflicts.map((c) => c.source_name).join(" and ")} disagree with each other.`}{" "}
              Additional verification is recommended before acting.
            </p>
          </div>
        )}

        {evidence.length > 0 && (
          <div>
            <div className="mb-2 text-[11px] font-medium uppercase tracking-widest text-text-tertiary">
              Evidence ({evidence.length})
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
              {evidence.map((item) => (
                <EvidenceCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {unresolved_questions.length > 0 && (
          <div className="rounded-md border border-amber/30 bg-amber-dim/30 px-4 py-3 text-sm text-amber">
            <div className="font-medium">Unresolved</div>
            <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber/90">
              {unresolved_questions.map((q, i) => (
                <li key={i}>{q}</li>
              ))}
            </ul>
          </div>
        )}

        {recommendation && (
          <div className="rounded-md border border-cyan/25 bg-cyan-dim/25 px-4 py-4">
            <div className="text-[11px] font-medium uppercase tracking-widest text-cyan">Recommendation</div>
            <div className="mt-1.5 font-display text-base font-medium text-text-primary">
              {recommendation.action}
            </div>
            <p className="mt-1.5 text-sm text-text-secondary">{recommendation.rationale}</p>
          </div>
        )}
      </div>
    </Panel>
  );
}
