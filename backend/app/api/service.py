"""Shared logic between the SSE-streaming routes and the plain read routes:
building the initial state for a new investigation, and reading a case's
current snapshot back out of the checkpointer.
"""

from __future__ import annotations

from typing import Any

from app.data.world import WORLD


def build_initial_state(incident: dict) -> dict:
    return {
        "incident_id": incident["incident_id"],
        "task_id": incident["task_id"],
        "order_id": incident["order_id"],
        "incident_summary": incident["summary"],
    }


async def get_snapshot_values(graph, incident_id: str) -> dict[str, Any] | None:
    config = {"configurable": {"thread_id": incident_id}}
    snapshot = await graph.aget_state(config)
    if snapshot is None or not snapshot.values:
        return None
    return snapshot.values


def case_from_live_state(incident: dict, values: dict[str, Any] | None) -> dict[str, Any]:
    base = {
        "incident_id": incident["incident_id"],
        "task_id": incident["task_id"],
        "order_id": incident["order_id"],
        "title": incident["title"],
        "summary": incident["summary"],
        "category": incident.get("eval_category"),
        "is_seed_history": False,
    }
    if values is None:
        return {
            **base,
            "started": False,
            "status": "open",
            "round": 0,
            "max_rounds": None,
            "risk_level": None,
            "review": {"required": False, "reasons": []},
            "finding": None,
            "recommendation": None,
            "evidence": [],
            "hypotheses": [],
            "unresolved_questions": [],
            "activity_log": [],
            "human_feedback_history": [],
            "outcome": None,
        }
    return {
        **base,
        "started": True,
        "status": values.get("status"),
        "round": values.get("round"),
        "max_rounds": values.get("max_rounds"),
        "risk_level": values.get("risk_level"),
        "review": values.get("review", {"required": False, "reasons": []}),
        "finding": values.get("finding"),
        "recommendation": values.get("recommendation"),
        "evidence": values.get("evidence", []),
        "hypotheses": values.get("hypotheses", []),
        "unresolved_questions": values.get("unresolved_questions", []),
        "activity_log": values.get("activity_log", []),
        "human_feedback_history": values.get("human_feedback_history", []),
        "outcome": values.get("outcome"),
    }


def case_from_seed_history(seed: dict) -> dict[str, Any]:
    return {
        "incident_id": seed["incident_id"],
        "task_id": seed["task_id"],
        "order_id": seed["order_id"],
        "title": seed["title"],
        "summary": seed.get("note", ""),
        "category": None,
        "is_seed_history": True,
        "started": True,
        "status": seed["status"],
        "round": None,
        "max_rounds": None,
        "risk_level": seed["risk_level"],
        "review": {"required": False, "reasons": []},
        "finding": {"likely_cause": seed["likely_cause"], "explanation": seed["likely_cause"], "evidence_ids": []},
        "recommendation": {"action": seed["recommendation"], "rationale": "", "evidence_ids": []},
        "evidence": [],
        "hypotheses": [],
        "unresolved_questions": [],
        "activity_log": [],
        "human_feedback_history": [
            {
                "round": 1,
                "decision": seed["human_decision"],
                "feedback_text": f"Reviewed by {seed['reviewer']}",
                "timestamp": seed["resolved_at"],
            }
        ],
        "outcome": {
            "outcome_type": seed["status"],
            "status": seed["status"],
            "finding": {"likely_cause": seed["likely_cause"]},
            "recommendation": {"action": seed["recommendation"]},
            "risk_level": seed["risk_level"],
            "decided_at": seed["resolved_at"],
        },
    }


async def list_all_cases(graph) -> list[dict[str, Any]]:
    cases = []
    for incident in WORLD.list_incidents():
        values = await get_snapshot_values(graph, incident["incident_id"])
        cases.append(case_from_live_state(incident, values))
    for seed in WORLD.seed_case_history:
        cases.append(case_from_seed_history(seed))
    return cases


async def get_audit_trail(graph, incident_id: str) -> list[dict[str, Any]]:
    """The checkpointer already retains full state history per incident --
    this surfaces it as an explicit, ordered, exportable audit trail rather
    than something only inspectable by poking at the checkpointer directly
    (root README next-steps item #5).

    `graph.aget_state_history` yields snapshots newest-first, each carrying
    `.next` (the node(s) about to run *from* that checkpoint) rather than a
    "which node just wrote this" field -- this LangGraph version's
    checkpoint metadata doesn't carry the latter directly. So the node that
    *produced* a given checkpoint is read off the chronologically-preceding
    checkpoint's `.next` instead, once the list is put in oldest-first
    order. Since `activity_log` is append-only, each entry also reports the
    exact new activity-log lines that node contributed -- so the trail
    explains not just "what state changed" but "what happened", in the same
    plain language the live activity feed uses.

    The very first checkpoint (the raw incident input, before any node has
    run) and LangGraph's internal `__start__` scheduling checkpoint (a
    bookkeeping step between "input received" and the first real node,
    carrying no state change of its own) are collapsed: only the initial
    entry is kept, labeled with `node: None`, so the trail starts cleanly at
    "case opened" and then only lists real graph nodes.
    """
    config = {"configurable": {"thread_id": incident_id}}
    newest_first = [snap async for snap in graph.aget_state_history(config)]
    if not newest_first:
        return []
    oldest_first = list(reversed(newest_first))

    entries: list[dict[str, Any]] = []
    prior_log_len = 0
    for i, snap in enumerate(oldest_first):
        if i > 0:
            preceding_next = oldest_first[i - 1].next
            producer = preceding_next[0] if preceding_next else None
            if producer == "__start__":
                continue  # internal scheduling checkpoint, not a real node -- skip it
            node = producer
        else:
            node = None  # the raw incident input, before any node has run

        values = snap.values or {}
        activity_log = values.get("activity_log") or []
        new_activity = activity_log[prior_log_len:]
        prior_log_len = len(activity_log)

        entries.append(
            {
                "step": (snap.metadata or {}).get("step"),
                "node": node,
                "checkpoint_id": snap.config.get("configurable", {}).get("checkpoint_id"),
                "timestamp": snap.created_at,
                "status": values.get("status"),
                "round": values.get("round"),
                "risk_level": values.get("risk_level"),
                "review_required": (values.get("review") or {}).get("required", False),
                "evidence_count": len(values.get("evidence") or []),
                "new_activity": new_activity,
            }
        )
    return entries


async def get_one_case(graph, incident_id: str) -> dict[str, Any] | None:
    incident = WORLD.get_incident(incident_id)
    if incident is not None:
        values = await get_snapshot_values(graph, incident_id)
        return case_from_live_state(incident, values)
    seed = next((s for s in WORLD.seed_case_history if s["incident_id"] == incident_id), None)
    if seed is not None:
        return case_from_seed_history(seed)
    return None
