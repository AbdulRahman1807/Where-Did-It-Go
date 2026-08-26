"""Per-call tool execution node.

Root README next-steps item #4: "checkpoint more granularly (e.g. after each
tool call, not just after each node) so a killed process loses less
in-progress work." LangGraph's prebuilt `ToolNode` executes every tool call
requested in one AI turn as a single graph step -- if the process crashes
mid-batch (the investigator often requests 2-3 calls in one turn), the only
checkpoint that survives is the one *before* that whole batch, and every call
in it is redone on resume, even ones that had already completed.

This node executes exactly one pending tool call per graph step instead, so a
LangGraph checkpoint lands after every individual call, not just after the
whole batch. `route_after_tool` loops back here while calls from the current
AI turn remain, then hands control back to `investigate` once they're all
answered -- functionally identical to `ToolNode` from the model's point of
view (it still sees one `ToolMessage` per call, in the order requested), just
checkpointed more finely. Since every tool here is a pure, idempotent lookup
against the synthetic world/RAG index (app/tools/), redoing one on resume is
harmless -- this is about doing less of that harmless-but-wasted work, not a
correctness fix.
"""

from __future__ import annotations

import json

from langchain_core.messages import AIMessage, ToolMessage

from app.state import InvestigationState
from app.tools import ALL_TOOLS

_TOOLS_BY_NAME = {t.name: t for t in ALL_TOOLS}


def _last_ai_message(messages: list) -> AIMessage:
    return next(m for m in reversed(messages) if isinstance(m, AIMessage))


def _answered_count_since(messages: list, last_ai: AIMessage) -> int:
    """How many ToolMessages already answer calls from `last_ai` -- i.e. how
    far through `last_ai.tool_calls` this AI turn's execution has gotten."""
    count = 0
    for m in reversed(messages):
        if m is last_ai:
            break
        if isinstance(m, ToolMessage):
            count += 1
    return count


def execute_one_tool(state: InvestigationState) -> dict:
    messages = state["messages"]
    last_ai = _last_ai_message(messages)
    call = last_ai.tool_calls[_answered_count_since(messages, last_ai)]

    tool = _TOOLS_BY_NAME.get(call["name"])
    try:
        result = (
            tool.invoke(call["args"])
            if tool is not None
            else {"found": False, "message": f"Unknown tool {call['name']}."}
        )
    except Exception as exc:  # a lookup failing shouldn't crash the whole graph run
        result = {"found": False, "message": f"Tool {call['name']} failed: {exc}"}

    tool_message = ToolMessage(
        content=json.dumps(result, default=str),
        name=call["name"],
        tool_call_id=call["id"],
    )
    return {"messages": [tool_message]}


def route_after_tool(state: InvestigationState) -> str:
    messages = state["messages"]
    last_ai = _last_ai_message(messages)
    if _answered_count_since(messages, last_ai) < len(last_ai.tool_calls):
        return "tools"
    return "investigate"
