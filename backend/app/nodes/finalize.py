"""Finalize and escalate: the two terminal nodes.

Both simply assemble the outcome record the API/UI reads to show "how the
final outcome was reached" (Master Spec section 5, item 9). No new reasoning
happens here -- the finding and recommendation were already produced by
synthesize, and the decision was already made by the human or by the
round-depth safeguard in human_review.

Structural authority guard (root README next-steps item #6): SOP-06's
restricted/high-value-SKU rule is otherwise enforced *procedurally* --
assess.py's deterministic check reads the rule and sets review.required,
and the graph then correctly routes to human_review because of that flag.
That's real, but it's still one flag a future bug (in assess.py, in the
graph wiring, in a new node someone adds later) could get wrong. finalize_node
re-checks the same ground-truth fact independently, right before a case is
allowed to become "resolved", using nothing from `state["review"]` -- so a
restricted SKU cannot reach a resolved outcome without a recorded human
decision on this thread, structurally, regardless of what upstream logic did
or didn't flag. This is the "hard allow-list check that can't be reasoned
around" the next-steps item asks for, scoped to the one authority boundary
that actually needs it (SOP-06), not a general-purpose policy engine.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.nodes.common import is_restricted_sku
from app.state import InvestigationState

_HUMAN_APPROVAL_DECISIONS = {"approve", "modify"}


def _escalation_outcome(state: InvestigationState, reasons: list[str]) -> dict:
    return {
        "outcome_type": "escalated",
        "status": "escalated",
        "finding": state["finding"],
        "recommendation": state["recommendation"],
        "risk_level": state["risk_level"],
        "reasons": reasons,
        "rounds": state["round"],
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "human_feedback_history": state["human_feedback_history"],
    }


def finalize_node(state: InvestigationState) -> dict:
    has_human_approval = any(
        f["decision"] in _HUMAN_APPROVAL_DECISIONS for f in state["human_feedback_history"]
    )
    if is_restricted_sku(state) and not has_human_approval:
        reasons = [
            "Structural authority guard: this SKU is restricted/high-value (SOP-06) and no "
            "human approval or modification is recorded for this investigation. A restricted "
            "SKU cannot be resolved without one, independent of any upstream review flag."
        ]
        return {
            "status": "escalated",
            "outcome": _escalation_outcome(state, reasons),
            "activity_log": [
                "Blocked from resolving: restricted SKU has no recorded human approval. Escalated instead."
            ],
        }

    outcome = {
        "outcome_type": "resolved",
        "status": "resolved",
        "finding": state["finding"],
        "recommendation": state["recommendation"],
        "risk_level": state["risk_level"],
        "rounds": state["round"],
        "decided_at": datetime.now(timezone.utc).isoformat(),
        "human_feedback_history": state["human_feedback_history"],
    }
    return {
        "status": "resolved",
        "outcome": outcome,
        "activity_log": ["Investigation resolved."],
    }


def escalate_node(state: InvestigationState) -> dict:
    reasons = list(state["review"]["reasons"])
    if state["round"] >= state["max_rounds"] and not any("investigation depth" in r for r in reasons):
        reasons.append(
            f"Maximum investigation depth ({state['max_rounds']} rounds) reached without a "
            "sufficiently supported conclusion."
        )
    return {
        "status": "escalated",
        "outcome": _escalation_outcome(state, reasons),
        "activity_log": ["Investigation escalated for further handling."],
    }
