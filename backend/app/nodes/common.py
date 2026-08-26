"""Small shared helpers used across graph nodes."""

from __future__ import annotations

from typing import TYPE_CHECKING

from langchain_core.messages import AIMessage, BaseMessage, ToolMessage

from app.data.world import WORLD

if TYPE_CHECKING:
    from app.state import InvestigationState

_TOOL_DESCRIPTIONS = {
    "get_order_info": lambda a: f"Checking order {a.get('order_id', '')}",
    "get_pick_task": lambda a: f"Checking pick task history for {a.get('task_id', '')}",
    "get_inventory_record": lambda a: (
        f"Checking inventory records for {a.get('sku', '')}"
        + (f" at {a['location']}" if a.get("location") else "")
    ),
    "get_location_history": lambda a: f"Checking recent location and scan events for {a.get('sku', '')}",
    "get_task_event_history": lambda a: f"Checking operational event history for {a.get('task_id', '')}",
    "search_procedures": lambda a: f"Searching operating procedures for: {a.get('query', '')}",
}


def describe_tool_call(name: str, args: dict) -> str:
    describer = _TOOL_DESCRIPTIONS.get(name)
    if describer:
        return describer(args)
    return f"Running {name.replace('_', ' ')}"


def render_transcript(messages: list[BaseMessage]) -> str:
    """Render the raw tool-calling message history into a readable plain-text
    transcript for the synthesis step. Decoupled from the live message chain
    on purpose, so synthesis never has to worry about API turn-sequencing
    rules for dangling tool calls."""
    lines: list[str] = []
    for msg in messages:
        if isinstance(msg, AIMessage):
            if msg.content:
                lines.append(f"[investigator] {msg.content}")
            for call in msg.tool_calls or []:
                lines.append(f"[investigator called {call['name']}] args={call['args']}")
        elif isinstance(msg, ToolMessage):
            lines.append(f"[result from {msg.name}] {msg.content}")
    return "\n".join(lines)


def next_evidence_id(existing: list[dict]) -> str:
    return f"EV-{len(existing) + 1:03d}"


def is_restricted_sku(state: "InvestigationState") -> bool:
    """Ground-truth check against the operational world -- not the model's
    wording, not `state["review"]["reasons"]`. Shared by assess.py (to
    decide review is required) and finalize.py (as an independent,
    structural re-check that a restricted SKU can never reach a resolved
    outcome without a recorded human decision, even if the review-trigger
    logic above it were ever wrong -- see finalize.py's module docstring)."""
    task = WORLD.get_pick_task(state["task_id"])
    sku = task["sku"] if task else None
    if not sku:
        return False
    return any(r.get("restricted") for r in WORLD.get_inventory(sku))
