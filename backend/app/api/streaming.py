"""SSE event streaming for the two graph-driving endpoints (start investigation,
submit a review decision). Both endpoints drive the same LangGraph run and
share this generator so the frontend gets one consistent event shape either
way.

Event types sent to the client (each an SSE `data:` line, JSON-encoded):
  activity        - one human-readable progress line, for the live activity feed
  node_update     - a state field changed; carries the field(s) that changed
  review_required - the graph paused on interrupt(); carries the review payload
  error           - something failed; carries a human-readable message only
                    (never a stack trace or raw provider error)
  done            - the run finished (resolved, escalated, or paused); carries
                    the full current case snapshot so the client can resync
"""

from __future__ import annotations

import json
import logging
from typing import Any, AsyncGenerator

from app.api.service import get_one_case

logger = logging.getLogger("where_did_it_go")

_HIDDEN_KEYS = {"messages"}


def _sanitize(update: dict[str, Any]) -> dict[str, Any]:
    return {k: v for k, v in update.items() if k not in _HIDDEN_KEYS}


def _sse(event_type: str, data: dict[str, Any]) -> bytes:
    payload = json.dumps({"type": event_type, **data}, default=str)
    return f"data: {payload}\n\n".encode("utf-8")


async def stream_graph_events(
    graph, run_input: Any, config: dict, incident_id: str
) -> AsyncGenerator[bytes, None]:
    try:
        async for chunk in graph.astream(run_input, config, stream_mode="updates"):
            if "__interrupt__" in chunk:
                interrupt_obj = chunk["__interrupt__"][0]
                yield _sse("review_required", {"payload": interrupt_obj.value})
                continue

            for node_name, update in chunk.items():
                clean = _sanitize(update or {})
                for line in clean.get("activity_log", []):
                    yield _sse("activity", {"node": node_name, "text": line})
                if clean:
                    yield _sse("node_update", {"node": node_name, "update": clean})
    except Exception:
        logger.exception("Investigation stream failed for incident %s", incident_id)
        yield _sse(
            "error",
            {
                "message": (
                    "The investigation could not continue right now. The model "
                    "or evidence service may be temporarily unavailable. Please retry."
                )
            },
        )

    case = await get_one_case(graph, incident_id)
    yield _sse("done", {"case": case})
