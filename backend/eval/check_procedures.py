"""LLM-free check that a procedure lookup is structurally guaranteed.

    cd backend && source .venv/bin/activate && python -m eval.check_procedures

Exercises the routing decision and the forced-search node directly against
the real Chroma index; no model is invoked. A placeholder key is set only so
`app.nodes.investigate` can import (it builds its model client at import).
"""

from __future__ import annotations

import json
import os

os.environ.setdefault("GROQ_API_KEY", "unused-by-this-check")

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage  # noqa: E402

from app.data.world import WORLD  # noqa: E402
from app.nodes.investigate import route_after_investigate  # noqa: E402
from app.nodes.procedures import force_procedure_search, has_searched_procedures  # noqa: E402


def _state(incident_id: str, messages: list) -> dict:
    incident = WORLD.get_incident(incident_id)
    return {"task_id": incident["task_id"], "order_id": incident["order_id"], "messages": messages}


def _sources(update: dict) -> set[str]:
    found: set[str] = set()
    for message in update["messages"]:
        if isinstance(message, ToolMessage):
            found.update(h["source_name"] for h in json.loads(message.content).get("results", []))
    return found


def main() -> None:
    opening = HumanMessage(content="Investigate.")
    done_without_search = [opening, AIMessage(content="I have enough evidence.")]
    searched = [
        opening,
        AIMessage(content="", tool_calls=[{"name": "search_procedures", "args": {"query": "x"}, "id": "c1"}]),
        ToolMessage(content="{}", name="search_procedures", tool_call_id="c1"),
        AIMessage(content="Done."),
    ]
    wants_tool = [opening, AIMessage(content="", tool_calls=[{"name": "get_order_info", "args": {}, "id": "c2"}])]

    # Routing: the model stopping without a search is sent to the forced search,
    # a model that did search goes straight to synthesis, tool calls are unaffected.
    assert not has_searched_procedures(done_without_search) and has_searched_procedures(searched)
    assert route_after_investigate(_state("INC-1042", done_without_search)) == "procedures"
    assert route_after_investigate(_state("INC-1042", searched)) == "synthesize"
    assert route_after_investigate(_state("INC-1042", wants_tool)) == "tools"

    # The forced search records a well-formed tool-call/answer pair per query
    # (ids line up, so the history stays valid for later model calls) and
    # retrieves the procedure each incident actually turns on.
    expectations = {
        "INC-1042": {"SOP-03"},  # stale inventory vs. a later move; repeated failure
        "INC-3157": {"SOP-07"},  # short pick on an expedited order
        "INC-5210": {"SOP-06"},  # restricted / high-value authority
    }
    for incident_id, expected in expectations.items():
        update = force_procedure_search(_state(incident_id, done_without_search))
        ai, *answers = update["messages"]
        assert isinstance(ai, AIMessage) and len(ai.tool_calls) == len(answers) >= 1
        assert [c["id"] for c in ai.tool_calls] == [m.tool_call_id for m in answers]
        assert all(m.name == "search_procedures" for m in answers)
        assert len(update["activity_log"]) == len(ai.tool_calls)
        assert expected <= _sources(update), (incident_id, _sources(update))

    # Once the forced search is in the history, nothing is searched twice.
    update = force_procedure_search(_state("INC-2091", done_without_search))
    after = done_without_search + update["messages"]
    assert has_searched_procedures(after)
    assert route_after_investigate(_state("INC-2091", after + [AIMessage(content="Done.")])) == "synthesize"

    print("procedure-search checks passed")


if __name__ == "__main__":
    main()
