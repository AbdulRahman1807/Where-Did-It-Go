"""Guaranteed procedure lookup.

The investigator's prompt says to call `search_procedures` at least once, but
that is only a prompt rule: in live runs the model sometimes stops without
ever searching, so the case file contains no procedural evidence even when a
procedure (e.g. SOP-06 sign-off) changes what the right response is. This
node makes the rule structural. When the investigator is done and no
procedure search has happened in this investigation, it runs the retrieval
itself -- no model call -- with queries derived from what the deterministic
trace and the incident already show, and records the lookup in the message
history exactly like a tool call the model made, so synthesize and any later
round see it as ordinary evidence.

It is skipped whenever the model already searched, and runs at most once per
investigation (a later round's model can still search for more on its own).
"""

from __future__ import annotations

import json

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

from app.data.world import WORLD
from app.nodes.common import describe_tool_call, is_restricted_sku
from app.rag.index import get_index
from app.state import InvestigationState
from app.trace import build_trace

TOOL_NAME = "search_procedures"
MAX_QUERIES = 2
HITS_PER_QUERY = 2

_QUERY_BY_FINDING = {
    "INVENTORY_LOCATION_MISMATCH": "inventory record disagrees with the most recent location scan event, item moved",
    "ATTEMPT_UNEXPLAINED": "repeated pick failure at a location where records say the item is, verify location",
    "NO_HISTORY": "no inventory record and no location history for the item, insufficient evidence escalation",
    "MULTI_LOCATION_STOCK": "inventory discrepancy item recorded at several locations",
}
_RESTRICTED_QUERY = "restricted high-value item authority supervisor sign-off before corrective action"
_SHORT_PICK_QUERY = "short pick partial fulfillment confirmation expedited order"
_DEFAULT_QUERY = "pick exception investigation procedure item not found"


def has_searched_procedures(messages: list[BaseMessage]) -> bool:
    return any(isinstance(m, ToolMessage) and m.name == TOOL_NAME for m in messages)


def procedure_queries(state: InvestigationState) -> list[str]:
    trace = build_trace(WORLD, state["task_id"])
    task = WORLD.get_pick_task(state["task_id"]) or {}
    queries: list[str] = []

    # Authority and short-pick rules change what the agent may recommend, so
    # they come first; trace findings describe what went wrong.
    if is_restricted_sku(state):
        queries.append(_RESTRICTED_QUERY)
    if any(a.get("reason_code") == "SHORT_PICK" for a in task.get("attempts", [])):
        queries.append(_SHORT_PICK_QUERY)
    for finding in (trace or {}).get("findings", []):
        query = _QUERY_BY_FINDING.get(finding["code"])
        if query and query not in queries:
            queries.append(query)

    return (queries or [_DEFAULT_QUERY])[:MAX_QUERIES]


def force_procedure_search(state: InvestigationState) -> dict:
    queries = procedure_queries(state)
    index = get_index()

    calls = [
        {"name": TOOL_NAME, "args": {"query": q}, "id": f"forced-procedure-{i}", "type": "tool_call"}
        for i, q in enumerate(queries)
    ]
    messages: list[BaseMessage] = [
        AIMessage(content="Checking the applicable operating procedures.", tool_calls=calls)
    ]
    seen_chunks: set[str] = set()
    for call in calls:
        hits = [
            h
            for h in index.search(call["args"]["query"], k=HITS_PER_QUERY)
            if h["chunk_id"] not in seen_chunks
        ]
        seen_chunks.update(h["chunk_id"] for h in hits)
        result = (
            {"found": True, "results": hits}
            if hits
            else {"found": False, "message": "No relevant procedure found for that query."}
        )
        messages.append(
            ToolMessage(content=json.dumps(result, default=str), name=TOOL_NAME, tool_call_id=call["id"])
        )

    return {
        "messages": messages,
        "activity_log": [describe_tool_call(TOOL_NAME, call["args"]) for call in calls],
    }
