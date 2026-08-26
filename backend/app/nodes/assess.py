"""Assess: decide risk level and whether human review is required.

Two layers, deliberately kept separate:

1. Deterministic rule checks -- for conditions that don't require judgment:
   conflicting evidence, a restricted/high-value SKU, an expedited-order
   short pick, or a total absence of inventory/location records for the SKU.
   These are checked in plain code, against the actual tool data, because
   they're unambiguous, auditable, and shouldn't depend on a model call (or on
   how confidently a model happens to word its finding) to get right.

2. A fast-model classification -- for the one genuinely judgment-based
   question these rules can't answer: does the gathered evidence actually
   support the recommendation with reasonable confidence? That's a real
   sufficiency judgment, not a lookup, which is why it gets a model call
   (the fast model, since it's a bounded classification task, not multi-step
   reasoning).

This hybrid is the direct answer to "why does risk/review logic use an LLM
at all" -- most of it doesn't; only the soft judgment does.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

from app.data.world import WORLD
from app.models.llm import get_fast_model, invoke_with_retry
from app.state import InvestigationState

_RISK_ORDER = {"low": 0, "medium": 1, "high": 2}


class AssessmentOutput(BaseModel):
    risk_level: Literal["low", "medium", "high"] = Field(
        description="Operational risk/consequence of acting on this recommendation"
    )
    evidence_sufficient: bool = Field(
        description="Whether the gathered evidence reasonably supports the finding and recommendation"
    )
    sufficiency_reason: str = Field(description="One sentence explaining the sufficiency judgment")


_STRUCTURED_MODEL = get_fast_model(temperature=0.0).with_structured_output(AssessmentOutput)

ASSESS_SYSTEM_PROMPT = """You judge whether a fulfillment-investigation \
finding is adequately supported by its evidence, and how operationally risky \
the recommendation is. Be conservative: prefer "insufficient" and higher risk \
when unsure. Do not be swayed by confident-sounding wording -- judge the \
evidence itself."""


def _deterministic_checks(state: InvestigationState) -> tuple[list[str], str | None]:
    """Returns (reasons, forced_risk_level_or_None)."""
    reasons: list[str] = []
    forced_risk: str | None = None

    if any(e["stance"] == "conflicts" for e in state["evidence"]):
        reasons.append(
            "Operational records conflict with each other; a confident autonomous "
            "recommendation is not safely supported until the conflict is resolved."
        )
        forced_risk = "medium"

    task = WORLD.get_pick_task(state["task_id"])
    sku = task["sku"] if task else None
    inventory = WORLD.get_inventory(sku) if sku else []
    if any(r.get("restricted") for r in inventory):
        reasons.append(
            "This SKU is flagged high-value/restricted. Procedure requires supervisor "
            "sign-off before any corrective action, regardless of evidence clarity."
        )
        forced_risk = "high"

    order = WORLD.get_order(state["order_id"])
    if (
        order
        and order.get("priority") == "expedited"
        and task
        and any(a.get("reason_code") == "SHORT_PICK" for a in task.get("attempts", []))
    ):
        reasons.append(
            "Short pick on an expedited order requires human confirmation before "
            "partial fulfillment, per procedure."
        )
        if forced_risk is None or _RISK_ORDER["medium"] > _RISK_ORDER[forced_risk]:
            forced_risk = "medium"

    # No inventory record AND no location history at all for the SKU: there is
    # nothing left to ground a finding in, no matter how confidently the model
    # words it. Checked against the actual tool data directly, independent of
    # the model's own self-reported "evidence_sufficient" judgment, because
    # that judgment has been observed to vary with wording even when the
    # underlying evidence hasn't changed.
    if sku and not inventory and not WORLD.get_location_events(sku):
        reasons.append(
            "No inventory record and no location history exist for this SKU -- there "
            "is no operational evidence to ground a confident finding in."
        )
        if forced_risk is None or _RISK_ORDER["medium"] > _RISK_ORDER[forced_risk]:
            forced_risk = "medium"

    return reasons, forced_risk


def assess_node(state: InvestigationState) -> dict:
    reasons, forced_risk = _deterministic_checks(state)

    evidence_summary = "\n".join(
        f"- [{e['source_type']}/{e['stance']}] {e['source_name']}: {e['summary']}" for e in state["evidence"]
    )
    prompt = (
        f"Finding: {state['finding']['likely_cause']} — {state['finding']['explanation']}\n\n"
        f"Recommendation: {state['recommendation']['action']} — {state['recommendation']['rationale']}\n\n"
        f"Evidence:\n{evidence_summary or '(none gathered)'}\n\n"
        f"Unresolved questions: {', '.join(state['unresolved_questions']) or 'none'}"
    )
    result: AssessmentOutput = invoke_with_retry(
        _STRUCTURED_MODEL,
        [{"role": "system", "content": ASSESS_SYSTEM_PROMPT}, {"role": "user", "content": prompt}],
    )

    risk_level = result.risk_level
    if forced_risk and _RISK_ORDER[forced_risk] > _RISK_ORDER[risk_level]:
        risk_level = forced_risk

    if not result.evidence_sufficient:
        reasons.append(result.sufficiency_reason)

    review_required = bool(reasons) or risk_level in ("medium", "high")

    update: dict = {
        "risk_level": risk_level,
        "review": {"required": review_required, "reasons": reasons},
        "activity_log": ["Assessing risk and review requirements."],
    }
    if review_required:
        # Set explicitly *before* human_review pauses on interrupt(), since a
        # paused node's own return value isn't applied to state until it
        # resumes -- without this, a snapshot read while paused would still
        # show the previous status.
        update["status"] = "awaiting_review"
    return update
