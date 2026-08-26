"""Read-only operational lookup tools.

Each tool wraps one information source from the synthetic operational world
(app/data/world.py) and returns plain JSON-serializable data. These map
directly to the information sources named in Master Spec section 13: order
information, pick-task information, inventory information, item/location
history, and operational event history.

Tools intentionally do not classify or interpret their own results (e.g. they
don't decide "this is a conflict"). That judgment is made later, by the
model, in the synthesize step -- keeping the tools themselves simple and
auditable.
"""

from __future__ import annotations

from langchain_core.tools import tool

from app.data.world import WORLD


@tool
def get_order_info(order_id: str) -> dict:
    """Look up an order by its order ID. Returns the order's status, priority,
    and line items. Use this to understand what was ordered and why a pick
    task exists."""
    order = WORLD.get_order(order_id)
    if order is None:
        return {"found": False, "message": f"No order found with id {order_id}."}
    return {"found": True, "order": order}


@tool
def get_pick_task(task_id: str) -> dict:
    """Look up a pick task by its task ID. Returns the assigned location,
    requested quantity, and the full history of attempts (successes and
    failures) for this task."""
    task = WORLD.get_pick_task(task_id)
    if task is None:
        return {"found": False, "message": f"No pick task found with id {task_id}."}
    return {"found": True, "pick_task": task}


@tool
def get_inventory_record(sku: str, location: str | None = None) -> dict:
    """Look up the current inventory record(s) for a SKU. Optionally filter to
    a specific location. Returns quantity on hand, unit of measure, and when
    the record was last updated and last cycle-counted. An empty result means
    no inventory record exists for that SKU (and location, if given)."""
    records = WORLD.get_inventory(sku, location)
    if not records:
        return {
            "found": False,
            "message": f"No inventory record found for SKU {sku}"
            + (f" at location {location}." if location else "."),
        }
    return {"found": True, "records": records}


@tool
def get_location_history(sku: str) -> dict:
    """Look up recent location and scan events for a SKU: putaways, picks,
    moves, and cycle counts, in chronological order. Use this to check
    whether an item moved, was recounted, or was scanned more recently than
    the inventory record suggests. An empty result means no location history
    exists at all for this SKU."""
    events = WORLD.get_location_events(sku)
    if not events:
        return {"found": False, "message": f"No location history found for SKU {sku}."}
    return {"found": True, "events": events}


@tool
def get_task_event_history(task_id: str) -> dict:
    """Look up the operational event log for a pick task: creation, each
    attempt, and any system actions like auto-escalation. Use this to
    understand the sequence of what the system already did before this
    investigation started."""
    events = WORLD.get_task_events(task_id)
    if not events:
        return {"found": False, "message": f"No event history found for task {task_id}."}
    return {"found": True, "events": events}


LOOKUP_TOOLS = [
    get_order_info,
    get_pick_task,
    get_inventory_record,
    get_location_history,
    get_task_event_history,
]
