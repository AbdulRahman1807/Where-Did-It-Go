"""Human review: the graph's actual interruption/resumption point.

Calls LangGraph's `interrupt()`, which pauses execution here and returns
control to the caller with the payload below. The graph is checkpointed
(app/persistence/checkpointer.py), so the process can restart, another
request can come in later, and `Command(resume=...)` will resume this exact
node with the human's decision -- not a simulated pause.

This node also enforces the investigation-depth safeguard: if a reject or
investigate_more decision would push the case past max_rounds, it forces an
escalation instead of starting another round, matching Master Spec section 8
("if the system repeatedly fails to establish a sufficiently supported
conclusion, it should explicitly acknowledge the limitation and escalate").
"""

from __future__ import annotations

from datetime import datetime, timezone

from langgraph.types import interrupt

from app.state import InvestigationState

_DECISION_VERBS = {
    "approve": "approved the recommendation",
    "reject": "rejected the recommendation",
    "investigate_more": "requested further investigation",
    "modify": "modified the recommendation",
    "escalate": "escalated the case",
}


def human_review_node(state: InvestigationState) -> dict:
    payload = {
        "incident_id": state["incident_id"],
        "round": state["round"],
        "finding": state["finding"],
        "recommendation": state["recommendation"],
        "evidence": state["evidence"],
        "risk_level": state["risk_level"],
        "review_reasons": state["review"]["reasons"],
        "unresolved_questions": state["unresolved_questions"],
    }
    decision = interrupt(payload)

    action = decision.get("decision", "approve")
    feedback_text = decision.get("feedback_text", "") or ""
    now = datetime.now(timezone.utc).isoformat()

    verb = _DECISION_VERBS.get(action, action)
    activity = [f"Human reviewer {verb}." + (f' "{feedback_text}"' if feedback_text else "")]

    feedback_entry = {
        "round": state["round"],
        "decision": action,
        "feedback_text": feedback_text,
        "timestamp": now,
    }

    at_max_rounds = state["round"] >= state["max_rounds"]

    if action == "approve":
        return {
            "status": "approved",
            "human_feedback_history": [feedback_entry],
            "activity_log": activity,
        }

    if action == "modify":
        modified_action = decision.get("modified_recommendation") or state["recommendation"]["action"]
        recommendation = {
            **state["recommendation"],
            "action": modified_action,
            "rationale": state["recommendation"]["rationale"] + " (modified by reviewer)",
        }
        return {
            "status": "approved",
            "recommendation": recommendation,
            "human_feedback_history": [feedback_entry],
            "activity_log": activity,
        }

    if action == "escalate":
        return {
            "status": "escalated",
            "human_feedback_history": [feedback_entry],
            "activity_log": activity,
        }

    # reject / investigate_more
    if at_max_rounds:
        activity.append(
            f"Maximum investigation depth ({state['max_rounds']} rounds) reached without a "
            "resolved conclusion. Escalating rather than continuing to loop."
        )
        return {
            "status": "escalated",
            "human_feedback_history": [feedback_entry],
            "activity_log": activity,
        }

    return {
        "status": "investigating_again",
        "round": state["round"] + 1,
        "tool_calls_this_round": 0,
        "investigation_focus": feedback_text or "Reconsider the finding.",
        "human_feedback_history": [feedback_entry],
        "activity_log": activity,
    }


def route_after_human_review(state: InvestigationState) -> str:
    if state["status"] == "investigating_again":
        return "investigate"
    if state["status"] == "escalated":
        return "escalate"
    return "finalize"
