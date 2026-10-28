"""Investigate: the tool-calling reasoning loop.

Uses the capable model because deciding which evidence source is relevant
next, given what's already been found, is genuine multi-step reasoning --
not a fixed script. Runs in a loop with the `tools` node (see graph.py)
until the model stops requesting tools or the per-round tool-call budget
(app/config.MAX_TOOL_CALLS_PER_ROUND) is reached.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage

from app.config import MAX_TOOL_CALLS_PER_ROUND
from app.models.llm import get_capable_model, invoke_with_retry
from app.nodes.common import describe_tool_call
from app.nodes.procedures import has_searched_procedures
from app.state import InvestigationState
from app.tools import ALL_TOOLS

_MODEL_WITH_TOOLS = get_capable_model().bind_tools(ALL_TOOLS)


def investigate_node(state: InvestigationState) -> dict:
    messages = list(state["messages"])

    # A new round driven by human feedback: add the focus as a fresh turn
    # rather than replaying it into the original opening message. Guarded by
    # tool_calls_this_round == 0 so this only fires on the first investigate
    # call of the round, not on every tool-loop iteration within it.
    if (
        state.get("investigation_focus")
        and state["round"] > 1
        and state["tool_calls_this_round"] == 0
    ):
        messages = messages + [
            HumanMessage(
                content=(
                    f"Investigation round {state['round']}. A human reviewer "
                    f"responded to your previous finding:\n\n"
                    f"\"{state['investigation_focus']}\"\n\n"
                    "Continue the investigation with this in mind. Use tools "
                    "to gather any additional evidence this raises."
                )
            )
        ]

    ai_message: AIMessage = invoke_with_retry(_MODEL_WITH_TOOLS, messages)

    remaining_budget = MAX_TOOL_CALLS_PER_ROUND - state["tool_calls_this_round"]
    tool_calls = list(ai_message.tool_calls or [])
    activity: list[str] = []

    if tool_calls and remaining_budget <= 0:
        # Budget exhausted: don't leave dangling tool calls in the message
        # history, just stop requesting tools this round.
        ai_message.tool_calls = []
        ai_message.content = ai_message.content or (
            "I've reached this round's investigation budget. Moving to synthesis "
            "with the evidence gathered so far."
        )
        tool_calls = []
    elif len(tool_calls) > remaining_budget:
        ai_message.tool_calls = tool_calls[:remaining_budget]
        tool_calls = ai_message.tool_calls

    for call in tool_calls:
        activity.append(describe_tool_call(call["name"], call["args"]))

    return {
        "messages": [*messages[len(state["messages"]) :], ai_message],
        "tool_calls_this_round": state["tool_calls_this_round"] + len(tool_calls),
        "activity_log": activity,
    }


def route_after_investigate(state: InvestigationState) -> str:
    last = state["messages"][-1]
    if isinstance(last, AIMessage) and last.tool_calls:
        return "tools"
    # The investigator is done. Procedure lookup is mandatory, not a prompt
    # suggestion: if it never searched, do it for it (app/nodes/procedures.py).
    if not has_searched_procedures(state["messages"]):
        return "procedures"
    return "synthesize"
