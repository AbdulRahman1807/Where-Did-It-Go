from __future__ import annotations

import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from langgraph.types import Command

from app.api.schemas import NewIncidentRequest, ReviewDecisionRequest
from app.api.service import (
    build_initial_state,
    case_from_live_state,
    get_audit_trail,
    get_one_case,
    get_snapshot_values,
    list_all_cases,
)
from app.api.streaming import stream_graph_events
from app.data.world import WORLD

router = APIRouter(prefix="/api")


def _graph(request: Request):
    return request.app.state.graph


@router.get("/incidents")
async def list_incidents(request: Request):
    return {"cases": await list_all_cases(_graph(request))}


@router.post("/incidents", status_code=201)
async def file_incident(body: NewIncidentRequest):
    if body.reason_code == "SHORT_PICK":
        if body.qty_picked is None:
            raise HTTPException(status_code=400, detail="qty_picked is required when reason_code is SHORT_PICK.")
        if body.qty_picked >= body.qty_requested:
            raise HTTPException(
                status_code=400, detail="qty_picked must be less than qty_requested for a short pick."
            )

    incident = WORLD.create_incident(
        sku=body.sku.strip(),
        item_description=body.item_description.strip(),
        location=body.location.strip().upper(),
        qty_requested=body.qty_requested,
        priority=body.priority,
        customer_ref=body.customer_ref.strip() if body.customer_ref else None,
        reason_code=body.reason_code,
        qty_picked=body.qty_picked,
        attempt_count=body.attempt_count,
        restricted=body.restricted,
        inventory_qty=body.inventory_qty,
        summary=body.summary.strip() if body.summary else None,
    )
    return case_from_live_state(incident, values=None)


@router.get("/incidents/{incident_id}")
async def get_incident(incident_id: str, request: Request):
    case = await get_one_case(_graph(request), incident_id)
    if case is None:
        raise HTTPException(status_code=404, detail=f"No incident found with id {incident_id}.")
    return case


@router.get("/incidents/{incident_id}/audit")
async def get_incident_audit(incident_id: str, request: Request):
    incident = WORLD.get_incident(incident_id)
    if incident is None:
        if any(s["incident_id"] == incident_id for s in WORLD.seed_case_history):
            return {"incident_id": incident_id, "entries": [], "note": "Seed case history predates checkpointed audit trails."}
        raise HTTPException(status_code=404, detail=f"No incident found with id {incident_id}.")
    entries = await get_audit_trail(_graph(request), incident_id)
    return {"incident_id": incident_id, "entries": entries}



# Statuses where the graph is neither paused for a human decision nor
# finished -- i.e. the last request ended (crashed, network drop, rate
# limit) mid-round, after at least one node had checkpointed but before the
# round reached its next stable point. These are the only statuses this
# endpoint will resume; "awaiting_review" goes through /review instead, and
# terminal statuses have nothing left to run.
RETRYABLE_STATUSES = {"investigating", "investigating_again"}


@router.post("/incidents/{incident_id}/investigate")
async def start_investigation(incident_id: str, request: Request):
    graph = _graph(request)
    incident = WORLD.get_incident(incident_id)
    if incident is None:
        raise HTTPException(status_code=404, detail=f"No incident found with id {incident_id}.")

    config = {"configurable": {"thread_id": incident_id}}
    existing = await get_snapshot_values(graph, incident_id)

    if existing is not None:
        if existing.get("status") in RETRYABLE_STATUSES:
            # Resume from the last checkpoint rather than restarting from
            # intake -- None is LangGraph's documented signal for "continue
            # after an interruption" (see Pregel loop's `_first`: "None
            # input: resume after interrupt"), distinct from Command(resume=)
            # which is specifically for resuming a paused interrupt() call.
            return StreamingResponse(
                stream_graph_events(graph, None, config, incident_id),
                media_type="text/event-stream",
            )

        case = await get_one_case(graph, incident_id)

        async def already_started():
            yield f"data: {json.dumps({'type': 'already_started', 'case': case}, default=str)}\n\n".encode()

        return StreamingResponse(already_started(), media_type="text/event-stream")

    run_input = build_initial_state(incident)
    return StreamingResponse(
        stream_graph_events(graph, run_input, config, incident_id),
        media_type="text/event-stream",
    )


@router.post("/incidents/{incident_id}/review")
async def submit_review(incident_id: str, decision: ReviewDecisionRequest, request: Request):
    graph = _graph(request)
    config = {"configurable": {"thread_id": incident_id}}
    existing = await get_snapshot_values(graph, incident_id)

    if existing is None:
        raise HTTPException(status_code=404, detail=f"No investigation in progress for {incident_id}.")
    if existing.get("status") != "awaiting_review":
        raise HTTPException(
            status_code=409,
            detail=f"Incident {incident_id} is not currently awaiting review (status: {existing.get('status')}).",
        )

    run_input = Command(resume=decision.model_dump())
    return StreamingResponse(
        stream_graph_events(graph, run_input, config, incident_id),
        media_type="text/event-stream",
    )
