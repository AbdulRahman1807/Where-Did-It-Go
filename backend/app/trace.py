"""Deterministic item trace: where did the records last place this item, and
did that explain each failed pick?

Everything here is plain code over the operational records -- no model call.
It answers the product's core question ("what is the last record of this
item, and does it agree with the pick task and the inventory record?") from
the data itself, so the answer doesn't depend on how a model words or labels
its evidence. The investigation graph uses it three ways: shown to the
investigator and synthesizer as ground truth for the timeline, appended to
the case file as evidence, and read by assess.py as a review trigger.

Model of the data this relies on (kept deliberately small):
  - Location events for a SKU form a position history. The item's position
    after an event is `to_location` if the event has one, else the event's
    `location`. A `moved` event with no `to_location` leaves the position
    unspecified until the next event that names one (the records say it left,
    not where it went).
  - Inventory records are a current snapshot, not history. They are used for
    stock-out detection and for the stale-record comparison.
  - One position per SKU. If positive stock is recorded at several
    locations, location-mismatch conclusions are skipped rather than guessed.
"""

from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

# Verdicts for a failed pick attempt. "explained" means the records account
# for why the item wasn't at the assigned location at that moment.
V_ELSEWHERE = "item_elsewhere"
V_STOCKOUT = "stockout_recorded"
V_IN_TRANSIT = "item_in_transit"
V_NO_HISTORY = "no_history_before_attempt"
V_AT_ASSIGNED = "records_place_item_at_assigned_location"
V_NOT_APPLICABLE = "not_applicable"

_EXPLAINED = {V_ELSEWHERE, V_STOCKOUT, V_IN_TRANSIT}


def parse_ts(value: str) -> datetime:
    dt = datetime.fromisoformat(value.replace("Z", "+00:00"))
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def _event_sort_key(event: dict[str, Any]) -> tuple[datetime, int]:
    # At identical timestamps a move is processed before the arrival scan
    # that follows it, regardless of file order.
    return parse_ts(event["timestamp"]), 0 if event.get("event_type") == "moved" else 1


def _position_after(event: dict[str, Any]) -> str | None:
    destination = event.get("to_location")
    if destination:
        return destination
    if event.get("event_type") == "moved":
        return None
    return event.get("location")


def _position_at(events: list[dict[str, Any]], when: datetime) -> dict[str, Any] | None:
    latest = None
    for event in events:
        if parse_ts(event["timestamp"]) > when:
            break
        latest = event
    return latest


def _event_label(event: dict[str, Any]) -> str:
    kind = event["event_type"].replace("_", " ")
    if event["event_type"] == "moved":
        origin = event.get("from_location") or event.get("location")
        destination = event.get("to_location")
        if origin and destination:
            return f"Moved {origin} → {destination}"
        return f"Moved from {origin}" if origin else "Moved"
    return f"{kind.capitalize()} at {event['location']}"


def _classify_attempt(
    attempt: dict[str, Any],
    assigned: str,
    events: list[dict[str, Any]],
    inventory: list[dict[str, Any]],
) -> dict[str, Any]:
    result: dict[str, Any] = {
        "attempt_no": attempt["attempt_no"],
        "timestamp": attempt["timestamp"],
        "result": attempt["result"],
        "reason_code": attempt.get("reason_code"),
        "location": assigned,
        "item_location_at_attempt": None,
        "verdict": V_NOT_APPLICABLE,
        "explained": None,
        "detail": "",
    }
    if attempt["result"] != "failed" or attempt.get("reason_code") != "ITEM_NOT_FOUND":
        result["detail"] = "Not a not-found failure; location replay does not apply."
        return result

    event = _position_at(events, parse_ts(attempt["timestamp"]))
    if event is None:
        result["verdict"] = V_NO_HISTORY
        result["detail"] = "No location event precedes this attempt."
        result["explained"] = False if not events else None
        return result

    position = _position_after(event)
    result["item_location_at_attempt"] = position
    if position is None:
        result["verdict"] = V_IN_TRANSIT
        result["detail"] = f"{event['event_id']} records the item leaving {event.get('location')} with no destination."
    elif position != assigned:
        result["verdict"] = V_ELSEWHERE
        result["detail"] = f"{event['event_id']} ({event['timestamp']}) had already placed the item at {position}."
    elif any(r["location"] == assigned and r["qty_on_hand"] == 0 for r in inventory):
        result["verdict"] = V_STOCKOUT
        result["detail"] = f"Inventory records zero on hand at {assigned}."
    else:
        result["verdict"] = V_AT_ASSIGNED
        result["detail"] = (
            f"{event['event_id']} ({event['timestamp']}) still placed the item at {assigned}, "
            "and no zero-stock record explains the failure."
        )
    result["explained"] = result["verdict"] in _EXPLAINED
    return result


