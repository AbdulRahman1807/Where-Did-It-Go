"""Finalize and escalate: the two terminal nodes.

Both simply assemble the outcome record the API/UI reads to show "how the
final outcome was reached" (Master Spec section 5, item 9). No new reasoning
happens here -- the finding and recommendation were already produced by
synthesize, and the decision was already made by the human or by the
round-depth safeguard in human_review.
"""

from __future__ import annotations

from datetime import datetime, timezone

from app.state import InvestigationState


def finalize_node(state: InvestigationState) -> dict:
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
    outcome = {
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
    return {
        "status": "escalated",
        "outcome": outcome,
        "activity_log": ["Investigation escalated for further handling."],
    }
