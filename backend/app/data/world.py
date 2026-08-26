"""In-memory synthetic operational world.

Loads the JSON fixtures once at process startup and exposes small lookup
functions that the agent's tools call. This stands in for the operational
systems (WMS, inventory, event log) a real fulfillment agent would query.

Data is deliberately internally consistent for most records, with a few
incidents built to contain missing data, conflicting records, or authority
constraints -- see backend/eval/cases.py for how each incident is used.

The five original incidents (INC-1042, 2091, 3157, 4400, 5210) are the
hand-engineered eval fixtures and are never modified at runtime -- the eval
suite depends on their exact fields. New incidents filed through the app
(see create_incident below) are layered on top and persisted separately to
fixtures/user_incidents.json, so the two stay cleanly distinguishable and a
fresh checkout's eval results are never affected by what a user has filed.
"""

from __future__ import annotations

import json
import random
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from app.config import FIXTURES_DIR

USER_INCIDENTS_PATH = FIXTURES_DIR / "user_incidents.json"

_EMPTY_USER_DATA: dict[str, list] = {
    "orders": [],
    "pick_tasks": [],
    "inventory": [],
    "location_events": [],
    "task_events": [],
    "incidents": [],
}


def _load(name: str) -> list[dict[str, Any]]:
    with open(FIXTURES_DIR / name, encoding="utf-8") as f:
        return json.load(f)


def _load_user_data() -> dict[str, list[dict[str, Any]]]:
    if not USER_INCIDENTS_PATH.exists():
        return {k: [] for k in _EMPTY_USER_DATA}
    with open(USER_INCIDENTS_PATH, encoding="utf-8") as f:
        data = json.load(f)
    return {k: data.get(k, []) for k in _EMPTY_USER_DATA}


