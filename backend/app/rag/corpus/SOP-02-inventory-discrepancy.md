# SOP-02: Inventory Discrepancy Procedure

## Purpose

This procedure applies when the recorded inventory quantity or location for a SKU appears
inconsistent with what was found (or not found) during a pick attempt.

## Definition of a discrepancy

A discrepancy exists when at least two of the following do not agree:

- the quantity or location recorded in the inventory system
- what the picking associate or robot actually observed at the assigned location
- the most recent location or scan event history for the SKU

A single failed pick attempt, by itself, is not sufficient evidence of a discrepancy. It must be
compared against inventory and location history before a discrepancy is confirmed.

## Investigation steps

1. Retrieve the current inventory record (quantity, location, last updated timestamp).
2. Retrieve the most recent location/scan events for the SKU, not just at the assigned location.
3. Determine whether the inventory record's `last_updated` timestamp is older than the most recent
   location event. A stale inventory record (one that has not been refreshed since a more recent
   physical movement or count event) is a common and low-risk cause of an apparent discrepancy.

## Recommended actions

- If a more recent location event explains the discrepancy (for example, a movement event after
  the inventory record was last updated), recommend redirecting the pick to the updated location
  and correcting the inventory record. This is a routine correction.
- If no explanatory event exists, and the inventory and physical evidence genuinely conflict with
  no clear cause, do not resolve the conflict by assumption. Escalate for a physical cycle count and
  flag the case for human review, since acting on an unresolved discrepancy risks compounding the
  error.

## Relationship to other procedures

Repeated failures at the same location should also be checked against SOP-03. Discrepancies
involving restricted or high-value SKUs are always subject to SOP-06 regardless of how clear the
evidence appears.
