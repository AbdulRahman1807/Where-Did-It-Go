# SOP-03: Repeated Pick Failure and Location Verification Procedure

## Purpose

This procedure applies when a pick task has failed two or more times at the same assigned
location. Repeated failure at a single location is treated differently from a single isolated
failure, because it substantially raises the likelihood of a location or inventory record problem
rather than an isolated associate error.

## Trigger condition

Two or more consecutive `ITEM_NOT_FOUND` (or equivalent) attempts at the same assigned location for
the same task.

## Required steps

1. Do not authorize a third blind retry at the same location. Repeating the same physical search
   without new information wastes operator time and does not constitute investigation.
2. Retrieve the full location/scan event history for the SKU, not limited to the assigned
   location. Specifically check for `moved` events that postdate the inventory record's last
   update.
3. Compare the timestamp of the most recent location event to the timestamps of the failed pick
   attempts. If a movement event occurred shortly before a failed attempt, the item was very likely
   no longer at the assigned location at the time of the attempt.
4. If the inventory record's location disagrees with the most recent scan/movement event's
   location, this is a location conflict and must be treated as conflicting evidence: state clearly
   that the available systems disagree, and do not present either location as confirmed fact without
   further verification.

## Recommendation guidance

When a more recent movement event identifies a specific alternate location, the appropriate
recommendation is to verify the physical location before retrying the pick, and to correct the
inventory record once verified. This should be flagged for human review when the evidence is based
on a location conflict, since the recommendation depends on trusting one system record over
another. A human should confirm which location is authoritative before the correction is applied.

## Escalation condition

If, after checking location history, no explanatory event is found and the location remains
genuinely unresolved after two documented investigation rounds, escalate rather than continuing to
investigate indefinitely.
