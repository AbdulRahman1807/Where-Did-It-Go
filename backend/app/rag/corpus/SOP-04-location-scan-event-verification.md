# SOP-04: Location and Scan Event Verification Procedure

## Purpose

This procedure describes how to interpret location and scan event history when investigating a
pick exception.

## Event types

- `putaway`: a unit was placed at a location, typically after receiving or replenishment.
- `pick_scan`: a unit was scanned out of a location during a successful pick.
- `moved`: a unit was relocated from one location to another, typically by an automated re-slotting
  or consolidation process.
- `cycle_count`: a scheduled or triggered count confirming (or correcting) the quantity at a
  location.

## Interpreting event recency

Location and scan events should be read in chronological order relative to the pick attempt
timestamps, not merely by whether an event exists. An event that occurred after the relevant pick
attempt does not explain that attempt's failure. An event that occurred shortly before a failed
attempt is significant and should be weighed heavily, particularly `moved` events, since they
directly explain why a unit might not be found at its previously recorded location.

## Staleness

An inventory record is considered potentially stale if its `last_updated` timestamp predates a
`moved` or `cycle_count` event for the same SKU. A stale inventory record should not be treated as
a confirmed fact about the item's current location; it should be treated as the system's last known
state, pending verification against more recent event history.

## No history found

If no location or scan history exists at all for a SKU, this does not confirm or rule out any
particular explanation. It most commonly indicates a newly activated location, a data sync gap, or
an item that has not moved since initial receiving. Treat the absence of history as missing
evidence, not as evidence of correctness of the inventory record.