@dataclass(frozen=True)
class OperationalWorld:
    orders: list[dict[str, Any]]
    pick_tasks: list[dict[str, Any]]
    inventory: list[dict[str, Any]]
    location_events: list[dict[str, Any]]
    task_events: list[dict[str, Any]]
    incidents: list[dict[str, Any]]
    seed_case_history: list[dict[str, Any]]
    # Mirrors exactly what create_incident has added, across all six
    # collections above -- kept separately so it can be persisted to
    # user_incidents.json without touching the original fixture files.
    user_data: dict[str, list[dict[str, Any]]] = field(default_factory=lambda: {k: [] for k in _EMPTY_USER_DATA})

    def get_order(self, order_id: str) -> dict[str, Any] | None:
        return next((o for o in self.orders if o["order_id"] == order_id), None)

    def get_pick_task(self, task_id: str) -> dict[str, Any] | None:
        return next((t for t in self.pick_tasks if t["task_id"] == task_id), None)

    def get_inventory(self, sku: str, location: str | None = None) -> list[dict[str, Any]]:
        records = [r for r in self.inventory if r["sku"] == sku]
        if location:
            records = [r for r in records if r["location"] == location]
        return records

    def get_location_events(self, sku: str) -> list[dict[str, Any]]:
        events = [e for e in self.location_events if e["sku"] == sku]
        return sorted(events, key=lambda e: e["timestamp"])

    def get_task_events(self, task_id: str) -> list[dict[str, Any]]:
        events = [e for e in self.task_events if e["task_id"] == task_id]
        return sorted(events, key=lambda e: e["timestamp"])

    def get_incident(self, incident_id: str) -> dict[str, Any] | None:
        return next((i for i in self.incidents if i["incident_id"] == incident_id), None)

    def list_incidents(self) -> list[dict[str, Any]]:
        return list(self.incidents)

    def _unique_number(self, existing_ids: set[str], prefix: str) -> str:
        for _ in range(200):
            n = random.randint(1000, 9999)
            candidate = f"{prefix}-{n}"
            if candidate not in existing_ids:
                return candidate
        raise RuntimeError(f"Could not find a free {prefix}-#### id after 200 attempts.")

    def create_incident(
        self,
        *,
        sku: str,
        item_description: str,
        location: str,
        qty_requested: int,
        priority: str,
        customer_ref: str | None,
        reason_code: str,
        qty_picked: int | None,
        attempt_count: int,
        restricted: bool,
        inventory_qty: int | None,
        summary: str | None,
    ) -> dict[str, Any]:
        """Files a new pick exception: builds a consistent order, pick task,
        (optional) inventory record, and event history, then appends and
        persists it. Returns the new incident record.

        A missing `inventory_qty` deliberately leaves no inventory record at
        all, the same "no data" shape as INC-4400 -- realistic for a SKU the
        system has no record of, and it's the user's choice, not a default
        assumption about what a new incident should look like.
        """
        existing_incident_ids = {i["incident_id"] for i in self.incidents}
        existing_order_ids = {o["order_id"] for o in self.orders}

        shared_number = self._unique_number(existing_incident_ids, "INC")
        n = shared_number.split("-")[1]
        incident_id = f"INC-{n}"
        task_id = f"PX-{n}"
        order_id = self._unique_number(existing_order_ids, "ORD")
        zone = location.split("-")[0].upper() if "-" in location else location[:1].upper()
        customer_ref = customer_ref or f"CUST-{random.randint(1000, 9999)}"

        now = datetime.now(timezone.utc)
        now_iso = now.isoformat().replace("+00:00", "Z")

        order = {
            "order_id": order_id,
            "customer_ref": customer_ref,
            "created_at": now_iso,
            "priority": priority,
            "status": "exception",
            "line_items": [{"sku": sku, "description": item_description, "qty_ordered": qty_requested}],
        }

        attempts = []
        for i in range(1, attempt_count + 1):
            attempt: dict[str, Any] = {
                "attempt_no": i,
                "timestamp": now_iso,
                "result": "short_pick" if (reason_code == "SHORT_PICK" and i == attempt_count) else "failed",
                "reason_code": reason_code,
            }
            if reason_code == "SHORT_PICK" and i == attempt_count and qty_picked is not None:
                attempt["qty_picked"] = qty_picked
            attempts.append(attempt)

        pick_task = {
            "task_id": task_id,
            "order_id": order_id,
            "sku": sku,
            "qty_requested": qty_requested,
            "assigned_location": location,
            "zone": zone,
            "status": "exception",
            "created_at": now_iso,
            "last_updated": now_iso,
            "attempts": attempts,
        }

        inventory_record = None
        if inventory_qty is not None:
            inventory_record = {
                "sku": sku,
                "location": location,
                "qty_on_hand": inventory_qty,
                "uom": "EA",
                "last_cycle_count": now_iso,
                "last_updated": now_iso,
                "restricted": restricted,
            }

        task_events = [
            {
                "event_id": f"TASK-EVT-U{n}-0",
                "task_id": task_id,
                "timestamp": now_iso,
                "event_type": "task_created",
                "detail": f"Pick task created for {order_id}.",
            }
        ]
        for i, attempt in enumerate(attempts, start=1):
            task_events.append(
                {
                    "event_id": f"TASK-EVT-U{n}-{i}",
                    "task_id": task_id,
                    "timestamp": attempt["timestamp"],
                    "event_type": "attempt_short_pick" if attempt["result"] == "short_pick" else "attempt_failed",
                    "detail": f"Attempt {i} {attempt['result']}: {reason_code} at {location}.",
                }
            )
        task_events.append(
            {
                "event_id": f"TASK-EVT-U{n}-{len(attempts) + 1}",
                "task_id": task_id,
                "timestamp": now_iso,
                "event_type": "escalated_by_system",
                "detail": "Auto-escalated after filed exception.",
            }
        )

        incident = {
            "incident_id": incident_id,
            "task_id": task_id,
            "order_id": order_id,
            "title": f"Pick failure, SKU {sku}",
            "summary": summary
            or (
                f"Pick task {task_id} failed at location {location} for order {order_id} "
                f"({reason_code.replace('_', ' ').lower()})."
            ),
            "eval_category": None,
        }

        self.orders.append(order)
        self.pick_tasks.append(pick_task)
        if inventory_record:
            self.inventory.append(inventory_record)
        self.location_events.extend([])  # no location history for a freshly filed incident
        self.task_events.extend(task_events)
        self.incidents.append(incident)

        self.user_data["orders"].append(order)
        self.user_data["pick_tasks"].append(pick_task)
        if inventory_record:
            self.user_data["inventory"].append(inventory_record)
        self.user_data["task_events"].extend(task_events)
        self.user_data["incidents"].append(incident)
        self._persist_user_data()

        return incident

    def _persist_user_data(self) -> None:
        USER_INCIDENTS_PATH.parent.mkdir(parents=True, exist_ok=True)
        with open(USER_INCIDENTS_PATH, "w", encoding="utf-8") as f:
            json.dump(self.user_data, f, indent=2)


def load_world() -> OperationalWorld:
    user_data = _load_user_data()
    orders = _load("orders.json") + user_data["orders"]
    pick_tasks = _load("pick_tasks.json") + user_data["pick_tasks"]
    inventory = _load("inventory.json") + user_data["inventory"]
    location_events = _load("location_events.json") + user_data["location_events"]
    task_events = _load("task_events.json") + user_data["task_events"]
    incidents = _load("incidents.json") + user_data["incidents"]

    return OperationalWorld(
        orders=orders,
        pick_tasks=pick_tasks,
        inventory=inventory,
        location_events=location_events,
        task_events=task_events,
        incidents=incidents,
        seed_case_history=_load("seed_case_history.json"),
        user_data=user_data,
    )


WORLD = load_world()
