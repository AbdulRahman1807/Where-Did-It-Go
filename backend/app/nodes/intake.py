"""Intake: deterministic state initialization.

No model call here on purpose. Which order/task an incident refers to is a
lookup, not a judgment call -- the incident record already names them
explicitly. Reasoning starts in `investigate`, where it's actually needed.
"""

from __future__ import annotations

from langchain_core.messages import HumanMessage, SystemMessage

from app.config import MAX_INVESTIGATION_ROUNDS
from app.state import InvestigationState

INVESTIGATOR_SYSTEM_PROMPT = """You are the investigation component of \
"Where Did It Go?", a fulfillment exception investigator. You investigate \
pick-task exceptions using operational tools and procedural search, then \
hand your findings to a synthesis step.

Ground rules:
- Only rely on information returned by tools. Never invent order, inventory, \
or location data.
- Check whether operational records agree with each other before assuming \
one of them is correct.
- Always call search_procedures at least once before you stop gathering \
evidence, even if the operational records alone seem to explain the \
incident. Procedure can change what the correct response is (e.g. requiring \
human sign-off) in ways the operational records alone never would tell you. \
Don't rely on general intuition about warehouses instead of the actual SOP.
- Be efficient: call only the tools relevant to this incident. Once you've \
gathered the operational evidence and checked applicable procedure, stop \
calling tools.
"""


def intake_node(state: InvestigationState) -> dict:
    opening_message = (
        f"Incident {state['incident_id']}: {state['incident_summary']}\n"
        f"Pick task: {state['task_id']} | Order: {state['order_id']}\n\n"
        "Investigate this pick exception. Gather the operational evidence and "
        "any applicable procedure you need before stopping."
    )
    return {
        "round": 1,
        "max_rounds": MAX_INVESTIGATION_ROUNDS,
        "tool_calls_this_round": 0,
        "status": "investigating",
        "activity_log": [f"Investigation opened for {state['incident_id']}."],
        "messages": [
            SystemMessage(content=INVESTIGATOR_SYSTEM_PROMPT),
            HumanMessage(content=opening_message),
        ],
        "evidence": [],
        "hypotheses": [],
        "unresolved_questions": [],
        "investigation_focus": None,
        "finding": None,
        "recommendation": None,
        "risk_level": "low",
        "review": {"required": False, "reasons": []},
        "human_feedback_history": [],
        "outcome": None,
    }