def build_trace(world, task_id: str) -> dict[str, Any] | None:
    task = world.get_pick_task(task_id)
    if task is None:
        return None

    sku = task["sku"]
    assigned = task["assigned_location"]
    events = sorted(world.get_location_events(sku), key=_event_sort_key)
    inventory = world.get_inventory(sku)

    last_known = None
    if events:
        last = events[-1]
        position = _position_after(last)
        last_known = {
            "location": position,
            "as_of": last["timestamp"],
            "event_id": last["event_id"],
            "event_type": last["event_type"],
            "note": last.get("note", ""),
        }

    attempts = [_classify_attempt(a, assigned, events, inventory) for a in task.get("attempts", [])]

    positive_locations = {r["location"] for r in inventory if r["qty_on_hand"] > 0}
    single_position = len(positive_locations) <= 1

    findings: list[dict[str, Any]] = []

    if last_known and last_known["location"] and single_position:
        as_of = parse_ts(last_known["as_of"])
        for record in inventory:
            if record["qty_on_hand"] > 0 and record["location"] != last_known["location"]:
                stale = parse_ts(record["last_updated"]) < as_of
                findings.append(
                    {
                        "code": "INVENTORY_LOCATION_MISMATCH",
                        "severity": "conflict",
                        "review": True,
                        "message": (
                            f"Inventory record shows {sku} at {record['location']} "
                            f"(qty {record['qty_on_hand']}, last updated {record['last_updated']}), but the most "
                            f"recent location event ({last_known['event_id']}, {last_known['as_of']}) places it at "
                            f"{last_known['location']}. "
                            + (
                                "The inventory record is older than that event, so it is likely stale."
                                if stale
                                else "The inventory record was updated after that event, so the records genuinely disagree."
                            )
                        ),
                    }
                )

    for attempt in attempts:
        if attempt["verdict"] == V_AT_ASSIGNED:
            findings.append(
                {
                    "code": "ATTEMPT_UNEXPLAINED",
                    "severity": "unexplained",
                    "review": True,
                    "attempt_no": attempt["attempt_no"],
                    "message": (
                        f"Attempt {attempt['attempt_no']} ({attempt['timestamp']}) failed at {assigned}, but the "
                        f"records place {sku} at {assigned} at that time. The records alone do not explain this "
                        "failure; physical verification is needed."
                    ),
                }
            )

    if not single_position:
        findings.append(
            {
                "code": "MULTI_LOCATION_STOCK",
                "severity": "info",
                "review": False,
                "message": (
                    f"Positive stock is recorded at several locations ({', '.join(sorted(positive_locations))}); "
                    "the one-position-per-SKU trace cannot say which location a scan refers to."
                ),
            }
        )

    if not events and not inventory:
        findings.append(
            {
                "code": "NO_HISTORY",
                "severity": "info",
                "review": False,
                "message": f"No location events and no inventory record exist for {sku}.",
            }
        )

    timeline: list[dict[str, Any]] = []
    for event in events:
        timeline.append(
            {
                "timestamp": event["timestamp"],
                "kind": "location_event",
                "label": _event_label(event),
                "location": _position_after(event),
                "detail": event.get("note", ""),
                "ref": event["event_id"],
            }
        )
    for attempt in attempts:
        timeline.append(
            {
                "timestamp": attempt["timestamp"],
                "kind": "pick_attempt",
                "label": f"Pick attempt {attempt['attempt_no']} at {assigned}: {attempt['result'].replace('_', ' ')}",
                "location": assigned,
                "detail": attempt["detail"],
                "ref": f"attempt-{attempt['attempt_no']}",
                "verdict": attempt["verdict"],
                "explained": attempt["explained"],
            }
        )
    for record in inventory:
        timeline.append(
            {
                "timestamp": record["last_updated"],
                "kind": "inventory_update",
                "label": f"Inventory record last updated: {record['qty_on_hand']} at {record['location']}",
                "location": record["location"],
                "detail": f"Last cycle count {record['last_cycle_count']}.",
                "ref": f"inventory-{record['location']}",
            }
        )
    kind_order = {"location_event": 0, "inventory_update": 1, "pick_attempt": 2}
    timeline.sort(key=lambda item: (parse_ts(item["timestamp"]), kind_order[item["kind"]]))

    return {
        "task_id": task_id,
        "sku": sku,
        "assigned_location": assigned,
        "last_known": last_known,
        "assigned_matches_last_known": (
            None if not last_known or not last_known["location"] else last_known["location"] == assigned
        ),
        "inventory": [
            {
                "location": r["location"],
                "qty_on_hand": r["qty_on_hand"],
                "last_updated": r["last_updated"],
                "last_cycle_count": r["last_cycle_count"],
            }
            for r in inventory
        ],
        "attempts": attempts,
        "findings": findings,
        "timeline": timeline,
        "single_position_assumed": single_position,
    }


