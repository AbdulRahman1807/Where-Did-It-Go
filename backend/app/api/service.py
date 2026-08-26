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


async def get_one_case(graph, incident_id: str) -> dict[str, Any] | None:
    incident = WORLD.get_incident(incident_id)
    if incident is not None:
        values = await get_snapshot_values(graph, incident_id)
        return case_from_live_state(incident, values)
    seed = next((s for s in WORLD.seed_case_history if s["incident_id"] == incident_id), None)
    if seed is not None:
        return case_from_seed_history(seed)
    return None
