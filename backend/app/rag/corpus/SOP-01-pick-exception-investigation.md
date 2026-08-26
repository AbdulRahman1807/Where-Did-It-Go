# SOP-01: Pick Exception Investigation Procedure

## Purpose

This procedure defines the standard sequence for investigating a pick task exception before a
recommendation is made. It applies to any pick task marked `exception`, regardless of the reason
code reported by the picking system or robot.

## When to use this procedure

Use this procedure as the default starting point for any pick exception. More specific procedures
(inventory discrepancy, repeated failure, short pick, restricted item) may add additional steps on
top of this baseline.

## Investigation sequence

1. Confirm the order and line item associated with the failed task.
2. Retrieve the pick task record, including all attempts and their reason codes.
3. Retrieve the current inventory record for the SKU at the assigned location.
4. Retrieve recent location/scan history for the SKU to check for movement, putaway, or count
   events that might explain a mismatch between the system record and the physical pick attempt.
5. Retrieve the operational event history for the task to understand system-generated actions
   (auto-escalation, reassignment, etc.).
6. Compare all retrieved evidence for agreement or conflict before forming a conclusion.

## Resolving a confirmed stockout

If the inventory record and the most recent location/scan history **agree** that zero units remain
at the assigned location, and no conflicting evidence exists, this is a confirmed stockout rather
than a discrepancy. In this case:

- No physical verification is required.
- The recommended action is to flag the SKU for replenishment and notify order management of a
  backorder or substitution.
- Human review is not required solely on the basis of a confirmed, unconflicted stockout, unless a
  separate high-risk or authority condition applies (see SOP-06).

## When evidence disagrees

If the inventory record, location history, and task history do not agree with one another, do not
guess which source is correct. Follow SOP-02 (Inventory Discrepancy) or SOP-04 (Location and Scan
Event Verification) as appropriate, and treat the case as requiring human review until the conflict
is resolved.

## When evidence is missing

If a required evidence source returns no data (for example, no inventory record, or no location
history at all for the SKU), do not treat the absence of data as evidence of anything in particular.
Missing evidence is its own category of problem. State plainly that a conclusion cannot be
established from the available evidence, and recommend the case be escalated for manual audit.