def render_trace_text(trace: dict[str, Any]) -> str:
    """Plain-text form for the investigator and synthesizer prompts."""
    lines = [f"Deterministic item trace for {trace['sku']} (computed from the records, not inferred):"]
    last = trace["last_known"]
    if last is None:
        lines.append("- Last known record: none (no location events exist for this SKU).")
    elif last["location"] is None:
        lines.append(f"- Last known record: left its previous location at {last['as_of']} ({last['event_id']}), destination not recorded.")
    else:
        lines.append(f"- Last known record: {last['location']} as of {last['as_of']} ({last['event_type']}, {last['event_id']}).")
    match = trace["assigned_matches_last_known"]
    lines.append(
        f"- Assigned pick location: {trace['assigned_location']}"
        + ("" if match is None else " (matches last known location)" if match else " (does NOT match last known location)")
    )
    for record in trace["inventory"]:
        lines.append(
            f"- Inventory record: {record['qty_on_hand']} at {record['location']}, last updated {record['last_updated']}."
        )
    if not trace["inventory"]:
        lines.append("- Inventory record: none.")
    for attempt in trace["attempts"]:
        if attempt["verdict"] == V_NOT_APPLICABLE:
            continue
        status = {True: "explained by the records", False: "NOT explained by the records"}.get(
            attempt["explained"], "cannot be assessed from the records"
        )
        lines.append(f"- Attempt {attempt['attempt_no']} ({attempt['timestamp']}): {attempt['verdict']} -- {status}. {attempt['detail']}")
    for finding in trace["findings"]:
        lines.append(f"- Finding [{finding['code']}]: {finding['message']}")
    return "\n".join(lines)


def trace_evidence(trace: dict[str, Any]) -> dict[str, Any] | None:
    """The trace as one evidence item (fields match synthesize's evidence
    dicts, minus id/round, which the caller assigns)."""
    if trace["last_known"] is None and not trace["inventory"]:
        return None
    last = trace["last_known"]
    if last and last["location"]:
        head = f"Last known record: {last['location']} as of {last['as_of']}."
    elif last:
        head = f"Last known record: item left its previous location at {last['as_of']}, destination not recorded."
    else:
        head = "No location events exist for this SKU."
    review_findings = [f["message"] for f in trace["findings"] if f["review"]]
    return {
        "source_type": "operational",
        "source_name": f"Item trace {trace['sku']}",
        "summary": " ".join([head, *review_findings]),
        "detail": render_trace_text(trace),
        "stance": "conflicts" if review_findings else "neutral",
    }
