"""LLM-free check of the deterministic item trace and the review rules built
on it. No Groq call is made, so this runs without a real API key and is not
subject to rate limits:

    cd backend && source .venv/bin/activate && python -m eval.check_trace

The model clients are constructed at import time by the graph nodes, so a
placeholder key is set below purely to let `app.nodes.assess` import; nothing
here ever invokes a model.
"""

from __future__ import annotations

import os

os.environ.setdefault("GROQ_API_KEY", "unused-by-this-check")

from app.data.world import WORLD  # noqa: E402
from app.nodes.assess import _deterministic_checks  # noqa: E402
from app.trace import build_trace  # noqa: E402


def _codes(trace) -> list[str]:
    return [f["code"] for f in trace["findings"]]


def _state(incident_id: str) -> dict:
    incident = WORLD.get_incident(incident_id)
    # evidence is empty on purpose: the review triggers under test must not
    # depend on how a model labeled its evidence.
    return {"task_id": incident["task_id"], "order_id": incident["order_id"], "evidence": []}


def main() -> None:
    # INC-1042: attempt 1 (14:18) preceded the 14:21 move, so only attempt 2
    # is explained by it; inventory still says A-17 while the last record says B-12.
    t = build_trace(WORLD, "PX-1042")
    assert t["last_known"]["location"] == "B-12", t["last_known"]
    assert t["last_known"]["event_id"] == "LOC-EVT-0092"
    assert t["assigned_matches_last_known"] is False
    by_no = {a["attempt_no"]: a for a in t["attempts"]}
    assert by_no[1]["verdict"] == "records_place_item_at_assigned_location" and by_no[1]["explained"] is False
    assert by_no[2]["verdict"] == "item_elsewhere" and by_no[2]["item_location_at_attempt"] == "B-12"
    assert set(_codes(t)) == {"INVENTORY_LOCATION_MISMATCH", "ATTEMPT_UNEXPLAINED"}, _codes(t)

    reasons, risk = _deterministic_checks(_state("INC-1042"))
    assert risk == "medium" and len(reasons) == 2, (reasons, risk)

    # INC-2091: a recorded stock-out explains the failed pick; nothing to flag.
    t = build_trace(WORLD, "PX-2091")
    assert t["attempts"][0]["verdict"] == "stockout_recorded" and _codes(t) == []
    assert _deterministic_checks(_state("INC-2091")) == ([], None)

    # INC-3157: a short pick is not a not-found failure; the trace stays out of it.
    t = build_trace(WORLD, "PX-3157")
    assert t["attempts"][0]["verdict"] == "not_applicable" and _codes(t) == []

    # INC-4400: no records at all -> NO_HISTORY (informational; assess.py's
    # existing no-records rule is what forces review).
    t = build_trace(WORLD, "PX-4400")
    assert t["last_known"] is None and _codes(t) == ["NO_HISTORY"]

    # INC-5210: records say the restricted item is at C-02, yet the pick failed.
    t = build_trace(WORLD, "PX-5210")
    assert _codes(t) == ["ATTEMPT_UNEXPLAINED"] and t["assigned_matches_last_known"] is True

    # A move with no destination leaves the position unspecified, not guessed.
    class _World:
        def get_pick_task(self, _):
            return {"task_id": "T", "sku": "S", "assigned_location": "A-1", "attempts": [
                {"attempt_no": 1, "timestamp": "2026-01-01T10:00:00Z", "result": "failed", "reason_code": "ITEM_NOT_FOUND"}]}

        def get_inventory(self, _):
            return []

        def get_location_events(self, _):
            return [{"event_id": "E1", "sku": "S", "location": "A-1", "event_type": "moved",
                     "timestamp": "2026-01-01T09:00:00Z"}]

    t = build_trace(_World(), "T")
    assert t["last_known"]["location"] is None
    assert t["attempts"][0]["verdict"] == "item_in_transit" and t["attempts"][0]["explained"] is True

    print("trace checks passed")


if __name__ == "__main__":
    main()
