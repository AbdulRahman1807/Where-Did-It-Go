"""Synthesize: turn the raw tool-calling transcript into a structured case
file (evidence, hypotheses, finding, recommendation).

Uses the capable model with structured output. Runs once per round, after
the investigate/tools loop has finished gathering evidence for that round.
Reads the *entire* message transcript accumulated so far (across all rounds),
so a later round's synthesis has full context, and regenerates the complete
current case file rather than trying to patch a prior one.
"""

from __future__ import annotations

from pydantic import BaseModel, Field
from typing import Literal

from app.models.llm import get_capable_model, invoke_with_retry
from app.nodes.common import next_evidence_id, render_transcript
from app.state import InvestigationState

SYNTHESIS_SYSTEM_PROMPT = """You turn a fulfillment-exception investigation \
transcript into a structured case file.

Rules:
- Every evidence item must be traceable to something the transcript actually \
returned from a tool. Never invent evidence.
- Distinguish operational evidence (from order/task/inventory/location/event \
lookups) from procedural evidence (from search_procedures results).
- Mark each evidence item's stance toward the emerging finding: "supports", \
"conflicts", or "neutral". If two evidence items disagree with each other \
(e.g. inventory says one location, scan history says another), that is a \
conflict and must be marked as such -- do not quietly pick one as correct.
- The finding is your inference about the likely cause. It is not a fact \
directly observed in the systems -- word it as an inference.
- The recommendation is the action you believe should be taken. It must be \
grounded in the evidence and, where applicable, in retrieved procedure. \
Reference which evidence supports it via evidence_refs (the index list) -- \
do NOT cite evidence numbers or IDs by name inside the explanation/rationale \
prose itself. Free-text ID references are easy to get wrong and aren't \
needed; evidence_refs is the only place that grounding has to be exact.
- If the transcript does not contain enough evidence to support a confident \
finding, say so plainly in the finding/explanation rather than guessing. \
Do not name a specific unconfirmed cause (e.g. "likely a receiving error") \
when the real situation is that no record exists at all -- absence of a \
record is not evidence of *why* it's absent. List what's missing in \
unresolved_questions instead of guessing at a mechanism. Specifically: if \
the lookup tools for inventory AND location history both came back empty \
for the SKU in question, with nothing else in the transcript that speaks to \
why, likely_cause must be a direct statement that the cause cannot be \
established from the available evidence -- not a rephrasing of "no record \
exists" as if that itself explains what happened (e.g. "the item was never \
recorded" or "this indicates a receiving gap" are conclusions about a cause, \
not neutral restatements of an empty lookup, even when they sound modest). \
Put what's missing and what would need to be checked physically in \
unresolved_questions instead.
- A single failed pick attempt, by itself, is not a conflict. Only mark \
evidence as conflicting when two distinct evidence sources actually \
disagree with each other (e.g. the inventory record names one location and \
the most recent scan/move event names a different one). An associate or \
robot simply not finding an item is not, on its own, evidence that two \
records disagree.
- If retrieved procedure states that an action requires supervisor sign-off, \
authorization, or is outside your authority (e.g. restricted/high-value \
items), the recommendation must say so explicitly -- state that the action \
requires human/supervisor approval, rather than jumping straight to a \
specific corrective task as if you were authorized to direct it.
- Keep "what operationally caused this" and "why a human needs to decide" \
separate -- they often have different sources. likely_cause/explanation \
should describe the operational situation the evidence actually shows (e.g. \
"only 2 units were on hand because 2 were reserved for another order"). Do \
NOT phrase the cause as "the system failed to get required human \
confirmation" or similar process-violation language just because a \
procedure requires review here -- that's a statement about *why review is \
needed*, not about what happened operationally, and the evidence for "a \
required step was skipped" usually isn't there even when the evidence for \
the operational situation is solid. The procedural requirement belongs in \
the recommendation/rationale, not recast as the finding's cause.
- When the operational records genuinely agree with each other (e.g. \
inventory and the most recent scan/count both show zero units, with no \
conflicting event), that is a plain, confirmed stockout -- do not invent an \
explanatory narrative for *why* the records ended up that way (e.g. "stale \
inventory data", "task assignment used outdated data") unless a specific \
event in the transcript actually shows a timing mismatch. Adding an \
unevidenced explanation on top of a clean, agreeing record set is exactly \
as much of a fabrication as adding one on top of missing evidence -- it \
just sounds more plausible because the underlying facts are real. Naming a \
cause is only warranted when the transcript contains something that \
actually points to that cause.
"""


class SynthesisEvidence(BaseModel):
    source_type: Literal["operational", "procedural"]
    source_name: str = Field(description="e.g. 'Pick Task PX-1042' or 'SOP-03'")
    summary: str = Field(description="One or two sentence human-readable summary")
    stance: Literal["supports", "conflicts", "neutral"]


class SynthesisFinding(BaseModel):
    likely_cause: str = Field(description="Short phrase naming the likely cause")
    explanation: str = Field(description="A few sentences explaining the inference")
    evidence_refs: list[int] = Field(description="0-based indices into the evidence list")


class SynthesisRecommendation(BaseModel):
    action: str = Field(description="The recommended next action, stated plainly")
    rationale: str
    evidence_refs: list[int] = Field(description="0-based indices into the evidence list")


class SynthesisHypothesis(BaseModel):
    statement: str
    supported: bool
    evidence_refs: list[int] = Field(default_factory=list)


class SynthesisOutput(BaseModel):
    evidence: list[SynthesisEvidence]
    hypotheses: list[SynthesisHypothesis]
    finding: SynthesisFinding
    recommendation: SynthesisRecommendation
    unresolved_questions: list[str] = Field(default_factory=list)


_STRUCTURED_MODEL = get_capable_model(temperature=0.1).with_structured_output(SynthesisOutput)


def _resolve_refs(refs: list[int], evidence_ids: list[str]) -> list[str]:
    return [evidence_ids[i] for i in refs if 0 <= i < len(evidence_ids)]


def synthesize_node(state: InvestigationState) -> dict:
    transcript = render_transcript(state["messages"])
    feedback_lines = "\n".join(
        f"Round {f['round']} - {f['decision']}: {f['feedback_text']}"
        for f in state["human_feedback_history"]
    )

    prompt = (
        f"Incident {state['incident_id']}: {state['incident_summary']}\n"
        f"Pick task: {state['task_id']} | Order: {state['order_id']}\n"
        f"Investigation round: {state['round']}\n\n"
        + (f"Prior human feedback:\n{feedback_lines}\n\n" if feedback_lines else "")
        + f"Full investigation transcript:\n{transcript}\n\n"
        "Produce the current, complete case file from this transcript."
    )

    result: SynthesisOutput = invoke_with_retry(
        _STRUCTURED_MODEL,
        [{"role": "system", "content": SYNTHESIS_SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
    )

    evidence_ids = [next_evidence_id([None] * i) for i in range(len(result.evidence))]
    evidence: list[dict] = [
        {
            "id": eid,
            "source_type": item.source_type,
            "source_name": item.source_name,
            "summary": item.summary,
            "detail": item.summary,
            "stance": item.stance,
            "round": state["round"],
        }
        for eid, item in zip(evidence_ids, result.evidence)
    ]

    hypotheses = [
        {
            "statement": h.statement,
            "supported": h.supported,
            "supporting_evidence_ids": _resolve_refs(h.evidence_refs, evidence_ids),
            "round": state["round"],
        }
        for h in result.hypotheses
    ]

    finding = {
        "likely_cause": result.finding.likely_cause,
        "explanation": result.finding.explanation,
        "evidence_ids": _resolve_refs(result.finding.evidence_refs, evidence_ids),
    }
    recommendation = {
        "action": result.recommendation.action,
        "rationale": result.recommendation.rationale,
        "evidence_ids": _resolve_refs(result.recommendation.evidence_refs, evidence_ids),
    }

    return {
        "evidence": evidence,
        "hypotheses": hypotheses,
        "finding": finding,
        "recommendation": recommendation,
        "unresolved_questions": result.unresolved_questions,
        "activity_log": ["Comparing evidence and forming a finding."],
    }
